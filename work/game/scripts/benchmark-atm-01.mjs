import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const out=path.resolve('qa/atm-01'),results=[],errors=[];
const label=process.argv.find((arg,i)=>i>1&&!arg.startsWith('--'))||'benchmark';
const quality=process.argv.includes('--high')?'high':'medium';
const frameCount=quality==='high'?90:180;
const views=quality==='high'?[['canopy',.9273,.8],['between-shrubs',-.85,-.14]]:[['canopy',.9273,.8],['stream',.75,-.2],['rocky-bed',.68,-.61],['between-shrubs',-.85,-.14]];
const sourceFiles=['src/atmosphere.js','src/environment.js','src/world.js','src/stream-water.js','src/streambed.js'];
// Include integrated foliage dependencies and the loaded build entry in provenance.
sourceFiles.push('src/foliage-mipmaps.js','src/clutter.js','dist/index.html');
const fingerprint=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const sourceHashes=await fingerprint();
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
 await page.evaluate(async quality=>{const g=window.__game;await g.world.ready;g.begin();g.settings.quality=quality;g.settings.weather='clear';g.world.setQuality(quality);g.setState({phase:'free',mode:'idle',held:null,supporting:null,water:.3,cap:true,prep:2,tutorial:false});},quality);
 await page.waitForTimeout(8000);
 for(const [name,yaw,pitch]of views){
  await page.evaluate(({yaw,pitch})=>window.__game.setView(yaw,pitch),{yaw,pitch});
  for(const enabled of [false,true,true,false]){
   await page.evaluate(enabled=>{window.__game.world.atmosphere.enabled=enabled;},enabled);
   await page.waitForTimeout(1000);
   const sample=await page.evaluate(async frameCount=>{
    const w=window.__game.world,r=w.renderer,gl=r.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const pending=[],gpu=[],frames=[],cpu=[];let previous=null;
    const original=w.render;
    w.render=function(){const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);const start=performance.now();try{return original.call(this);}finally{cpu.push(performance.now()-start);if(q){gl.endQuery(ext.TIME_ELAPSED_EXT);pending.push(q);}}};
    function drain(){for(let i=pending.length-1;i>=0;i--){const q=pending[i];if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(ext.GPU_DISJOINT_EXT))gpu.push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);pending.splice(i,1);}}}
    try{await new Promise(resolve=>{function sample(t){if(previous!==null)frames.push(t-previous);previous=t;if(ext)drain();if(frames.length<frameCount)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});}
    finally{w.render=original;}
    if(ext){drain();for(const q of pending)gl.deleteQuery(q);}
    const stats=a=>{const s=[...a].sort((a,b)=>a-b);return a.length?{count:a.length,meanMs:a.reduce((a,b)=>a+b)/a.length,medianMs:s[Math.floor(s.length/2)],p95ms:s[Math.floor(s.length*.95)]}:null;};
    return {frames:stats(frames),gpu:stats(gpu),cpu:stats(cpu),triangles:r.info.render.triangles,calls:r.info.render.calls,atmosphere:w.atmosphere.getDiagnostics?.()??null};
   },frameCount);
   results.push({name,enabled,...sample});console.log(JSON.stringify(results.at(-1)));
  }
 }
 const sourceHashesEnd=await fingerprint();
 const changedSources=Object.keys(sourceHashes).filter(file=>sourceHashes[file]!==sourceHashesEnd[file]);
 const allowedConcurrent=process.argv.includes('--rocks-in-progress')?['src/streambed.js','src/world.js']:[];
 if(changedSources.some(file=>!allowedConcurrent.includes(file)))throw Error('ATM/protected source changed during benchmark: '+changedSources.join(', '));
 await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,label+'.json'),JSON.stringify({timestamp:new Date().toISOString(),sourceHashes,sourceHashesEnd,concurrentSourceChanges:changedSources,size:[1920,1080],quality,results,errors},null,2));
 if(errors.length)throw Error(JSON.stringify(errors));
}finally{await app.close();}
