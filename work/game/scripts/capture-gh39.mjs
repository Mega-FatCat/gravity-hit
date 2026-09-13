import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createCaptureSession} from './qa-capture.mjs';

const label=process.argv[2]||'after';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid label');
const outDir=path.resolve(`qa/gh39-${label}`);
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForLoadState('load');
 if(process.argv.includes('--baseline'))await app.evaluate(async({BrowserWindow},file)=>{const w=BrowserWindow.getAllWindows()[0];await w.loadFile(file,{query:{qa:'1'}});w.showInactive();},path.resolve('dist/gh39-baseline.html'));
 if(process.argv.includes('--foliage-baseline'))await app.evaluate(async({BrowserWindow},file)=>{const w=BrowserWindow.getAllWindows()[0];await w.loadFile(file,{query:{qa:'1'}});w.showInactive();},path.resolve('dist/gh39-foliage-baseline.html'));
 await page.waitForFunction(()=>!!window.__game,null,{timeout:90000});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);w.showInactive();});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.motion=false;g.settings.wind=0;g.settings.weather='clear';g.settings.quality='medium';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,supporting:null,prep:2,stock:10,water:.3,cap:true,tutorial:false});});
 await page.evaluate(off=>{if(window.__game.world.finalEdges)window.__game.world.finalEdges.mode=off?'off':'smaa';},process.argv.includes('--post-off'));
 await page.waitForTimeout(4000);
 await page.evaluate(()=>{const g=window.__game;g.openMenu();g.world.time=12;g.world.stream.material.uniforms.time.value=12;document.querySelector('#modal').style.display='none';document.querySelector('#hud').style.display='none';});
 const session=await createCaptureSession({outDir,page,minTriangles:1000});
 const views=[
  ['01-clearing',[0,.98,2.65],0,-.265],
  ['02-trunk-sky',[0,.98,2.65],-.42,.38],
  ['03-rock-terrain',[0,.98,2.65],-.72,-.48],
  ['04-bottle',[0,.98,2.65],0,-.265,'uncap','bottle'],
  ['05-pipe',[0,.98,2.65],0,-.265,'idle','pipe'],
  ['06-stream-edge',[-.85,.37,1.5],1.02,-.53],
  ['07-water-bank',[-.6,.25,2.8],.66,-.12],
  ['08-terrain',[0,.98,2.65],-1.5,-.65],
 ];
 const timing=[];
 for(const [name,pos,yaw,pitch,mode='idle',held=null]of (process.argv.includes('--checks-only')?[]:views)){
  await page.evaluate(({pos,yaw,pitch,mode,held})=>{const g=window.__game;g.world.baseCam.set(...pos);g.world.reach=0;g.setState({mode,held,supporting:null,cap:held==='pipe'?false:true});g.setView(yaw,pitch);for(let i=0;i<100;i++)g.world.prepareFrame(.05,g.sim,g.input,g.settings);},{pos,yaw,pitch,mode,held});
  await page.waitForTimeout(300);
  timing.push({name,...await page.evaluate(()=>new Promise(resolve=>{const a=[];let last;function frame(t){if(last)a.push(t-last);last=t;if(a.length<60)return requestAnimationFrame(frame);const sorted=[...a].sort((a,b)=>a-b);const fps=1000/(a.reduce((s,x)=>s+x,0)/a.length);resolve({fps,p95:sorted[Math.floor(a.length*.95)],validTiming:fps>5});}requestAnimationFrame(frame);}))});
  await session.capture(name,{view:{pos,yaw,pitch,mode,held}});
  console.log('Captured',name);
 }
 // Isolated diagnostic using the actual trunk meshes/materials and sky. This
 // exposes silhouettes that the accepted dense canopy obscures in normal play.
 await page.evaluate(()=>{const g=window.__game,w=g.world;g.setState({held:null,mode:'idle'});w.baseCam.set(0,.98,2.65);g.setView(0,.36);window.__gh39Hidden=[];w.scene.traverse(o=>{if(o.isMesh&&o!==w.forestSky&&!/pine.*trunk/.test(o.name)){window.__gh39Hidden.push([o,o.visible]);o.visible=false;}});});
 await session.capture('09-trunks-isolated',{view:{isolated:true,purpose:'Actual trunk meshes against sky; canopy hidden for diagnosis'}});
 await page.evaluate(()=>{for(const[o,v]of window.__gh39Hidden)o.visible=v;delete window.__gh39Hidden;});
 if(process.argv.includes('--diagnose')){
  await page.evaluate(()=>{const g=window.__game;g.world.baseCam.set(-.85,.37,1.5);g.setView(1.02,-.53);});
  await session.capture('10-control');
  await page.evaluate(()=>{const w=window.__game.world;w.renderer.shadowMap.enabled=false;w.sun.castShadow=false;w.scene.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.needsUpdate=true;});});
  await session.capture('11-no-shadow');
  await page.evaluate(()=>{const w=window.__game.world;w.renderer.shadowMap.enabled=true;w.sun.castShadow=true;w.renderer.shadowMap.needsUpdate=true;w.scene.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.needsUpdate=true;});w.renderer.setPixelRatio(1.5);w.renderer.setSize(innerWidth,innerHeight);});
  await session.capture('12-dpr-1-5');
  await page.evaluate(()=>{const w=window.__game.world;w.setQuality('medium');window.__gh39Normals=new Map();w.scene.traverse(o=>{for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m?.normalScale&&!window.__gh39Normals.has(m)){window.__gh39Normals.set(m,m.normalScale.clone());m.normalScale.set(0,0);}});});
  await session.capture('13-base-normal-off');
  await page.evaluate(()=>{for(const[m,v]of window.__gh39Normals)m.normalScale.copy(v);delete window.__gh39Normals;});
 }
 const diagnostic=await page.evaluate(()=>{
  const w=window.__game.world,r=w.renderer,gl=r.getContext();r.setRenderTarget(null);
  const materials=[],geometries=[],seenM=new Set(),seenG=new Set();
  w.scene.traverse(o=>{if(!o.isMesh)return;for(const m of Array.isArray(o.material)?o.material:[o.material])if(!seenM.has(m.uuid)){seenM.add(m.uuid);materials.push({name:m.name,object:o.name,type:m.type,flatShading:m.flatShading,roughness:m.roughness,normalScale:m.normalScale?.toArray(),ao:m.aoMapIntensity,color:m.color?.toArray(),alphaTest:m.alphaTest,alphaToCoverage:m.alphaToCoverage});}const g=o.geometry;if(!seenG.has(g.uuid)){seenG.add(g.uuid);let invalid=0,min=Infinity,max=0;const n=g.attributes.normal;if(n)for(let i=0;i<n.count;i++){const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(!Number.isFinite(length)||length<.5)invalid++;min=Math.min(min,length);max=Math.max(max,length);}geometries.push({name:o.name,type:g.type,vertices:g.attributes.position.count,indexed:!!g.index,normals:!!n,invalid,min,max});}});
  return {dpr:devicePixelRatio,renderScale:r.getPixelRatio(),size:[r.domElement.width,r.domElement.height],antialias:gl.getContextAttributes().antialias,samples:gl.getParameter(gl.SAMPLES),maxSamples:gl.getParameter(gl.MAX_SAMPLES),shadowType:r.shadowMap.type,shadowSize:w.sun.shadow.mapSize.toArray(),exposure:r.toneMappingExposure,materials,geometries};
 });
 if(process.argv.includes('--pine-controls')){
  await page.evaluate(()=>{const g=window.__game;g.world.baseCam.set(0,.98,2.65);g.setView(-.42,.38);});
  for(const intensity of [.52,1,1.6,2.0]){
   await page.evaluate(intensity=>{window.__game.world.scene.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.userData.foliage&&m.alphaMap?.image?.width===266)m.envMapIntensity=intensity;});},intensity);
   await session.capture('pine-env-'+intensity);
  }
  await page.evaluate(()=>{window.__game.world.scene.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.userData.foliage&&m.alphaMap?.image?.width===266)m.envMapIntensity=.52;});});
 }
 if(process.argv.includes('--foliage-controls')){
  await page.evaluate(()=>{const g=window.__game;g.world.baseCam.set(0,.98,2.65);g.setView(0,-.265);window.__leafControls=[];const seen=new Set();g.world.scene.traverse(o=>{for(const m of [].concat(o.material||[])){if(!m.userData.foliage||seen.has(m))continue;seen.add(m);window.__leafControls.push([m,m.roughness,m.normalScale?.clone()]);}});});
  for(const [name,roughness,normals]of [['20-leaf-control',null,null],['21-leaf-matte',1,null],['22-leaf-normal-off',null,0],['23-leaf-balanced',.74,.65]]){
   await page.evaluate(({roughness,normals})=>{for(const[m,r,n]of window.__leafControls){m.roughness=roughness??r;if(n)m.normalScale.copy(n);if(normals!==null)m.normalScale?.set(normals,normals);}},{roughness,normals});
   await session.capture(name);
  }
  await page.evaluate(()=>{for(const[m,r,n]of window.__leafControls){m.roughness=r;if(n)m.normalScale.copy(n);}delete window.__leafControls;});
 }
 const sourceHashes={};for(const f of ['src/world.js','src/environment.js','src/props.js','src/streambed.js','src/stream-water.js','src/edge-quality.js','src/foliage-rendering.js',...(!process.argv.includes('--baseline')&&!process.argv.includes('--foliage-baseline')?['src/final-edge-pass.js']:[])])sourceHashes[f]=crypto.createHash('sha256').update(await fs.readFile(process.argv.includes('--foliage-baseline')?path.join('qa/gh39-foliage-matched-source',path.basename(f)):process.argv.includes('--baseline')&&f!=='src/edge-quality.js'&&f!=='src/foliage-rendering.js'?path.join('qa/gh39-source-before',path.basename(f)):f)).digest('hex');
 const renderState=await page.evaluate(()=>{const w=window.__game.world,r=w.renderer,saved=[];w.scene.traverse(o=>saved.push([o,o.visible,o.layers.mask]));const b={clear:r.autoClear,shadow:r.shadowMap.autoUpdate,reset:r.info.autoReset,target:r.getRenderTarget()};w.render();return {objectsRestored:saved.every(([o,v,l])=>o.visible===v&&o.layers.mask===l),rendererRestored:r.autoClear===b.clear&&r.shadowMap.autoUpdate===b.shadow&&r.info.autoReset===b.reset&&r.getRenderTarget()===b.target};});
 if(!renderState.objectsRestored||!renderState.rendererRestored)throw Error('Render state leaked');
 // Return to an identical frozen viewpoint after a slow sweep: no temporal
 // accumulation/history should alter detail when returning to the same pose.
 await page.evaluate(()=>{const g=window.__game;g.world.baseCam.set(-.85,.37,1.5);g.setView(1.02,-.53);});
 await session.capture('14-return-start');
 for(let i=0;i<=40;i++){await page.evaluate(i=>window.__game.setView(1.02+Math.sin(i/40*Math.PI)*.18,-.53),i);await page.waitForTimeout(35);}
 await session.capture('15-return-end');
 if(process.argv.includes('--foliage-return')){
  await page.evaluate(()=>{const g=window.__game;g.world.baseCam.set(0,.98,2.65);g.setView(0,-.265);});
  await session.capture('16-leaves-return-start');
  for(let i=0;i<=40;i++){await page.evaluate(i=>window.__game.setView(i===40?0:Math.sin(i/40*Math.PI)*.18,-.265),i);await page.waitForTimeout(35);}
  await session.capture('17-leaves-return-end');
 }
 const manifest=await session.finalize({errors,extraMeta:{scope:'GH-39',status:'CURRENT BUILD NEEDS MANUAL CHECK',timing,sourceHashes,diagnostic,renderState}});
 if(process.argv.includes('--motion')){
  const cdp=await page.context().newCDPSession(page),frames=[];
  cdp.on('Page.screencastFrame',e=>{frames.push(e);cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});});
  await page.evaluate(()=>{const g=window.__game;g.closeMenu();g.settings.wind=.5;});
  await cdp.send('Page.startScreencast',{format:'jpeg',quality:94,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
  for(const [pos,yaw,pitch,held]of [[[0,.98,2.65],-.15,.22,null],[[-.85,.37,1.5],1.02,-.53,null],[[0,.98,2.65],0,-.265,'bottle']]){
   await page.evaluate(({pos,yaw,pitch,held})=>{const g=window.__game;g.world.baseCam.set(...pos);g.setView(yaw,pitch);g.setState({held,mode:'idle'});},{pos,yaw,pitch,held});
   await page.waitForTimeout(600);await page.mouse.move(900,500);await page.mouse.down({button:'right'});
   for(let i=0;i<80;i++){await page.mouse.move(900+Math.sin(i/79*Math.PI*2)*90,500+Math.sin(i/79*Math.PI)*22);await page.waitForTimeout(60);}
   await page.mouse.up({button:'right'});
  }
  await cdp.send('Page.stopScreencast');
  const dir=path.join(outDir,'motion-frames');await fs.mkdir(dir,{recursive:true});let list='';
  for(let i=0;i<frames.length;i++){const name=String(i).padStart(4,'0')+'.jpg';await fs.writeFile(path.join(dir,name),Buffer.from(frames[i].data,'base64'));list+=`file '${name}'\nduration ${Math.max(.001,(frames[i+1]?.metadata.timestamp??frames[i].metadata.timestamp+1/30)-frames[i].metadata.timestamp)}\n`;}
  await fs.writeFile(path.join(dir,'frames.txt'),list);
  const video=spawnSync('ffmpeg',['-y','-f','concat','-safe','0','-i',path.join(dir,'frames.txt'),'-c:v','libx264','-crf','17','-pix_fmt','yuv420p','-movflags','+faststart',path.join(outDir,'slow-rotation.mp4')],{encoding:'utf8',windowsHide:true});
  if(video.status!==0)throw Error(video.stderr);
  await fs.writeFile(path.join(outDir,'motion.json'),JSON.stringify({frames:frames.length,seconds:frames.at(-1).metadata.timestamp-frames[0].metadata.timestamp,resolution:[1920,1080],input:'Actual RMB pointer motion; live water and wind; original timestamps',errors},null,2));
 }
 console.log(JSON.stringify({outDir,summary:manifest.summary,timing,errors}));
 if(errors.length)throw Error('Renderer errors');
}finally{await app.close();}
