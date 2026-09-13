import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=path.resolve('qa/gh39-post-checks');await fs.mkdir(out,{recursive:true});
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:90000});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);w.showInactive();});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.motion=false;g.settings.wind=0;g.settings.weather='clear';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,supporting:null,prep:2,water:.3,cap:true,tutorial:false});g.openMenu();g.world.baseCam.set(0,.98,2.65);g.setView(0,-.265);});
 await page.waitForTimeout(3000);
 const checks=await page.evaluate(()=>{
  const g=window.__game,w=g.world,r=w.renderer,p=w.finalEdges,T=g.THREE,gl=r.getContext(),checks=[];
  const read=()=>{const a=new Uint8Array(r.domElement.width*r.domElement.height*4);gl.readPixels(0,0,r.domElement.width,r.domElement.height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;};
  const difference=(a,b)=>{let max=0,pixels=0;for(let i=0;i<a.length;i+=4){let changed=false;for(let c=0;c<3;c++){const d=Math.abs(a[i+c]-b[i+c]);max=Math.max(max,d);changed||=d>0;}pixels+=changed;}return{max,pixels};};
  // Same render, same pixels: excludes animation/pose settling between screenshots.
  for(const [view,pos,yaw,pitch,held]of [['leaves',[0,.98,2.65],0,-.265,null],['water',[-.85,.37,1.5],1.02,-.53,null],['glass',[0,.98,2.65],0,-.265,'bottle']]){
   w.baseCam.set(...pos);g.setView(yaw,pitch);g.setState({held,mode:held?'uncap':'idle'});w.prepareFrame(0,g.sim,g.input,g.settings);p.mode='off';w.render();const a=read();p.mode='copy';p.render(r);checks.push({name:'identity-'+view,...difference(a,read())});
  }
  // Synthetic display-encoded ramp, sharp corners and an asymmetric marker
  // expose transfer-function and vertical-flip errors independently of assets.
  const geometry=new T.PlaneGeometry(2,2),material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'void main(){vec2 p=gl_FragCoord.xy;float v=mod(floor(p.x),256.)/255.;gl_FragColor=vec4(v,step(90.,p.y)*v,mod(floor(p.x/13.)+floor(p.y/17.),2.),1.);}'});
  const scene=new T.Scene();scene.add(new T.Mesh(geometry,material));const camera=new T.Camera();
  const originalRatio=r.getPixelRatio();
  for(const [width,height,ratio]of [[320,180,1],[319,181,1.5],[480,270,2]]){
   r.setPixelRatio(ratio);r.setSize(width,height,false);r.render(scene,camera);const a=read();p.mode='copy';p.render(r);checks.push({name:`ramp-${width}x${height}-dpr${ratio}`,...difference(a,read()),texture:[p.texture.image.width,p.texture.image.height],drawingBuffer:[r.domElement.width,r.domElement.height]});
   const before={color:r.getClearColor(new T.Color()).toArray(),alpha:r.getClearAlpha(),autoClear:r.autoClear,autoReset:r.info.autoReset,viewport:r.getViewport(new T.Vector4()).toArray(),scissor:r.getScissor(new T.Vector4()).toArray(),scissorTest:r.getScissorTest()};
   p.mode='smaa';p.render(r);
   const after={color:r.getClearColor(new T.Color()).toArray(),alpha:r.getClearAlpha(),autoClear:r.autoClear,autoReset:r.info.autoReset,viewport:r.getViewport(new T.Vector4()).toArray(),scissor:r.getScissor(new T.Vector4()).toArray(),scissorTest:r.getScissorTest()};
   checks.push({name:'state-'+ratio,restored:JSON.stringify(before)===JSON.stringify(after)});
  }
  geometry.dispose();material.dispose();r.setPixelRatio(originalRatio);r.setSize(innerWidth,innerHeight);w.resize();
  const target=new T.WebGLRenderTarget(16,16);r.setRenderTarget(target);p.render(r);checks.push({name:'external-target-untouched',restored:r.getRenderTarget()===target});r.setRenderTarget(null);target.dispose();
  w.baseCam.set(0,.98,2.65);g.setView(0,-.265);g.setState({held:null,mode:'idle'});p.mode='smaa';w.prepareFrame(0,g.sim,g.input,g.settings);w.render();
  return {checks,webglError:gl.getError(),gpu:g.metrics().renderer};
 });
 for(const c of checks.checks){if('max'in c)assert.equal(c.max,0,c.name);if('restored'in c)assert.ok(c.restored,c.name);if(c.texture)assert.deepEqual(c.texture,c.drawingBuffer);}
 assert.equal(checks.webglError,0);
 const timing=[];
 for(const mode of ['off','smaa','smaa','off','off','smaa']){
  await page.evaluate(mode=>window.__game.world.finalEdges.mode=mode,mode);await page.waitForTimeout(350);
  const result=await page.evaluate(()=>new Promise(resolve=>{const values=[];let last;const tick=t=>{if(last!==undefined)values.push(t-last);last=t;if(values.length<90)return requestAnimationFrame(tick);const sorted=[...values].sort((a,b)=>a-b);resolve({meanMs:values.reduce((a,b)=>a+b,0)/values.length,p95Ms:sorted[Math.floor(.95*values.length)],samples:values.length});};requestAnimationFrame(tick);}));timing.push({mode,...result});
 }
 // Time only GPU work added by the pass, including framebuffer copy. Avoid
 // nested scene timer queries; unavailable/disjoint results are not evidence.
 const gpuPass=await page.evaluate(async()=>{
  const w=window.__game.world,p=w.finalEdges,r=w.renderer,gl=r.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  if(!ext)return{available:false};
  const original=p.render,queries=[];p.mode='smaa';
  p.render=function(renderer){if(queries.length>=60)return original.call(this,renderer);const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);try{original.call(this,renderer);}finally{gl.endQuery(ext.TIME_ELAPSED_EXT);}queries.push(q);};
  try{for(let frame=0;frame<240;frame++){await new Promise(requestAnimationFrame);if(queries.length===60&&queries.every(q=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)))break;}
   const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT),ready=queries.length===60&&queries.every(q=>gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE));
   return{available:ready&&!disjoint,disjoint,milliseconds:ready&&!disjoint?queries.map(q=>gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6):[]};
  }finally{p.render=original;for(const q of queries)gl.deleteQuery(q);}
 });
 const result={status:'AUTOMATED VERIFIED',checks,timing,gpuPass,errors};await fs.writeFile(path.join(out,'runtime.json'),JSON.stringify(result,null,2));assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify(result));
}finally{await app.close();}
