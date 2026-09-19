import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const out=path.resolve('qa/atm-01',process.argv[2]||'expansion-motion');
await fs.mkdir(out,{recursive:true});
const sourceFiles=['src/atmosphere.js','src/environment.js','src/world.js','src/stream-water.js','src/streambed.js'];
// Include integrated foliage dependencies and the loaded build entry in provenance.
sourceFiles.push('src/foliage-mipmaps.js','src/clutter.js','dist/index.html');
const fingerprint=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const sourceHashes=await fingerprint(),errors=[];
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1280,720));
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.quality='medium';g.settings.weather='clear';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,supporting:null,water:.3,cap:true,prep:2,tutorial:false});g.setView(.9273,.8);});
 await page.waitForTimeout(1500);
 await page.evaluate(()=>{const canvas=window.__game.world.renderer.domElement;const stream=canvas.captureStream(30);const chunks=[];const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:8000000});window.__atmRecording={recorder,stream,chunks};recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.start(500);});
 const route=[[.9273,.8],[.9273,-.65],[1.65,-.16],[2.55,-.62],[3.9273,-.12],[5.43,-.14],[7.2105,.8]];
 const samples=[];
 for(let i=1;i<route.length;i++){
  await page.evaluate(async({from,to})=>new Promise(resolve=>{let start;function tick(t){start??=t;const f=Math.min(1,(t-start)/3500),s=f*f*(3-2*f);window.__game.setView(from[0]+(to[0]-from[0])*s,from[1]+(to[1]-from[1])*s);if(f<1)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);}),{from:route[i-1],to:route[i]});
  const metrics=await page.evaluate(()=>({metrics:window.__game.metrics(),atmosphere:window.__game.world.atmosphere.getDiagnostics()}));
  await page.screenshot({path:path.join(out,`endpoint-${i}.png`)});
  samples.push({view:route[i],...metrics});
 }
 const sourceHashesEnd=await fingerprint();
 const video=await page.evaluate(async()=>{const r=window.__atmRecording;await new Promise(resolve=>{r.recorder.onstop=resolve;r.recorder.stop();});r.stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(r.chunks,{type:'video/webm'}).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));delete window.__atmRecording;return btoa(binary);});
 await fs.writeFile(path.join(out,'camera-orbit.webm'),Buffer.from(video,'base64'));
 const changedSources=Object.keys(sourceHashes).filter(file=>sourceHashes[file]!==sourceHashesEnd[file]);
 const allowedConcurrent=process.argv.includes('--rocks-in-progress')?['src/streambed.js','src/world.js']:[];
 if(changedSources.some(file=>!allowedConcurrent.includes(file)))throw Error('ATM/protected source changed during motion capture: '+changedSources.join(', '));
 await fs.writeFile(path.join(out,'motion.json'),JSON.stringify({sourceHashes,sourceHashesEnd,concurrentSourceChanges:changedSources,route,secondsPerSegment:3.5,resolution:[1280,720],samples,errors},null,2));
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({out,samples:samples.length,errors}));
}finally{
 await app.close();
}
