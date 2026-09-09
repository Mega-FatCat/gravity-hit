import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';import path from 'node:path';
const standalone=process.argv.includes('--standalone');
const out=path.resolve('../qa/recovery',standalone?'stability-standalone':'stability');await fs.mkdir(out,{recursive:true});
const executablePath=path.resolve(standalone?'../../outputs/Stillwater/Stillwater.exe':'node_modules/electron/dist/electron.exe');
const app=await electron.launch({args:standalone?['--qa']:['.','--qa'],executablePath,timeout:90000});
const page=await app.firstWindow(),errors=[],cases=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});await page.click('#begin');
 for(const fps of [60,30,20]){
  await app.evaluate(({BrowserWindow},fps)=>BrowserWindow.getAllWindows()[0].webContents.setFrameRate(fps),fps);
  for(const mode of ['bottle','heat','hole']){
   await page.evaluate(mode=>{const g=window.__game;g.setView(0,-.265);g.input.seal=true;g.input.fire=false;
    g.setState({phase:mode==='bottle'?'free':mode,mode:mode==='bottle'?'idle':mode,held:mode==='bottle'?'bottle':'lighter',supporting:mode==='heat'?'pipe':mode==='hole'?'bottle':null,prep:mode==='bottle'?2:mode==='hole'?1:0,cap:mode!=='hole',outlet:mode==='bottle',water:.3,smoke:0,bud:0,angle:45});
   },mode);
   // Let the fixture enter the real render loop before waiting on its new
   // transition. Old completed poses must not satisfy this wait prematurely.
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
   await page.waitForFunction(()=>Object.values(window.__game.world.poses).every(p=>p&&p.elapsed>=.32),null,{timeout:20000});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
   await page.mouse.move(760,420);await page.mouse.down({button:'right'});
   const samples=[];
   for(let i=0;i<36;i++){
    const x=i<12?760+i*1.2:i<24?774-(i-12)*18:558+(i-24)*24;
    await page.mouse.move(x,420+Math.sin(i*.16)*25);
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
    samples.push(await page.evaluate(()=>{
     const g=window.__game,w=g.world,id=g.sim.supporting==='pipe'?'pipe':'bottle',object=w.items[id];
     const local=w.camera.worldToLocal(object.getWorldPosition(object.position.clone()));
     const capLocal=w.items.bottle.worldToLocal(w.items.pipe.getWorldPosition(object.position.clone()));
     const label=document.getElementById('label-bottle'),rect=label.getBoundingClientRect(),anchor=w.projected.bottle;
     const hot=w.screen(w.items.lighter.localToWorld(w.nozzle.clone()).add(w.nozzle.clone().set(0,.021,0)));
     return{local:local.toArray(),poseKey:w.poses[id].key,poseTime:w.poses[id].elapsed,flameAimErrorPixels:Math.hypot(hot.x-g.input.x,hot.y-g.input.y),capOffset:capLocal.distanceTo(capLocal.clone().set(0,.228,0)),labelError:label.classList.contains('hidden')?null:Math.hypot(rect.x+rect.width/2-anchor.x,rect.bottom+14-anchor.y)};
    }));
    if([10,22,34].includes(i))await page.screenshot({path:path.join(out,`${mode}-${fps}fps-${i}.png`)});
   }
   await page.mouse.up({button:'right'});
   const first=samples[0].local,maxOffset=Math.max(...samples.map(s=>Math.hypot(...s.local.map((v,i)=>v-first[i]))));
   const labelErrors=samples.flatMap(s=>s.labelError===null?[]:[s.labelError]);
   const result={mode,requestedFps:fps,renderedSamples:samples.length,maxHeldLocalDriftMetres:maxOffset,maxCapOffsetMetres:mode==='bottle'?Math.max(...samples.map(s=>s.capOffset)):null,maxLabelErrorPixels:labelErrors.length?Math.max(...labelErrors):null,maxFlameAimErrorPixels:mode==='bottle'?null:Math.max(...samples.map(s=>s.flameAimErrorPixels)),firstSample:samples[0],lastSample:samples.at(-1)};cases.push(result);console.log(result);
   if(maxOffset>.0001||result.maxCapOffsetMetres>.0001||result.maxLabelErrorPixels>1)throw Error('Rendered-frame attachment invariant failed');
  }
 }
}catch(error){errors.push(error.stack);process.exitCode=1;}finally{
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify({executablePath,method:'Explicit visual fixtures; actual RMB pointer events; rAF yields after rendering; screenshot sequences. Coordinates test attachment, not a blanket visual-quality proof.',cases,errors},null,2));await app.close();
}
