import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const quality=process.argv.find(arg=>arg.startsWith('--quality='))?.split('=')[1]||'high';
if(!['low','medium','high'].includes(quality))throw Error(`Unsupported quality: ${quality}`);
const outputArg=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
const only=process.argv.find(arg=>arg.startsWith('--only='))?.slice('--only='.length);
const out=path.resolve(outputArg||`qa/preset-baseline/browser-${quality}`);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:edge,headless:false,args:['--enable-gpu','--use-angle=d3d11','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-features=CalculateNativeWinOcclusion']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&!/^Failed to load resource:/.test(message.text()))errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))errors.push(`${response.status()} ${response.url()}`);});
const started=performance.now();
try{
 await page.goto(`http://127.0.0.1:5173/?qa=1&quality=${quality}&audit=${Date.now()}`,{waitUntil:'commit',timeout:30000});
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 const readyMs=Math.round(performance.now()-started);
 await page.evaluate(()=>{const game=window.__game;game.begin();game.setState({phase:'free',mode:'idle',held:null,supporting:null,water:.3,cap:true,bud:1,prep:2,outlet:true,smoke:.15,tutorial:false});});
 await page.waitForTimeout(2500);
 const views=[];
 const allViews=[['01-forward',0,-.265],['02-stream',.75,-.2],['03-forest',-.85,-.15],['04-canopy',0,.6],['05-streambed-close',.75,-.8],['06-shrubs',-.4,-.1],['07-rear',Math.PI,-.18]];
 const selectedViews=only?allViews.filter(([name])=>name===only):allViews;
 if(!selectedViews.length)throw Error(`Unknown view: ${only}`);
 for(const [name,yaw,pitch] of selectedViews){
  await page.evaluate(({yaw,pitch})=>window.__game.setView(yaw,pitch),{yaw,pitch});
  await page.waitForTimeout(500);
  const sample=await page.evaluate(()=>new Promise(resolve=>{const intervals=[];let previous=null;function frame(now){if(previous!==null)intervals.push(now-previous);previous=now;if(intervals.length<120)return requestAnimationFrame(frame);const sorted=[...intervals].sort((a,b)=>a-b),sum=intervals.reduce((a,b)=>a+b,0),renderer=window.__game.world.renderer;resolve({fps:1000/(sum/intervals.length),p95ms:sorted[Math.floor(sorted.length*.95)],p99ms:sorted[Math.floor(sorted.length*.99)],worstMs:sorted.at(-1),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries});}requestAnimationFrame(frame);}));
  await page.screenshot({path:path.join(out,`${name}.jpg`),type:'jpeg',quality:88});
  views.push({name,yaw,pitch,...sample});
  console.log(name,JSON.stringify(sample));
 }
 const environment=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],devicePixelRatio,renderer:window.__game.world.qualityDecision.caps.gpu,profile:window.__game.world.profile,metrics:window.__game.metrics()}));
 const result={quality,readyMs,environment,views,errors};
 await fs.writeFile(path.join(out,'benchmark.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result,null,2));
 if(errors.length)throw Error(`Runtime errors: ${errors.join('; ')}`);
}finally{
 await browser.close();
}
