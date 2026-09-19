import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const outPath=path.resolve(process.argv[2]||'qa/leaf-density-01/fps.json');
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.wind=0;g.settings.motion=false;g.settings.weather='clear';g.setState({phase:'collect',mode:'idle',held:null,supporting:null,picked:[],stock:10,water:0,cap:true,prep:0,tutorial:false});});
 const views=[['01-canopy-up',0,.68],['02-against-sky',.75,.38],['03-mid-distance',-.75,.05],['05-side-canopy',-1.35,.18]];
 const samples=[];
 for(const [name,yaw,pitch]of views){
  const sample=await page.evaluate(({yaw,pitch})=>{const g=window.__game;g.setView(yaw,pitch);for(let i=0;i<10;i++)g.world.render();return new Promise(resolve=>{const dt=[];let last=0,n=0;const frame=t=>{if(last)dt.push(t-last);last=t;if(++n<91)return requestAnimationFrame(frame);const sorted=[...dt].sort((a,b)=>a-b),mean=dt.reduce((s,x)=>s+x,0)/dt.length;resolve({fps:1000/mean,p95:sorted[Math.floor(sorted.length*.95)],p05:sorted[Math.floor(sorted.length*.05)],triangles:g.world.renderer.info.render.triangles,calls:g.world.renderer.info.render.calls});};requestAnimationFrame(frame);});},{yaw,pitch});
  samples.push({name,yaw,pitch,...sample});
 }
 const result={timestamp:new Date().toISOString(),errors,samples};await fs.mkdir(path.dirname(outPath),{recursive:true});await fs.writeFile(outPath,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await app.close();}
