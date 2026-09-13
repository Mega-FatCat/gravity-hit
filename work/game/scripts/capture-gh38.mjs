import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createCaptureSession} from './qa-capture.mjs';

const label=process.argv[2] || 'final';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid capture label');
const outDir=path.resolve(`qa/gh38-${label}`);
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try {
 await page.waitForFunction(()=>!!window.__game,null,{timeout:90000});
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].setContentSize(1920,1080);});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.world.setQuality('medium');g.settings.quality='medium';g.setState({phase:'free',mode:'idle',held:null,supporting:null,prep:2,stock:10,water:.3,cap:true,tutorial:false});});
 await page.waitForTimeout(5000);
 const session=await createCaptureSession({outDir,page,minTriangles:1000});
 const views=[
  ['01-along',[-1.4,.60,3.7],.04,-.20],
  ['02-across',[0,.98,2.65],1.05,-.44],
  ['03-oblique',[-.6,.25,2.8],.66,-.12],
  ['04-top-down',[-1.65,1.3,1.3],0,-1.45],
  ['05-refill',[0,.98,2.65],.12,-.48,'fill'],
  ['06-rock-contact',[-.85,.37,1.5],1.02,-.53],
  ['07-shadow',[-1.2,.50,-3],.28,-.35],
  ['08-open',[-1.3,.6,5],.15,-.38],
 ];
 const performance=[];
 for(const [name,pos,yaw,pitch,mode='idle'] of views){
  await page.evaluate(({pos,yaw,pitch,mode})=>{const g=window.__game;g.world.baseCam.set(...pos);g.world.reach=mode==='fill'?1:0;g.setState({mode,held:mode==='fill'?'bottle':null,water:.2});g.setView(yaw,pitch);}, {pos,yaw,pitch,mode});
  await page.waitForTimeout(800);
  const timing=await page.evaluate(()=>new Promise(resolve=>{const a=[];let last;function sample(t){if(last)a.push(t-last);last=t;if(a.length<90)return requestAnimationFrame(sample);const sorted=[...a].sort((a,b)=>a-b);resolve({fps:1000/(a.reduce((s,x)=>s+x,0)/a.length),p95ms:sorted[Math.floor(a.length*.95)],...{triangles:window.__game.world.renderer.info.render.triangles,calls:window.__game.world.renderer.info.render.calls}});}requestAnimationFrame(sample);}));
  performance.push({name,...timing});
  await session.capture(name,{view:{pos,yaw,pitch,mode}});
  console.log(name,JSON.stringify(timing));
 }
 // An exact fixed-camera pair isolates animated water from camera motion.
 await page.evaluate(()=>{const g=window.__game;g.world.baseCam.set(-.85,.37,1.5);g.setView(1.02,-.53);});
 await page.waitForTimeout(500);
 await session.capture('09-motion-a');await page.waitForTimeout(700);await session.capture('10-motion-b');
 const sourceHashes={};
 for(const file of ['src/environment.js','src/stream-water.js','src/world.js']){try{sourceHashes[file]=crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');}catch{}}
 const renderState=await page.evaluate(()=>{
  const w=window.__game.world,r=w.renderer,saved=[];w.scene.traverse(o=>saved.push([o,o.visible,o.layers.mask]));
  const before={clear:r.autoClear,shadow:r.shadowMap.autoUpdate,reset:r.info.autoReset,target:r.getRenderTarget()};
  w.render();
  return {objectsRestored:saved.every(([o,v,l])=>o.visible===v&&o.layers.mask===l),rendererRestored:r.autoClear===before.clear&&r.shadowMap.autoUpdate===before.shadow&&r.info.autoReset===before.reset&&r.getRenderTarget()===before.target};
 });
 if(!renderState.objectsRestored||!renderState.rendererRestored)throw Error('Water render state leaked');
 const manifest=await session.finalize({errors,extraMeta:{scope:'GH-38 water only',status:'CURRENT BUILD NEEDS MANUAL CHECK',performance,sourceHashes,renderState}});
 if(label==='final'){
  const frames=path.join(outDir,'animation-frames');await fs.mkdir(frames,{recursive:true});
  const times=[];
  for(let i=0;i<60;i++){
   const frame=path.join(frames,`${String(i).padStart(3,'0')}.jpg`);
   times.push(Date.now());await page.screenshot({path:frame,type:'jpeg',quality:88});
   await page.waitForTimeout(65);
  }
  const list=times.map((t,i)=>`file '${String(i).padStart(3,'0')}.jpg'\nduration ${((times[i+1]??t+100)-t)/1000}`).join('\n');
  await fs.writeFile(path.join(frames,'frames.txt'),list);
  const video=spawnSync('ffmpeg',['-y','-f','concat','-safe','0','-i',path.join(frames,'frames.txt'),'-vf','scale=1280:-2','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart',path.join(outDir,'water-motion.mp4')],{encoding:'utf8',windowsHide:true});
  if(video.status!==0)throw Error(video.stderr);
  await fs.writeFile(path.join(outDir,'animation.json'),JSON.stringify({frames:60,durationSeconds:(times.at(-1)-times[0])/1000,kind:'Live runtime screenshots; original wall-clock frame durations',errors},null,2));
 }
 console.log(JSON.stringify({outDir,summary:manifest.summary,errors}));
 if(errors.length)throw Error('Capture encountered renderer errors');
} finally {await app.close();}
