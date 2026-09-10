import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const outDir=path.resolve(process.argv[2]||'qa/gh24-evidence');
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});

try{
 await page.waitForFunction(()=>!!window.__game,{timeout:180000});
 await page.waitForTimeout(2200);
 await page.evaluate(()=>{window.__game.begin();window.__game.setState({phase:'collect',mode:'idle',picked:[],stock:10,water:0,cap:true,prep:0,tutorial:false});});
 await page.waitForTimeout(2200);
 const session=await createCaptureSession({outDir,page,minTriangles:1000,minCalls:1});
 const capture=async(name,yaw,pitch)=>{await session.capture(name,{setup:({yaw,pitch})=>window.__game.setView(yaw,pitch),setupArgs:{yaw,pitch},view:{yaw,pitch},state:{phase:'collect',mode:'idle'}});console.log(`Captured verified: ${name}.png`);};
 await capture('01-canopy-up',0,.65);
 await capture('02-against-sky',.75,.35);
 await capture('03-mid-distance',-.75,.02);
 await capture('04-side-canopy',-1.35,.16);
 await page.evaluate(async()=>{for(let i=0;i<36;i++){window.__game.setView(-.9+i*.05,.18);await new Promise(resolve=>requestAnimationFrame(resolve));}});
 await capture('05-slow-pan-mid',.9,.18);
 await page.evaluate(async()=>{for(let i=0;i<36;i++){window.__game.setView(.9+i*.05,.18);await new Promise(resolve=>requestAnimationFrame(resolve));}});
 await capture('06-slow-pan-end',2.7,.18);
 const manifest=await session.finalize({warning:'GH-24 canopy volume and LOD fixtures; visual evidence only.',errors,extraMeta:{scope:'GH-24 pine canopy/needles plus preserved 3D trunk/bark',slowCameraSamples:72}});
 console.log(JSON.stringify({outDir,summary:manifest.summary,errors},null,2));
}finally{await app.close();}
