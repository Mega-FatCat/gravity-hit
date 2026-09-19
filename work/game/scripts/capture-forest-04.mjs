import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCaptureSession} from './qa-capture.mjs';

const outDir=path.resolve(process.argv[2]||'qa/forest-texture-04/final');
const files=['src/environment.js','src/foliage-mipmaps.js','src/foliage-rendering.js','src/atmosphere.js','src/world.js','src/streambed.js','src/stream-water.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const before=await hashes();
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.wind=0;g.settings.motion=false;g.setState({phase:'collect',mode:'idle',held:null,supporting:null,picked:[],stock:10,water:0,cap:true,prep:0,tutorial:false});});
 const session=await createCaptureSession({outDir,page,minTriangles:1000,minCalls:1});
 const capture=async(name,yaw,pitch,off=false)=>{
  await session.capture(name,{setup:({yaw,pitch,off})=>{const g=window.__game;g.setView(yaw,pitch);g.world.atmosphere.enabled=!off;},setupArgs:{yaw,pitch,off},view:{yaw,pitch},state:{phase:'collect',mode:'idle',held:null}});
  console.log('Verified '+name);
 };
 for(const [name,yaw,pitch] of [['01-canopy-up',0,.68],['02-against-sky',.75,.38],['03-mid-distance',-.75,.05],['04-trunk-bark',-.32,-.02],['05-side-canopy',-1.35,.18],['06-understory-shrubs',.85,-.28]])await capture(name,yaw,pitch);
 await capture('07-canopy-atmosphere-off',0,.68,true);
 await capture('08-shrubs-atmosphere-off',.85,-.28,true);
 const mipInfo=await page.evaluate(()=>Object.fromEntries(Object.entries(window.__game.world.foliagePackedTextures).map(([id,t])=>[id,t.userData.foliageMips])));
 await fs.writeFile(path.join(session.stagingDir,'mipmaps.json'),JSON.stringify(mipInfo,null,2));
 // Real consecutive runtime frames with a slowly moving camera, not an
 // interpolated animation between screenshots. Keep the same window alive.
 for(let i=0;i<9;i++)await capture('motion-'+String(i).padStart(2,'0'),.75+(i-4)*.007,.38);
 const after=await hashes();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Source changed during capture');
 const report=await session.finalize({errors,extraMeta:{scope:'FOREST-TEXTURE-04 real runtime with atmosphere-off diagnostic',hashes:after}});
 console.log(JSON.stringify({summary:report.summary,errors},null,2));
}finally{await app.close();}
