import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createCaptureSession} from './qa-capture.mjs';
const tune=process.argv.includes('--tune-fxaa');
const outDir=path.resolve(tune?'qa/gh39-post-fxaa-tuned':'qa/gh39-post-variants');
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:90000});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);w.showInactive();});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.motion=false;g.settings.wind=0;g.settings.weather='clear';g.settings.quality='medium';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,supporting:null,prep:2,stock:10,water:.3,cap:true,tutorial:false});g.openMenu();document.querySelector('#modal').style.display='none';document.querySelector('#hud').style.display='none';g.world.time=12;g.world.stream.material.uniforms.time.value=12;});
 await page.waitForTimeout(2000);
 const session=await createCaptureSession({outDir,page,minTriangles:1000});
 for(const [name,pos,yaw,pitch,held]of [['leaves',[0,.98,2.65],0,-.265,null],['sky',[0,.98,2.65],-.42,.38,null],['bottle',[0,.98,2.65],0,-.265,'bottle'],['water',[-.85,.37,1.5],1.02,-.53,null]]){
  await page.evaluate(({pos,yaw,pitch,held})=>{const g=window.__game;g.world.baseCam.set(...pos);g.setState({held,mode:held?'uncap':'idle',supporting:null});g.setView(yaw,pitch);for(let i=0;i<100;i++)g.world.prepareFrame(.05,g.sim,g.input,g.settings);},{pos,yaw,pitch,held});
  for(const mode of tune?['smaa','fxaa50','fxaa25']:['off','copy','smaa','fxaa']){
   await page.evaluate(mode=>{const p=window.__game.world.finalEdges;p.mode=mode.startsWith('fxaa')?'fxaa':mode;if(mode==='fxaa50'||mode==='fxaa25'){p.fxaa.material.fragmentShader=p.fxaa.material.fragmentShader.replace(/_SubpixelBlending = [0-9.]+/,'_SubpixelBlending = '+(mode==='fxaa50'?'0.5':'0.25'));p.fxaa.material.needsUpdate=true;}},mode);
   await page.waitForTimeout(250);await session.capture(name+'-'+mode);console.log(name,mode);
  }
 }
 const result=await session.finalize({errors,extraMeta:{scope:'GH-39 post AA variants',status:'CURRENT BUILD NEEDS MANUAL CHECK'}});
 console.log(JSON.stringify({summary:result.summary,errors}));if(errors.length)throw Error('Render errors');
}finally{await app.close();}
