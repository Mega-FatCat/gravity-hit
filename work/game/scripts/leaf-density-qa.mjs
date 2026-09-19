import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';

const outPath=path.resolve(process.argv[2]||'qa/leaf-density-01/diagnostic.json');
const app=await electron.launch({args:['.','--qa'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.wind=0;g.settings.motion=false;g.settings.weather='clear';g.setState({phase:'free',mode:'idle',held:null,supporting:null,prep:2,stock:10,water:.3,cap:true,tutorial:false});});
 await page.waitForTimeout(700);
 const data=await page.evaluate(()=>{
  const w=window.__game.world, seenG=new Set(), seenM=new Set(), objects=[];
  const hashBytes=(typed)=>{let h=2166136261;const bytes=new Uint8Array(typed.buffer,typed.byteOffset,typed.byteLength);for(let i=0;i<bytes.length;i++){h^=bytes[i];h=Math.imul(h,16777619);}return (h>>>0).toString(16).padStart(8,'0');};
  w.scene.traverse(o=>{
   if(!o.isMesh)return;
   const g=o.geometry,mats=Array.isArray(o.material)?o.material:[o.material];
   if(!g||seenG.has(g.uuid))return;
   seenG.add(g.uuid);
   const attrs=[];
   for(const key of ['position','normal','uv','color','leafEdge']){const a=g.attributes?.[key];if(a)attrs.push([key,a.count,a.itemSize,hashBytes(a.array)]);}
   const index=g.index?hashBytes(g.index.array):null;
   objects.push({name:o.name,geometryUuid:g.uuid,type:g.type,vertices:g.attributes.position?.count??0,indexCount:g.index?.count??0,instanceCount:o.isInstancedMesh?o.count:1,instanceMatrix:o.instanceMatrix?hashBytes(o.instanceMatrix.array):null,instanceColor:o.instanceColor?hashBytes(o.instanceColor.array):null,attrs,index});
   for(const m of mats)if(m&&!seenM.has(m.uuid)){seenM.add(m.uuid);}
  });
  const names=objects.map(o=>o.name);
  const nonLeafSignatures=objects.filter(o=>!/(leaf|needle|crown lobes|twig|shrub|fern|grass|foliage)/i.test(o.name));
  const structuralSignatures=objects.filter(o=>/structural boughs|trunk|bark|dead branches/i.test(o.name));
  return {objects,nonLeafSignatures,structuralSignatures,treeObjects:names.filter(n=>/pine|broadleaf|crown|tree/i.test(n)),worldCounts:w.environmentCounts||{},renderer:{triangles:w.renderer.info.render.triangles,calls:w.renderer.info.render.calls,points:w.renderer.info.render.points,lines:w.renderer.info.render.lines},settings:{quality:window.__game.settings.quality}};
 });
 const hashes={};
 for(const f of ['src/environment.js','src/world.js','src/foliage-rendering.js','src/clutter.js'])hashes[f]=createHash('sha256').update(await fs.readFile(f)).digest('hex');
 const result={timestamp:new Date().toISOString(),errors,hashes,data};
 await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(result,null,2));
 console.log(JSON.stringify({outPath,errors,renderer:data.renderer,objects:data.objects.length},null,2));
}finally{await app.close();}
