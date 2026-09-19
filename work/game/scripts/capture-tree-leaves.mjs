import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createCaptureSession} from './qa-capture.mjs';

const outDir=path.resolve(process.argv[2]||'qa/leaf-density-01/candidate-03');
const files=['src/tree-canopy-density.js','src/environment.js','src/foliage-mipmaps.js','src/foliage-rendering.js','src/atmosphere.js','src/world.js'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,await fs.readFile(f).then(b=>createHash('sha256').update(b).digest('hex')).catch(()=>null)])));
const before=await hashes();
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.wind=0;g.settings.motion=false;g.setState({day:2,phase:'collect',mode:'idle',held:null,supporting:null,picked:[],stock:10,water:0,cap:true,prep:0,tutorial:false});});
 const session=await createCaptureSession({outDir,page,minTriangles:1000,minCalls:1});
 const views=[['01-canopy-up',0,.68],['02-against-sky',.75,.38],['03-mid-distance',-.75,.05],['05-side-canopy',-1.35,.18]];
 if(process.argv.includes('--layers'))views.splice(0,views.length,['all',0,.68],['original-only',0,.68],['added-only',0,.68],['scan-only',0,.68]);
 if(process.argv.includes('--surround'))views.push(['06-rear-left',-2.4,.18],['07-behind',Math.PI,.18],['08-rear-right',2.4,.18],['09-right',1.55,.18]);
 for(const [name,yaw,pitch]of views){
  await session.capture(name,{setup:({yaw,pitch,name})=>{const g=window.__game;g.setView(yaw,pitch);g.world.scene.traverse(o=>{if(/dense tree leaves/.test(o.name))o.visible=name!=='original-only'&&name!=='scan-only';if(/curved broadleaf leaves/.test(o.name))o.visible=name!=='added-only'&&name!=='scan-only';if(/scanned broadleaf crown lobes/.test(o.name))o.visible=name!=='added-only';});},setupArgs:{yaw,pitch,name},view:{yaw,pitch},state:{phase:'collect',mode:'idle',held:null}});
  console.log('Verified '+name);
 }
 const structure=await page.evaluate(()=>{
  const rows=[],hash=a=>{let h=2166136261;const b=new Uint8Array(a.buffer,a.byteOffset,a.byteLength);for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619);}return(h>>>0).toString(16);};
  window.__game.world.scene.traverse(o=>{if(!o.isMesh||!/structural boughs|pine.*(?:trunk|bark|dead)/i.test(o.name))return;
   rows.push({name:o.name,position:hash(o.geometry.attributes.position.array),index:o.geometry.index?hash(o.geometry.index.array):null,matrix:o.instanceMatrix?hash(o.instanceMatrix.array):null,count:o.count??1});
  });return rows.sort((a,b)=>a.name.localeCompare(b.name));
 });
 await fs.writeFile(path.join(session.stagingDir,'structure.json'),JSON.stringify(structure,null,2));
 await fs.writeFile(path.join(session.stagingDir,'tree-roots.json'),JSON.stringify(await page.evaluate(()=>window.__game.world.environmentTreeRoots??{}),null,2));
 if(process.argv.includes('--fps')){
  const fps=[];
  for(const [name,yaw,pitch]of views){
   const sample=await page.evaluate(async({yaw,pitch})=>{const g=window.__game;g.setView(yaw,pitch);await new Promise(r=>setTimeout(r,500));return new Promise(resolve=>{let last;const dt=[];function tick(t){if(last!==undefined)dt.push(t-last);last=t;if(dt.length<90)return requestAnimationFrame(tick);const sorted=[...dt].sort((a,b)=>a-b);resolve({fps:90000/dt.reduce((a,b)=>a+b,0),p95ms:sorted[85],triangles:g.world.renderer.info.render.triangles});}requestAnimationFrame(tick);});},{yaw,pitch});fps.push({name,...sample});
  }
  await fs.writeFile(path.join(session.stagingDir,'fps.json'),JSON.stringify(fps,null,2));console.log(JSON.stringify(fps));
 }
 if(process.argv.includes('--motion'))for(let i=0;i<5;i++)await session.capture('motion-'+i,{setup:({i})=>window.__game.setView(.75+(i-2)*.012,.38),setupArgs:{i},view:{yaw:.75+(i-2)*.012,pitch:.38}});
 const after=await hashes();if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Source changed during capture');
 const report=await session.finalize({errors,extraMeta:{scope:'Leaf-only density candidate key views',status:'CURRENT BUILD NEEDS MANUAL CHECK',hashes:after}});
 console.log(JSON.stringify({outDir,summary:report.summary,errors},null,2));
 if(errors.length)throw Error('Renderer errors');
}finally{await app.close();}
