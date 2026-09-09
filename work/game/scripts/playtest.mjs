import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
const standalone=process.argv.includes('--standalone'),full=process.argv.includes('--full');
const out=path.resolve(standalone?'../qa/recovery-standalone':'../qa/recovery-playtest');await fs.mkdir(out,{recursive:true});
if(standalone){
 const releaseQa=path.resolve('../../outputs/Stillwater/resources/qa-data/persistent-check');
 const releaseRoot=path.resolve('../../outputs/Stillwater/resources/qa-data');
 if(!releaseQa.startsWith(releaseRoot+path.sep))throw Error('Unexpected QA data location');
 await fs.rm(releaseQa,{recursive:true,force:true});
}
const launch={args:standalone?['--qa','--qa-persist']:['.','--qa'],executablePath:path.resolve(standalone?'../../outputs/Stillwater/Stillwater.exe':'node_modules/electron/dist/electron.exe'),cwd:standalone?out:process.cwd(),timeout:90000};
const app=await electron.launch(launch),page=await app.firstWindow(),errors=[],checks=[],worldClicks=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('https://**/*',r=>r.abort());
const state=()=>page.evaluate(()=>window.__game.sim.snapshot());
const wait=(predicate,timeout=15000)=>page.waitForFunction(predicate,null,{timeout});
const screenshot=name=>page.screenshot({path:path.join(out,name+'.png')});
const readMode=()=>page.evaluate(()=>window.__game.sim.mode);
async function clickWorld(id){
 await page.waitForTimeout(420);
 const point=await page.evaluate(id=>{
  const {world,sim}=window.__game;
  const center=id==='stream'?world.projected.stream:world.screen(world.items[id].localToWorld(world.items[id].position.clone().set(0,{bottle:.12,pipe:.04,lighter:.03,bag:.07}[id],0)));
  const candidates=[];
  for(let radius=0;radius<=70;radius+=4)for(let angle=0;angle<(radius?Math.PI*2:1);angle+=radius?.4:1)candidates.push({x:center.x+Math.cos(angle)*radius,y:center.y+Math.sin(angle)*radius});
  for(const p of candidates){if(p.x<10||p.y<10||p.x>innerWidth-10||p.y>innerHeight-10||document.elementFromPoint(p.x,p.y)?.id!=='scene')continue;if(world.hitTest(p.x,p.y,sim)===id)return p;}
  return null;
 },id);
 if(!point)throw Error('No unobstructed rendered surface found for '+id+'; '+JSON.stringify(await state()));
 await page.mouse.click(point.x,point.y);await page.waitForTimeout(160);worldClicks.push({id,x:point.x,y:point.y});
 const after=await state();if(id!=='stream'&&after.held!==id)throw Error('World click failed to select '+id+'; '+JSON.stringify(after));
 if(id==='stream'&&(await readMode())!=='fill'&&after.water<.99)throw Error('World stream click failed');
}
async function aimUntil(predicate,timeout=20000){
 const start=Date.now();const p=await page.evaluate(()=>window.__game.world.aimScreen);await page.mouse.move(p.x,p.y);await page.mouse.down();
 try{while(Date.now()-start<timeout){const aim=await page.evaluate(()=>window.__game.world.aimScreen);await page.mouse.move(aim.x,aim.y);await page.waitForTimeout(45);if(await page.evaluate(predicate))return;}}
 finally{await page.mouse.up();}
 throw Error('Timed out aiming: '+JSON.stringify({...await state(),mode:await readMode()}));
}
async function tilt(){
 const angle=await page.evaluate(()=>window.__game.sim.angle);if(Math.abs(angle-45)<3)return;
 const key=angle<45?'d':'a';await page.keyboard.down(key);
 try{await wait(()=>Math.abs(window.__game.sim.angle-45)<3,5000);}finally{await page.keyboard.up(key);}
}
async function pack(success=true,physical=false){
 if(physical)await clickWorld('bag');else await page.click('#slot-bag');
 await page.waitForSelector('#nug',{state:'visible'});await page.waitForTimeout(420);
 const n=await page.locator('#nug').boundingBox(),before=await state();
 await page.mouse.move(n.x+n.width/2,n.y+n.height/2);await page.mouse.down();
 const p=await page.evaluate(()=>window.__game.world.aimScreen);
 await page.mouse.move(success?p.x:180,success?p.y:260,{steps:12});await page.mouse.up();await page.waitForTimeout(140);
 const after=await state();assert.equal(after.stock,before.stock-1);assert.equal(after.lost,before.lost+(success?0:1));assert.equal(after.bud,success?1:0);
}
async function cycle({physical=false,capture=false}={}){
 await pack(true,physical);if(capture)await screenshot('loaded-pipe');
 if(physical)await clickWorld('bottle');else await page.click('#slot-bottle');
 assert.equal((await state()).held,'bottle');
 if(physical)await clickWorld('stream');else await page.click('#slot-stream');
 await page.waitForTimeout(700);if(capture)await screenshot('refill');await page.keyboard.down('Space');
 await aimUntil(()=>window.__game.sim.mode==='idle');assert.equal((await state()).held,'bottle');
 await page.keyboard.down('d');try{await wait(()=>window.__game.sim.cap,8000);}finally{await page.keyboard.up('d');}
 if(physical)await clickWorld('lighter');else await page.click('#slot-lighter');
 assert.equal((await state()).supporting,'bottle');await tilt();await page.waitForTimeout(450);
 await page.keyboard.up('Space');await aimUntil(()=>window.__game.sim.water<.18,25000);await page.keyboard.down('Space');
 if(capture)await screenshot('smoke-and-water');
 // Selecting the bottle exchanges the lighter while retaining bottle ownership.
 // E would explicitly set the bottle down and is intentionally not used here.
 await page.click('#slot-bottle');assert.equal((await state()).held,'bottle');
 await page.keyboard.down('a');try{await wait(()=>!window.__game.sim.cap,8000);}finally{await page.keyboard.up('a');}
 const before=await state();await page.keyboard.up('Space');await page.keyboard.press('Space');
 await page.waitForFunction(hits=>window.__game.sim.hits===hits+1,before.hits,{timeout:4000});
 if(capture)await screenshot('inhale');await wait(()=>['free','sleep'].includes(window.__game.sim.phase),10000);
 assert.equal((await state()).bud,0);
}
async function reloadAndCheck(){
 await page.keyboard.press('Escape');const before=await state();await page.evaluate(()=>window.__game.save());
 await page.reload();await wait(()=>!!window.__game,180000);const restored=await state();
 for(const key of ['phase','stock','lost','hits','day','prep','outlet','cap','held','supporting','tutorial','firstHit'])assert.deepEqual(restored[key],before[key],key+' survives reload');
 await page.click('#begin');await screenshot('restored');checks.push('Saved progress and both held objects survive renderer reload');
}
try{
 await wait(()=>!!window.__game,180000);await page.click('#begin');await screenshot('clean-start');
 await clickWorld('pipe');assert.equal((await state()).supporting,null);await screenshot('only-pipe-held');
 await clickWorld('lighter');assert.equal((await state()).supporting,'pipe');await tilt();
 await aimUntil(()=>window.__game.sim.phase==='press');checks.push('Actual prop clicks acquire only selected tools; pointer/keyboard heats glass');
 await clickWorld('bottle');await aimUntil(()=>window.__game.sim.phase==='unscrew');
 await page.keyboard.down('a');try{await wait(()=>window.__game.sim.phase==='hole',8000);}finally{await page.keyboard.up('a');}
 await clickWorld('lighter');await tilt();await screenshot('outlet-framing');await aimUntil(()=>window.__game.sim.phase==='free');checks.push('Fit pipe, turn cap, explicitly select lighter, form outlet');
 await cycle({physical:true,capture:true});checks.push('Actual bottle/stream/bag/lighter clicks complete first charge with held continuity');
 assert.equal((await state()).tutorial,false);await page.keyboard.press('t');assert.equal((await state()).tutorial,true);await page.keyboard.press('t');
 await page.keyboard.press('Escape');await page.click('[data-tab="world"]');await page.locator('[data-setting="quality"]').selectOption('medium');await page.click('#resume');checks.push('Tutorial toggle and settings remain usable');
 await reloadAndCheck();
 if(full){
  await pack(false);checks.push('Missed charge is permanently lost');
  while((await state()).stock>0){await cycle();console.log('Charge completed:',JSON.stringify(await state()));}
  assert.equal((await state()).hits,9);assert.equal((await state()).lost,1);await wait(()=>window.__game.sim.day===2,20000);
  assert.equal((await state()).stock,1000);await screenshot('second-morning');checks.push('All ten Day 1 charges accounted for; sleep reaches upgraded morning');
  await page.click('#slot-bag');await page.click('#slot-bottle');await page.click('#slot-stream');await page.click('#slot-bottle');await page.click('#slot-lighter');
  await wait(()=>window.__game.sim.hits===10,30000);await wait(()=>window.__game.sim.phase==='free',10000);assert.equal((await state()).stock,999);
  checks.push('Second-day clicks complete automatic hit');await reloadAndCheck();
 }
 const final=await state();await screenshot('after-hit');await page.evaluate(()=>window.__game.save());
 if(errors.length)throw Error('Runtime errors: '+errors.join('; '));
 const result={checks,final,worldClicks,errors};console.log(JSON.stringify(result,null,2));await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));
}catch(error){await screenshot('failure').catch(()=>{});const failed={checks,state:await state().catch(()=>null),mode:await readMode().catch(()=>null),worldClicks,error:error.message,errors};console.log('PLAYTEST FAILED',JSON.stringify(failed,null,2));await fs.writeFile(path.join(out,'result.json'),JSON.stringify(failed,null,2));process.exitCode=1;}
finally{await app.close();}

