import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCaptureSession} from './qa-capture.mjs';

const outDir=path.resolve(process.argv[2]||'qa/leaf-density-01/candidate-09');
const appDir=path.resolve(process.argv[3]||'qa/leaf-density-01/candidate-09-build/app');
const distDir=path.join(appDir,'dist');
const hashTree=async root=>{
 const files=[];
 const visit=async dir=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())await visit(full);else if(entry.isFile())files.push(full);}};
 await visit(root);files.sort();
 const hash=createHash('sha256');
 for(const file of files){hash.update(path.relative(root,file).replaceAll('\\','/'));hash.update(await fs.readFile(file));}
 return hash.digest('hex');
};
const bundleBefore=await hashTree(distDir);
const provenance=JSON.parse(await fs.readFile(path.join(path.dirname(appDir),'candidate-09-source-hashes.json'),'utf8'));
const app=await electron.launch({args:[appDir,'--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.wind=0;g.settings.motion=false;g.setState({phase:'collect',mode:'idle',held:null,supporting:null,picked:[],stock:10,water:0,cap:true,prep:0,tutorial:false});});
 const session=await createCaptureSession({outDir,page,minTriangles:1000,minCalls:1});
 const views=[['01-canopy-up',0,.68],['02-against-sky',.75,.38],['03-mid-distance',-.75,.05],['05-side-canopy',-1.35,.18]];
 for(const [name,yaw,pitch]of views){
  await session.capture(name,{setup:({yaw,pitch})=>window.__game.setView(yaw,pitch),setupArgs:{yaw,pitch},view:{yaw,pitch},state:{phase:'collect',mode:'idle',held:null}});
  console.log('Verified '+name);
 }
 // Five live render captures at closely spaced camera headings check leaf
 // parallax and shimmer; these are separate frames from the running build.
 const motionYaws=[.71,.73,.75,.77,.79];
 for(let i=0;i<motionYaws.length;i++){
  const yaw=motionYaws[i],name=`06-motion-yaw-${String(i+1).padStart(2,'0')}`;
  await page.waitForTimeout(90);
  await session.capture(name,{setup:({yaw})=>window.__game.setView(yaw,.38),setupArgs:{yaw},view:{yaw,pitch:.38},state:{phase:'collect',mode:'idle'}});
  console.log('Verified '+name);
 }
 const bundleAfter=await hashTree(distDir);
 if(bundleBefore!==bundleAfter)throw Error('Immutable app bundle changed during capture');
 const report=await session.finalize({errors,extraMeta:{scope:'Tree-leaf density only; four matched views plus five live small-yaw frames',status:'CURRENT BUILD NEEDS MANUAL CHECK',appDir,bundleSha256:bundleBefore,sourceHashesAtBuild:provenance}});
 console.log(JSON.stringify({outDir,appDir,bundleSha256:bundleBefore,summary:report.summary,errors},null,2));
 if(errors.length)throw Error('Renderer errors');
}finally{await app.close();}
