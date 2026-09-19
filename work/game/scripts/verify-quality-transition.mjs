import {_electron as electron} from 'playwright-core';
import path from 'node:path';

const app=await electron.launch({
 args:['.','--qa','--benchmark','--quality=medium'],
 executablePath:path.resolve('node_modules/electron/dist/electron.exe'),
 timeout:90000,
});
const page=await app.firstWindow();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

try{
 await page.waitForFunction(()=>window.__game?.world?.quality==='medium'&&window.__zniczLoading?.done,null,{timeout:180000});
 const expected={day:4,hits:7,lost:2,water:.42,smoke:.18,bud:.73,prep:2,phase:'free',mode:'idle'};
 await page.evaluate(state=>{
  window.__game.begin();window.__game.setState(state);window.__game.setView(.63,-.31);
  window.__game.changeQuality('low');
 },expected);
 await page.waitForFunction(()=>window.__game?.world?.quality==='low'&&window.__zniczLoading?.done,null,{timeout:180000});
 const actual=await page.evaluate(()=>({
  quality:window.__game.world.quality,
  mode:window.__game.settings.quality,
  day:window.__game.sim.day,hits:window.__game.sim.hits,lost:window.__game.sim.lost,
  water:window.__game.sim.water,smoke:window.__game.sim.smoke,bud:window.__game.sim.bud,
  prep:window.__game.sim.prep,phase:window.__game.sim.phase,gameMode:window.__game.sim.mode,
  yaw:window.__game.world.yaw,pitch:window.__game.world.pitch,
  welcomeHidden:document.getElementById('welcome').classList.contains('hidden'),
  transitionHidden:document.getElementById('quality-transition').classList.contains('hidden'),
  readyMs:window.__zniczLoading.readyMs,
 }));
 const close=(a,b)=>Math.abs(a-b)<1e-6;
 const statePreserved=actual.day===expected.day&&actual.hits===expected.hits&&actual.lost===expected.lost&&close(actual.water,expected.water)&&close(actual.smoke,expected.smoke)&&close(actual.bud,expected.bud)&&actual.prep===expected.prep&&actual.phase===expected.phase&&actual.gameMode===expected.mode;
 const viewPreserved=close(actual.yaw,.63)&&close(actual.pitch,-.31);
 const passed=actual.quality==='low'&&actual.mode==='low'&&statePreserved&&viewPreserved&&actual.welcomeHidden&&actual.transitionHidden&&errors.length===0;
 console.log(JSON.stringify({passed,statePreserved,viewPreserved,actual,errors},null,2));
 if(!passed)throw Error('Quality transition did not preserve the active session');
}finally{
 await app.close();
}
