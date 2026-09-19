import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

const quality=process.argv.find(arg=>arg.startsWith('--quality='))?.split('=')[1]||'medium';
if(!['low','medium','high'].includes(quality))throw Error(`Unsupported quality: ${quality}`);
const outputArg=process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length);
const out=path.resolve(outputArg||`qa/loading-timeline/${quality}`);
const framesDir=path.join(out,'frames');
await fs.mkdir(framesDir,{recursive:true});

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
 await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.setBounds({x:0,y:0,width:1280,height:720});win.show();win.focus();});
 const capture=async file=>{
  const encoded=await app.evaluate(async({desktopCapturer})=>{
   const sources=await desktopCapturer.getSources({types:['window'],thumbnailSize:{width:1280,height:720},fetchWindowIcons:false});
   const source=sources.find(item=>/^ZNICZ$/i.test(item.name))??sources.find(item=>/ZNICZ/i.test(item.name));
   if(!source)throw Error('ZNICZ window was not available to the desktop capturer');
   return source.thumbnail.toJPEG(78).toString('base64');
  });
  await fs.writeFile(file,Buffer.from(encoded,'base64'));
 };
 const started=performance.now(),frames=[];let ready=false;
 const readyPromise=(async()=>{
  await new Promise(resolve=>setTimeout(resolve,1000));
  while(performance.now()-started<120000){
   try{if(await page.evaluate(()=>window.__zniczLoading?.done===true)){ready=true;return;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('Loading did not complete within 120 seconds');
 })();
 for(let index=0;!ready&&performance.now()-started<120000;index++){
  const target=started+index*200,delay=Math.max(0,target-performance.now());if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  const name=`frame-${String(index).padStart(4,'0')}.jpg`,capturedEpoch=Date.now(),captureAt=performance.now();
  try{await capture(path.join(framesDir,name));frames.push({index,file:`frames/${name}`,capturedEpoch,captureMs:Math.round(performance.now()-captureAt)});}catch(error){errors.push(`frame ${index}: ${error.message}`);break;}
 }
 await readyPromise;
 for(let i=0;i<3;i++){await new Promise(resolve=>setTimeout(resolve,200));const index=frames.length,name=`frame-${String(index).padStart(4,'0')}.jpg`,capturedEpoch=Date.now(),captureAt=performance.now();await capture(path.join(framesDir,name));frames.push({index,file:`frames/${name}`,capturedEpoch,captureMs:Math.round(performance.now()-captureAt)});}
 const audit=await page.evaluate(()=>window.__zniczLoading);
 for(const frame of frames){frame.atMs=Math.round(frame.capturedEpoch-audit.startedEpoch);delete frame.capturedEpoch;}
 const events=audit?.events??[];
 for(const frame of frames){
  const event=[...events].reverse().find(item=>item.atMs<=frame.atMs)??events[0]??{};
  Object.assign(frame,{percent:event.percent??0,stage:event.stage??'Boot shell',detail:event.detail??''});
 }
 const plateaus=[];
 for(let i=0;i<events.length;i++){
  const end=events[i+1]?.atMs??audit?.readyMs??frames.at(-1)?.atMs??events[i].atMs;
  const durationMs=end-events[i].atMs;
  if(durationMs>=500)plateaus.push({...events[i],durationMs});
 }
 plateaus.sort((a,b)=>b.durationMs-a.durationMs);
 const manifest={quality,intervalMs:200,frameCount:frames.length,elapsedMs:frames.at(-1)?.atMs??0,readyMs:audit?.readyMs??null,frames,events,plateaus,mainThreadStalls:audit?.stalls??[],errors};
 await fs.writeFile(path.join(out,'timeline.json'),JSON.stringify(manifest,null,2));
 const cards=frames.map(frame=>`<figure><img loading="lazy" src="${frame.file}"><figcaption><b>${(frame.atMs/1000).toFixed(1)} s · ${frame.percent}%</b><span>${frame.stage}</span><small>${frame.detail||'—'}</small></figcaption></figure>`).join('\n');
 const plateauRows=plateaus.slice(0,20).map(p=>`<tr><td>${(p.atMs/1000).toFixed(1)} s</td><td>${(p.durationMs/1000).toFixed(1)} s</td><td>${p.percent}%</td><td>${p.stage}</td><td>${p.detail||''}</td></tr>`).join('');
 const html=`<!doctype html><meta charset="utf-8"><title>ZNICZ loading timeline · ${quality}</title><style>body{margin:0;background:#111712;color:#dfe8d5;font:13px Segoe UI,sans-serif}header{position:sticky;top:0;z-index:2;padding:18px 24px;background:#111712ee;backdrop-filter:blur(12px);border-bottom:1px solid #aabf9628}h1{font:26px Georgia;margin:0 0 7px}p{color:#9ead98;margin:0}table{margin:20px 24px;border-collapse:collapse;color:#bfcbb7}td,th{padding:7px 12px;border:1px solid #96a88827;text-align:left}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;padding:0 24px 30px}figure{margin:0;background:#1b241d;border:1px solid #94aa8420}img{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}figcaption{display:grid;padding:9px 11px;gap:3px}figcaption span{color:#b8caa9}small{color:#788574;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style><header><h1>Loading timeline · ${quality}</h1><p>${frames.length} real captures · target interval 0.2 s · ready ${(manifest.readyMs/1000).toFixed(1)} s · errors ${errors.length}</p></header><table><thead><tr><th>Start</th><th>Held</th><th>Progress</th><th>Visible stage</th><th>Detail</th></tr></thead><tbody>${plateauRows}</tbody></table><main>${cards}</main>`;
 await fs.writeFile(path.join(out,'index.html'),html);
 console.log(JSON.stringify({quality,frameCount:frames.length,readyMs:manifest.readyMs,longestPlateaus:plateaus.slice(0,10),mainThreadStalls:manifest.mainThreadStalls.sort((a,b)=>b.durationMs-a.durationMs).slice(0,10),errors},null,2));
}finally{
 await app.close();
}
