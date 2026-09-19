import {chromium} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';

const edge='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out=path.resolve(process.argv.find(arg=>arg.startsWith('--output='))?.slice('--output='.length)||'qa/quality-transition/20260919-medium-high');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:edge,headless:false,args:['--enable-gpu','--use-angle=d3d11','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-features=CalculateNativeWinOcclusion']});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await context.addInitScript(()=>{const key='znicz-qa-navigation-count';sessionStorage.setItem(key,String((Number(sessionStorage.getItem(key))||0)+1));});
const page=await context.newPage(),errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error'&&!/^Failed to load resource:/.test(message.text()))errors.push(message.text());});
page.on('response',response=>{if(response.status()>=400&&!response.url().endsWith('/favicon.ico'))errors.push(`${response.status()} ${response.url()}`);});
try{
 await page.goto(`http://127.0.0.1:5173/?qa=1&quality=medium&transitionAudit=${Date.now()}`,{waitUntil:'commit',timeout:30000});
 await page.waitForFunction(()=>window.__game?.world?.quality==='medium'&&window.__zniczLoading?.done===true,null,{timeout:180000});
 const expected={day:4,hits:7,lost:2,water:.42,smoke:.18,bud:.73,prep:2,phase:'free',mode:'idle'};
 const transitionStarted=performance.now();
 await page.evaluate(state=>{window.__game.begin();window.__game.setState(state);window.__game.setView(.63,-.31);void window.__game.changeQuality('high');},expected);
 await page.waitForFunction(()=>window.__game?.world?.quality==='high'&&window.__zniczLoading?.done===true,null,{timeout:180000});
 const transitionMs=Math.round(performance.now()-transitionStarted);
 const actual=await page.evaluate(()=>({
  quality:window.__game.world.quality,mode:window.__game.settings.quality,
  day:window.__game.sim.day,hits:window.__game.sim.hits,lost:window.__game.sim.lost,
  water:window.__game.sim.water,smoke:window.__game.sim.smoke,bud:window.__game.sim.bud,
  prep:window.__game.sim.prep,phase:window.__game.sim.phase,gameMode:window.__game.sim.mode,
  yaw:window.__game.world.yaw,pitch:window.__game.world.pitch,
  welcomeHidden:document.querySelector('#welcome').classList.contains('hidden'),
  transitionHidden:document.querySelector('#quality-transition').classList.contains('hidden'),
  readyMs:window.__zniczLoading.readyMs,navigationCount:Number(sessionStorage.getItem('znicz-qa-navigation-count')),
  downloads:window.__zniczDownloads.snapshot(),network:document.querySelector('#load-network')?.textContent,
 }));
 const close=(a,b)=>Math.abs(a-b)<1e-6;
 const statePreserved=actual.day===expected.day&&actual.hits===expected.hits&&actual.lost===expected.lost&&close(actual.water,expected.water)&&close(actual.smoke,expected.smoke)&&close(actual.bud,expected.bud)&&actual.prep===expected.prep&&actual.phase===expected.phase&&actual.gameMode===expected.mode;
 const viewPreserved=close(actual.yaw,.63)&&close(actual.pitch,-.31);
 const passed=actual.quality==='high'&&actual.mode==='high'&&actual.navigationCount===2&&statePreserved&&viewPreserved&&actual.welcomeHidden&&actual.transitionHidden&&errors.length===0;
 const result={passed,transitionMs,statePreserved,viewPreserved,actual,errors};
 await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));
 await page.screenshot({path:path.join(out,'restored-high.jpg'),type:'jpeg',quality:88});
 console.log(JSON.stringify(result,null,2));
 if(!passed)throw Error('Browser quality transition did not satisfy its contract');
}finally{await browser.close();}
