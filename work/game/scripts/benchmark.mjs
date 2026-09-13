import {_electron as electron} from 'playwright-core';
import path from 'node:path';import fs from 'node:fs/promises';import fsSync from 'node:fs';
const standalone=process.argv.includes('--standalone');
const out=path.resolve('../qa/recovery',standalone?'benchmark-standalone':'benchmark');await fs.mkdir(out,{recursive:true});
const exeZnicz=path.resolve('../../outputs/Stillwater/Znicz.exe');
const exeStillwater=path.resolve('../../outputs/Stillwater/Stillwater.exe');
const executablePath=standalone?(fsSync.existsSync(exeZnicz)?exeZnicz:exeStillwater):path.resolve('node_modules/electron/dist/electron.exe');
// Packaged builds use the normal offscreen QA path. The benchmark-only window
// mode can stop delivering animation frames in the portable shell after a
// view change, which makes a package benchmark hang after its first capture.
const app=await electron.launch({args:standalone?['--qa']:['.','--qa','--benchmark'],executablePath,timeout:90000});
const page=await app.firstWindow(),errors=[],views=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);if(w.showInactive)w.showInactive();});
 await page.evaluate(()=>{const g=window.__game;g.begin();g.setState({phase:'free',mode:'idle',held:'bottle',supporting:null,water:.6,cap:true,bud:1,prep:2,outlet:true,smoke:.2});g.input.seal=true;g.world.setQuality('medium');});
 await page.waitForTimeout(8000);
 for(const [name,yaw,pitch]of [['forward',0,-.265],['stream',.75,-.2],['forest',-.85,-.15]]){
  await page.evaluate(({yaw,pitch})=>window.__game.setView(yaw,pitch),{yaw,pitch});await page.waitForTimeout(2000);
  const sample=await page.evaluate(()=>new Promise(resolve=>{const intervals=[];let previous=null;function sample(now){if(previous!==null)intervals.push(now-previous);previous=now;if(intervals.length<180)return requestAnimationFrame(sample);const sorted=[...intervals].sort((a,b)=>a-b);resolve({...window.__game.metrics(),fps:1000/(intervals.reduce((a,b)=>a+b)/intervals.length),p95ms:sorted[Math.floor(sorted.length*.95)],frames:intervals.length});}requestAnimationFrame(sample);}));
  const draws=await page.evaluate(()=>new Promise(resolve=>{const saved=[],counts={};const tally=(o,g,pass)=>{const name=(o.name||o.type).replace(/ variant \d+.*/, '').split(':')[0];const key=`${name} (${pass})`;counts[key]=(counts[key]||0)+(g.index?.count??g.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);};requestAnimationFrame(()=>{window.__game.world.scene.traverse(o=>{if(!o.isMesh)return;const render=o.onBeforeRender,shadow=o.onBeforeShadow;saved.push([o,render,shadow]);o.onBeforeRender=function(r,s,c,g,...args){tally(o,g,'color');return render.call(this,r,s,c,g,...args);};o.onBeforeShadow=function(r,o2,c,sc,g,...args){tally(o,g,'shadow');return shadow.call(this,r,o2,c,sc,g,...args);};});requestAnimationFrame(()=>{for(const[o,r,s]of saved){o.onBeforeRender=r;o.onBeforeShadow=s;}resolve(Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,18));});});}));
  await page.screenshot({path:path.join(out,name+'.png')});views.push({name,...sample,draws});console.log(name,JSON.stringify(sample));
 }
 const orbit=await page.evaluate(()=>new Promise(resolve=>{const times=[];let previous=null,peakTriangles=0;function sweep(now){if(previous!==null)times.push(now-previous);previous=now;const g=window.__game;peakTriangles=Math.max(peakTriangles,g.world.renderer.info.render.triangles);g.setView(times.length/240*Math.PI*2,-.265);if(times.length<240)return requestAnimationFrame(sweep);const sorted=[...times].sort((a,b)=>a-b);resolve({frames:times.length,fps:1000/(times.reduce((a,b)=>a+b)/times.length),p95ms:sorted[Math.floor(sorted.length*.95)],peakTriangles});}requestAnimationFrame(sweep);}));
 const result={standalone,size:await page.evaluate(()=>[innerWidth,innerHeight]),views,orbit,errors};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
 if(errors.length)throw new Error('Renderer errors in benchmark');
}finally{await app.close();}
