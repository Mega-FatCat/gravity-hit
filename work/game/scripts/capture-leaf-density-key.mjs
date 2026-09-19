import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCaptureSession} from './qa-capture.mjs';

const outDir=path.resolve(process.argv[2]||'qa/leaf-density-01/candidate-03');
const files=['src/environment.js','src/foliage-mipmaps.js','src/foliage-rendering.js','src/atmosphere.js','src/world.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const before=await hashes();
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.wind=0;g.settings.motion=false;g.setState({phase:'collect',mode:'idle',held:null,supporting:null,picked:[],stock:10,water:0,cap:true,prep:0,tutorial:false});});
 const session=await createCaptureSession({outDir,page,minTriangles:1000,minCalls:1});
 const views=[['01-canopy-up',0,.68],['02-against-sky',.75,.38],['03-mid-distance',-.75,.05],['05-side-canopy',-1.35,.18]];
 for(const [name,yaw,pitch]of views){
  await session.capture(name,{setup:({yaw,pitch})=>{const g=window.__game;g.setView(yaw,pitch);},setupArgs:{yaw,pitch},view:{yaw,pitch},state:{phase:'collect',mode:'idle',held:null}});
  console.log('Verified '+name);
 }
 const after=await hashes();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Source changed during capture');
 const report=await session.finalize({errors,extraMeta:{scope:'Leaf-only density candidate key views',status:'CURRENT BUILD NEEDS MANUAL CHECK',hashes:after}});
 console.log(JSON.stringify({outDir,summary:report.summary,errors},null,2));
 if(errors.length)throw Error('Renderer errors');
}finally{await app.close();}
