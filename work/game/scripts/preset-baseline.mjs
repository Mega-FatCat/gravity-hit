import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {createCaptureSession} from './qa-capture.mjs';

const qualityArg=process.argv.find(arg=>arg.startsWith('--quality='));
const quality=qualityArg?.split('=')[1]||'high';
if(!['low','medium','high'].includes(quality))throw Error(`Unsupported quality preset: ${quality}`);

const outputArg=process.argv.find(arg=>arg.startsWith('--output='));
const out=path.resolve(outputArg?.slice('--output='.length)||`qa/preset-baseline/${quality}`);
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice('--only='.length);
await fs.mkdir(out,{recursive:true});

const launchStarted=performance.now();
const app=await electron.launch({
 args:['.','--qa','--benchmark',`--quality=${quality}`],
 executablePath:path.resolve('node_modules/electron/dist/electron.exe'),
 timeout:90000,
});
const page=await app.firstWindow();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 const readyMs=performance.now()-launchStarted;
 await app.evaluate(({BrowserWindow})=>{
  const window=BrowserWindow.getAllWindows()[0];
  window.setContentSize(1920,1080);
  window.showInactive?.();
 });
 await page.evaluate(selected=>{
  const game=window.__game;
  game.settings.quality=selected;
  game.world.setQuality(selected);
  game.begin();
  game.setState({phase:'free',mode:'idle',held:null,supporting:null,water:.3,cap:true,bud:1,prep:2,outlet:true,smoke:.15,tutorial:false});
 },quality);
 await page.waitForTimeout(2500);

 const session=await createCaptureSession({outDir:out,page,minTriangles:1000,minCalls:1});
 const allViews=[
  ['01-forward',0,-.265],
  ['02-stream',.75,-.2],
  ['03-forest',-.85,-.15],
  ['04-canopy',0,.6],
  ['05-streambed-close',.75,-.8],
  ['06-shrubs',-.4,-.1],
  ['07-rear',Math.PI,-.18],
 ];
 const views=only?allViews.filter(([name])=>name===only):allViews;
 if(!views.length)throw Error(`Unknown capture view: ${only}`);
 const performanceViews=[];
 for(const [name,yaw,pitch] of views){
  await page.evaluate(({yaw,pitch})=>window.__game.setView(yaw,pitch),{yaw,pitch});
  await page.waitForTimeout(500);
  const sample=await page.evaluate(()=>new Promise(resolve=>{
   const intervals=[];let previous=null;
   function frame(now){
    if(previous!==null)intervals.push(now-previous);previous=now;
    if(intervals.length<90)return requestAnimationFrame(frame);
    const sorted=[...intervals].sort((a,b)=>a-b),sum=intervals.reduce((a,b)=>a+b,0),renderer=window.__game.world.renderer;
    resolve({fps:1000/(sum/intervals.length),p95ms:sorted[Math.floor(sorted.length*.95)],p99ms:sorted[Math.floor(sorted.length*.99)],worstMs:sorted.at(-1),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries});
   }
   requestAnimationFrame(frame);
  }));
  performanceViews.push({name,yaw,pitch,...sample});
  await session.capture(name,{view:{yaw,pitch},state:{quality}});
  console.log(name,JSON.stringify(sample));
 }
 const manifest=await session.finalize({errors,extraMeta:{quality,readyMs,performanceViews}});
 const resourceAudit=await page.evaluate(()=>{
  const paths=[...new Set(performance.getEntriesByType('resource').map(entry=>{
   try{return new URL(entry.name).pathname;}catch{return entry.name;}
  }).filter(value=>value.includes('/assets/')))];
  const tieredCore=paths.filter(value=>/(?:rock_boulder_dry\/(?:diff|nor_gl|rough|ao)_|pine_bark_4k\/pine_bark_(?:diff|nor_gl|rough)_)(?:1k|2k|4k)\.(?:jpg|png)$/i.test(value));
  return {assetCount:paths.length,tieredCore,forestHdr:paths.some(value=>value.endsWith('/forest.hdr')),requested4kCore:tieredCore.some(value=>/_4k\./i.test(value)),requested2kCore:tieredCore.some(value=>/_2k\./i.test(value)),requested1kCore:tieredCore.some(value=>/_1k\./i.test(value)),paths};
 });
 await fs.writeFile(path.join(out,'resource-audit.json'),JSON.stringify({quality,...resourceAudit},null,2));
 const result={quality,readyMs,performanceViews,resourceAudit:{...resourceAudit,paths:undefined},errors,manifest:manifest.summary};
 await fs.writeFile(path.join(out,'benchmark.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
 if(errors.length)throw Error(`Runtime errors: ${errors.join('; ')}`);
}finally{
 await app.close();
}
