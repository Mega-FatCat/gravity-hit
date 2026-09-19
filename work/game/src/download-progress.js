const MB=1024*1024;

function assetKey(value){
 try{
  const url=new URL(String(value),location.href);
  const marker='/assets/';
  const index=url.pathname.lastIndexOf(marker);
  return index<0?null:decodeURIComponent(url.pathname.slice(index+marker.length));
 }catch{return null;}
}

export function formatBytes(value){
 const bytes=Math.max(0,Number(value)||0);
 if(bytes<1024)return `${Math.round(bytes)} B`;
 if(bytes<MB)return `${(bytes/1024).toFixed(bytes<10240?1:0)} KB`;
 return `${(bytes/MB).toFixed(bytes<10*MB?1:0)} MB`;
}

export class DownloadProgress {
 constructor(sizes={},onUpdate=()=>{}){
  this.sizes=sizes;this.onUpdate=onUpdate;this.items=new Map();this.startedAt=0;this.lastEmit=0;this.samples=[];
  this.timer=setInterval(()=>this.emit(),250);
 }
 plan(url,totalHint=0){
  const key=assetKey(url);if(!key)return null;
  let item=this.items.get(key);
  const known=Math.max(0,Number(totalHint)||Number(this.sizes[key])||0);
  if(!item){item={key,total:known,loaded:0,complete:false,authoritative:false};this.items.set(key,item);if(!this.startedAt)this.startedAt=performance.now();}
  else if(!item.authoritative&&known>item.total)item.total=known;
  this.emit();return item;
 }
 setTotal(url,totalHint){
  const item=this.plan(url);if(!item)return null;
  const total=Math.max(0,Number(totalHint)||0);
  if(total){item.total=Math.max(item.loaded,total);item.authoritative=true;}
  this.emit(true);return item;
 }
 add(url,bytes,totalHint=0){
  const item=this.plan(url,totalHint);if(!item||item.complete)return;
  const amount=Math.max(0,Number(bytes)||0);
  item.loaded=Math.min(item.total||Infinity,item.loaded+amount);
  if(amount){const now=performance.now();this.samples.push({at:now,bytes:amount});this.samples=this.samples.filter(sample=>now-sample.at<=4000);}
  this.emit();
 }
 complete(url){
  const item=this.plan(url);if(!item)return;
  item.loaded=Math.max(item.loaded,item.total);item.complete=true;this.emit(true);
 }
 snapshot(){
  let loaded=0,total=0,complete=0;
  for(const item of this.items.values()){loaded+=item.loaded;total+=item.total;if(item.complete)complete++;}
  const now=performance.now();this.samples=this.samples.filter(sample=>now-sample.at<=4000);
  const sampled=this.samples.reduce((sum,sample)=>sum+sample.bytes,0);
  const windowSeconds=this.samples.length?Math.max(.25,(now-this.samples[0].at)/1000):1;
  return {loaded,total,rate:sampled/windowSeconds,complete,count:this.items.size,done:this.items.size>0&&complete===this.items.size};
 }
 emit(force=false){
  const now=performance.now();if(!force&&now-this.lastEmit<120)return;this.lastEmit=now;this.onUpdate(this.snapshot());
 }
 dispose(){clearInterval(this.timer);}
}

export function installTrackedFetch(tracker){
 if(!tracker||globalThis.__zniczFetchTracked)return;
 const nativeFetch=globalThis.fetch.bind(globalThis);
 globalThis.fetch=async(input,init)=>{
  const url=typeof input==='string'||input instanceof URL?String(input):input?.url;
  const item=tracker.plan(url);
  const response=await nativeFetch(input,init);
  if(!item||!response.body){tracker.complete(url);return response;}
  const contentLength=Number(response.headers.get('content-length'))||item.total;
  if(contentLength)tracker.setTotal(url,contentLength);
  const reader=response.body.getReader();
  const stream=new ReadableStream({
   async pull(controller){
    try{const {done,value}=await reader.read();if(done){tracker.complete(url);controller.close();return;}tracker.add(url,value.byteLength,contentLength);controller.enqueue(value);}
    catch(error){controller.error(error);}
   },
   cancel(reason){return reader.cancel(reason);},
  });
  // file:// responses report status 0 in Electron, which is valid for Three's
  // FileLoader but not accepted by the Response constructor.
  return new Response(stream,{status:response.status||200,statusText:response.statusText,headers:response.headers});
 };
 globalThis.__zniczFetchTracked=true;
}
