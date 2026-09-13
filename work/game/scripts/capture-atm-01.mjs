import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCaptureSession,verifyCaptureSet} from './qa-capture.mjs';

const label=process.argv[2]||'candidate';
const outDir=path.resolve('qa/atm-01',label);
const sourceFiles=['src/atmosphere.js','src/world.js','src/stream-water.js','src/streambed.js','src/environment.js','src/foliage-rendering.js','src/edge-quality.js','src/final-edge-pass.js','src/props.js','src/smoke.js'];
const fingerprint=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const sourceHashes=await fingerprint();
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.quality='medium';g.settings.weather='clear';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,supporting:null,water:.3,cap:true,prep:2,tutorial:false});});
 await page.waitForTimeout(3000);
 const session=await createCaptureSession({outDir,page,minTriangles:1000,minCalls:1});
 const views=[['01-sun-through-canopy',.9273,.8],['02-sun-blocked',.9273,.8,[-2.5,2.8,1]],['03-partial-exposure',.9273,.8,[-1,.98,1]],['04-perpendicular',-.64,.1],['05-dense-forest',2.5,.18],['06-stream',.75,-.2],['07-rocky-streambed',.68,-.61],['08-hero-props',0,-.265]];
 const samples=[];
 for(const [name,yaw,pitch,camera=[0,.98,2.65]]of views){
  await page.evaluate(({yaw,pitch,camera})=>{window.__game.world.baseCam.fromArray(camera);window.__game.setView(yaw,pitch);},{yaw,pitch,camera});
  await page.waitForTimeout(800);
  await page.evaluate(()=>{window.__game.openMenu();document.getElementById('modal').classList.add('hidden');});
  await session.capture(name,{view:{yaw,pitch,camera},state:{phase:'free',mode:'idle',atmosphere:true}});
  if(['01-sun-through-canopy','02-sun-blocked','04-perpendicular','05-dense-forest','06-stream','07-rocky-streambed','08-hero-props'].includes(name)){
   await page.evaluate(()=>{window.__game.world.atmosphere.enabled=false;});
   await session.capture(name+'-off',{view:{yaw,pitch,camera},state:{phase:'free',mode:'idle',atmosphere:false}});
   await page.evaluate(()=>{window.__game.world.atmosphere.enabled=true;});
  }
  await page.evaluate(()=>window.__game.closeMenu());
  const sample=await page.evaluate(()=>new Promise(resolve=>{const intervals=[];let prev=null;function step(t){if(prev!==null)intervals.push(t-prev);prev=t;if(intervals.length<90)return requestAnimationFrame(step);const sorted=[...intervals].sort((a,b)=>a-b),g=window.__game,w=g.world,meanMs=intervals.reduce((a,b)=>a+b)/intervals.length;resolve({...g.metrics(),meanMs,fps:1000/meanMs,p95ms:sorted[Math.floor(sorted.length*.95)],atmosphere:w.atmosphere?.getDiagnostics?.()??null,sun:w.sun.position.toArray(),camera:w.camera.position.toArray()});}requestAnimationFrame(step);}));
  samples.push({name,...sample});console.log(name,JSON.stringify(sample));
 }
 await page.evaluate(()=>{const g=window.__game;g.world.baseCam.set(0,.98,2.65);g.setView(0,-.265);g.input.seal=true;g.setState({phase:'free',mode:'idle',held:'bottle',water:.5,smoke:.3,cap:true,outlet:true});});
 await page.waitForTimeout(800);
 await session.capture('09-held-pet-smoke',{state:{held:'bottle',smoke:.3},view:{yaw:0,pitch:-.265}});
 await page.evaluate(()=>{const g=window.__game;g.setState({phase:'free',mode:'fill',held:'bottle',smoke:0,water:.2});});
 await page.waitForTimeout(800);
 await session.capture('10-refill',{state:{mode:'fill',held:'bottle'}});
 await page.evaluate(()=>{const g=window.__game;g.setState({phase:'free',mode:'idle',held:null});g.setView(.9273,.8);});
 await page.waitForTimeout(800);
 for(let i=0;i<5;i++){
  await session.capture('motion-'+i,{setup:i=>window.__game.setView(.9273+i*.008,.8),setupArgs:i,view:{yaw:.9273+i*.008,pitch:.8}});
 }
 const qualityChecks=[];
 for(const quality of ['low','high','medium']){
  await page.evaluate(quality=>{const g=window.__game;g.settings.quality=quality;g.world.setQuality(quality);},quality);
  await page.waitForTimeout(400);
  qualityChecks.push(await page.evaluate(()=>window.__game.world.atmosphere.getDiagnostics()));
 }
 if(JSON.stringify(sourceHashes)!==JSON.stringify(await fingerprint()))throw Error('Source changed during captures');
 const manifest=await session.finalize({errors,extraMeta:{scope:'ATM-01 fresh camera fixtures; blocked and partial cameras chosen from actual depth probes',sourceHashes,samples,qualityChecks}});
 await fs.writeFile(path.join(outDir,'performance.json'),JSON.stringify(samples,null,2));
 console.log(JSON.stringify({summary:manifest.summary,verification:await verifyCaptureSet(outDir),errors}));
 if(errors.length)throw Error('Runtime errors in ATM-01 captures');
}finally{await app.close();}
