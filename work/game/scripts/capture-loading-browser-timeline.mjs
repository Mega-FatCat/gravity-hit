import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const quality=process.argv.find(arg=>arg.startsWith('--quality='))?.split('=')[1]||'high';
if(!['low','medium','high'].includes(quality))throw Error(`Unsupported quality: ${quality}`);
const outputArg=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
const out=path.resolve(outputArg||`qa/loading-timeline/browser-${quality}`);
const framesDir=path.join(out,'frames');
const intervalMs=200;
await fs.mkdir(framesDir,{recursive:true});

const browser=await chromium.launch({
 executablePath:edge,
 headless:false,
 args:['--enable-gpu','--use-angle=d3d11','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-features=CalculateNativeWinOcclusion'],
});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const page=await context.newPage();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&!/^Failed to load resource:/.test(message.text()))errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))errors.push(`${response.status()} ${response.url()}`);});

try{
 const cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:40,downloadThroughput:8*1024*1024,uploadThroughput:2*1024*1024,connectionType:'wifi'});
 const started=performance.now(),frames=[],writes=[];
 let captureActive=false,lastCaptureEpoch=0,frameIndex=0;
 cdp.on('Page.screencastFrame',event=>{
  cdp.send('Page.screencastFrameAck',{sessionId:event.sessionId}).catch(()=>{});
  if(!captureActive)return;
  const capturedEpoch=Date.now();
  if(capturedEpoch-lastCaptureEpoch<intervalMs-15)return;
  lastCaptureEpoch=capturedEpoch;
  const index=frameIndex++,file=`frame-${String(index).padStart(4,'0')}.jpg`;
  frames.push({index,file:`frames/${file}`,capturedEpoch,captureMs:0});
  writes.push(fs.writeFile(path.join(framesDir,file),Buffer.from(event.data,'base64')));
 });
 await cdp.send('Page.startScreencast',{format:'jpeg',quality:76,maxWidth:1920,maxHeight:1080,everyNthFrame:1});
 captureActive=true;
 await page.goto(`http://127.0.0.1:5173/?qa=1&quality=${quality}&networkAudit=1&audit=${Date.now()}`,{waitUntil:'commit',timeout:30000});
 let ready=false;
 while(!ready&&performance.now()-started<150000){
  try{ready=await page.evaluate(()=>window.__zniczLoading?.done===true);}catch{}
  if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
 }
 await new Promise(resolve=>setTimeout(resolve,intervalMs*4));
 captureActive=false;
 await cdp.send('Page.stopScreencast');
 await Promise.all(writes);
 if(!ready)errors.push('Loading did not complete within 150 seconds');
 const runtime=await page.evaluate(()=>({loading:window.__zniczLoading,downloads:window.__zniczDownloads?.snapshot(),renderer:window.__game?.world?.qualityDecision?.caps?.gpu??null}));
 const events=runtime.loading?.events??[];
 for(const frame of frames){frame.atMs=Math.round(frame.capturedEpoch-(runtime.loading?.startedEpoch??frame.capturedEpoch));delete frame.capturedEpoch;const event=[...events].reverse().find(item=>item.atMs<=frame.atMs)??events[0]??{};Object.assign(frame,{percent:event.percent??0,stage:event.stage??'Boot shell',detail:event.detail??'',visibleArt:Math.min(9,Math.max(0,Math.floor(Math.max(0,frame.atMs)/10000))),ready:frame.atMs>=(runtime.loading?.readyMs??Infinity)});}
 const captureGaps=frames.slice(1).map((frame,index)=>({fromMs:frames[index].atMs,toMs:frame.atMs,durationMs:frame.atMs-frames[index].atMs})).filter(gap=>gap.durationMs>350).sort((a,b)=>b.durationMs-a.durationMs);
 const plateaus=[];
 for(let index=0;index<events.length;index++){
  const end=events[index+1]?.atMs??runtime.loading?.readyMs??frames.at(-1)?.atMs??events[index].atMs;
  const durationMs=end-events[index].atMs;
  if(durationMs>=500)plateaus.push({...events[index],durationMs});
 }
 plateaus.sort((a,b)=>b.durationMs-a.durationMs);
 const manifest={quality,viewport:[1920,1080],network:{latencyMs:40,downloadBytesPerSecond:8*1024*1024},intervalMs,frameCount:frames.length,readyMs:runtime.loading?.readyMs??null,captureGaps,frames,events,plateaus,mainThreadStalls:runtime.loading?.stalls??[],downloads:runtime.downloads,renderer:runtime.renderer,errors};
 await fs.writeFile(path.join(out,'timeline.json'),JSON.stringify(manifest,null,2));
 const cards=frames.map(frame=>`<figure><img loading="lazy" src="${frame.file}"><figcaption><b>${(frame.atMs/1000).toFixed(1)} s · ${frame.percent}%${Number.isInteger(frame.visibleArt)?` · art ${frame.visibleArt+1}`:''}</b><span>${frame.stage}</span><small>${frame.detail||'—'}</small></figcaption></figure>`).join('\n');
 const rows=plateaus.slice(0,20).map(item=>`<tr><td>${(item.atMs/1000).toFixed(1)} s</td><td>${(item.durationMs/1000).toFixed(2)} s</td><td>${item.percent}%</td><td>${item.stage}</td><td>${item.detail||''}</td></tr>`).join('');
 const html=`<!doctype html><meta charset="utf-8"><title>ZNICZ browser loading timeline</title><style>body{margin:0;background:#111712;color:#dfe8d5;font:13px Segoe UI,sans-serif}header{position:sticky;top:0;z-index:2;padding:18px 24px;background:#111712ee;border-bottom:1px solid #aabf9628}h1{font:26px Georgia;margin:0 0 7px}p{color:#9ead98;margin:0}table{margin:20px 24px;border-collapse:collapse;color:#bfcbb7}td,th{padding:7px 12px;border:1px solid #96a88827;text-align:left}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;padding:0 24px 30px}figure{margin:0;background:#1b241d;border:1px solid #94aa8420}img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}figcaption{display:grid;padding:9px 11px;gap:3px}figcaption span{color:#b8caa9}small{color:#788574;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style><header><h1>Browser loading timeline · ${quality}</h1><p>${frames.length} runtime captures · 0.2 s target · ${(manifest.readyMs/1000).toFixed(1)} s to ready · ${errors.length} errors</p></header><table><thead><tr><th>Start</th><th>Held</th><th>Progress</th><th>Stage</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table><main>${cards}</main>`;
 await fs.writeFile(path.join(out,'index.html'),html);
 console.log(JSON.stringify({quality,frameCount:frames.length,readyMs:manifest.readyMs,downloads:manifest.downloads,renderer:manifest.renderer,captureGaps:captureGaps.slice(0,10),longestPlateaus:plateaus.slice(0,10),mainThreadStalls:manifest.mainThreadStalls.sort((a,b)=>b.durationMs-a.durationMs).slice(0,10),errors},null,2));
}finally{
 await browser.close();
}
