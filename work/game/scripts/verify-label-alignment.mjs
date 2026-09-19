import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve(process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)||'qa/label-alignment');
const quality=process.argv.find(arg=>arg.startsWith('--quality='))?.slice(10)||'low';
const dpr=Number(process.argv.find(arg=>arg.startsWith('--dpr='))?.slice(6)||1);
const duringLoad=process.argv.includes('--resize-during-load');
const once=process.argv.includes('--once');
const captureHeld=process.argv.includes('--capture-held');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:false,args:['--enable-gpu','--use-angle=d3d11','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const context=await browser.newContext({viewport:duringLoad?{width:1920,height:1080}:{width:1420,height:598},deviceScaleFactor:dpr});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('404'))errors.push(message.text());});
try{
 await page.goto(`http://127.0.0.1:5173/?qa=1&quality=${quality}&audit=${Date.now()}`,{waitUntil:'commit',timeout:30000});
 if(duringLoad){await page.waitForTimeout(1000);await page.setViewportSize({width:1420,height:598});}
 try{await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});}catch(error){
  await page.screenshot({path:path.join(out,'load-failure.png')});
  console.log('Load diagnostic',await page.evaluate(()=>({url:location.href,title:document.title,body:document.body.innerText.slice(0,1000),readyState:document.readyState,load:window.__zniczLoading?.events?.slice(-5)})),errors);
  throw error;
 }
 await page.evaluate(()=>{window.__game.begin();window.__game.setView(0,-.265);window.__game.setState({phase:'collect',mode:'idle',held:null,supporting:null,tutorial:false});});
 await page.waitForTimeout(900);
 const capture=async name=>{
  const info=await page.evaluate(()=>{
   const g=window.__game,w=g.world,r=w.renderer,c=document.querySelector('#scene').getBoundingClientRect(),h=document.querySelector('#hud').getBoundingClientRect();
   const gl=r.getContext(),vp=gl.getParameter(gl.VIEWPORT),size=r.getDrawingBufferSize(new g.THREE.Vector2());
   const bottleWorld=w.items.bottle.getWorldPosition(new g.THREE.Vector3());
   return {inner:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:{x:c.x,y:c.y,width:c.width,height:c.height},hud:{x:h.x,y:h.y,width:h.width,height:h.height},draw:[size.x,size.y],viewport:[...vp],cameraAspect:w.camera.aspect,heldBottleLocal:g.sim.held==='bottle'?w.camera.worldToLocal(bottleWorld).toArray():null,projected:w.projected,labels:Object.fromEntries(['bottle','pipe','lighter','bag','stream'].map(id=>{const b=document.querySelector(`#label-${id}`).getBoundingClientRect();return[id,{x:b.x+b.width/2,y:b.y+b.height/2,width:b.width,height:b.height}]}))};
  });
  await page.screenshot({path:path.join(out,`${name}.png`)});
  await fs.writeFile(path.join(out,`${name}.json`),JSON.stringify(info,null,2));
  console.log(name,JSON.stringify(info));
  if(Math.abs(info.canvas.width-info.inner[0])>1||Math.abs(info.canvas.height-info.inner[1])>1||Math.abs(info.cameraAspect-info.inner[0]/info.inner[1])>1e-6)throw Error('Canvas/camera and UI viewport differ');
  if(info.heldBottleLocal&&Math.hypot(...info.heldBottleLocal.map((value,index)=>value-[-.08,-.15,-.64][index]))>.005)throw Error('Held bottle moved away from camera anchor');
 };
 await capture('01-initial-short');
 if(captureHeld){await page.evaluate(()=>window.__game.setState({phase:'collect',mode:'idle',held:'bottle',supporting:null}));await page.waitForTimeout(700);await capture('02-held-bottle');await page.evaluate(()=>window.__game.setView(.45,-.33));await page.waitForTimeout(700);await capture('03-held-rotated');}
 if(once){if(errors.length)throw Error(errors.join('; '));process.exitCode=0;}else{
 await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(700);await capture('02-wide');
 await page.setViewportSize({width:1420,height:598});await page.waitForTimeout(700);await capture('03-short-again');
 await page.evaluate(()=>window.__game.setState({phase:'collect',mode:'idle',held:'bottle',supporting:null}));await page.waitForTimeout(700);await capture('04-held-bottle');
 if(errors.length)throw Error(errors.join('; '));
 }
}finally{await browser.close();}
