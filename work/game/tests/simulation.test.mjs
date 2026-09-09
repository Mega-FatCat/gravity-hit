import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';
const ready=(overrides={})=>new Simulation({phase:'free',prep:2,outlet:true,cap:false,...overrides});
const advance=(s,seconds,input={})=>{for(let i=0;i<seconds*60;i++)s.step(1/60,input);};
const load=s=>{s.action('bag');assert.equal(s.mode,'pack');assert.equal(s.pack(true),true);};
function ritual(s){
 load(s);s.action('bottle');s.action('stream');advance(s,4,{fire:true,aim:1,seal:true});
 advance(s,2,{right:true,seal:true});assert.equal(s.cap,true);s.action('lighter');s.angle=45;
 for(let i=0;i<1800&&s.water>.17;i++)s.step(1/60,{fire:true,aim:1});
 assert.ok(s.smoke>.4);s.action('bottle');advance(s,2,{left:true,seal:true});
 assert.equal(s.cap,false);assert.equal(s.action('hit'),true);advance(s,4.2);
}
test('preparation uses explicitly selected tools and correct flame contact',()=>{
 const s=new Simulation();s.action('pipe');assert.equal(s.held,'pipe');assert.equal(s.supporting,null);
 s.action('lighter');assert.equal(s.phase,'heat');assert.equal(s.supporting,'pipe');
 advance(s,10,{fire:true,aim:0});assert.equal(s.heat,0);s.angle=45;advance(s,5,{fire:true,aim:1});assert.equal(s.phase,'press');
 s.action('bottle');advance(s,3,{fire:true,aim:1});assert.equal(s.phase,'unscrew');
 advance(s,3,{left:true});assert.equal(s.phase,'hole');assert.equal(s.cap,false);
 advance(s,5,{fire:true,aim:1});assert.equal(s.progress,0,'Bottle alone cannot produce a flame');
 s.action('lighter');assert.equal(s.supporting,'bottle');advance(s,5,{fire:true,aim:1});
 assert.equal(s.phase,'free');assert.equal(s.outlet,true);assert.equal(s.held,'lighter');assert.equal(s.supporting,'bottle');
});
test('selecting one object never acquires unrelated objects from the slab',()=>{
 for(const id of ['bottle','pipe','lighter','bag']){const s=ready();s.action(id);assert.equal(s.held,id);assert.equal(s.supporting,null);}
 const s=new Simulation();s.action('lighter');assert.equal(s.supporting,null);s.cancel();s.action('pipe');assert.equal(s.supporting,null);
 s.action('lighter');assert.equal(s.supporting,'pipe');
});
test('fill targets the stream and retains the already held bottle',()=>{
 const s=ready();s.action('stream');assert.notEqual(s.mode,'fill');s.action('bottle');assert.equal(s.water,0);assert.equal(s.mode,'idle');
 s.action('stream');advance(s,4,{fire:true,aim:1,seal:true});assert.ok(s.water>.99);assert.equal(s.held,'bottle');assert.equal(s.mode,'idle');
 s.cancel();assert.equal(s.held,null);assert.equal(s.supporting,null);
});
test('a closed cap blocks refilling and packing',()=>{
 const s=ready({cap:true,held:'bottle'});s.action('stream');assert.notEqual(s.mode,'fill');s.action('pipe');assert.notEqual(s.mode,'pack');assert.equal(s.stock,10);
});
test('each explicit drop consumes one charge and delayed pointer-up cannot consume another',()=>{
 const s=ready();s.action('bag');assert.equal(s.pack(false),true);assert.equal(s.stock,9);assert.equal(s.lost,1);
 assert.equal(s.pack(true),false);assert.equal(s.stock,9);s.action('bag');s.cancel();assert.equal(s.pack(false),false);assert.equal(s.stock,9);
 s.action('bag');s.action('bottle');assert.equal(s.pack(false),false);assert.equal(s.stock,9);
 s.action('bag');assert.equal(s.pack(true),true);assert.equal(s.bud,1);assert.equal(s.stock,8);assert.equal(s.pack(true),false);assert.equal(new Simulation(s.snapshot()).lost,1);
});
test('repeated clicks cannot restart a cap turn or silently exchange its tools',()=>{
 const s=ready();s.action('bottle');s.action('bottle');advance(s,.5,{right:true,seal:true});const progress=s.progress;
 assert.equal(s.action('lighter'),false);assert.equal(s.action('bottle'),false);assert.equal(s.progress,progress);assert.equal(s.held,'bottle');
 advance(s,2,{right:true,seal:true});assert.equal(s.cap,true);s.action('bottle');advance(s,2,{left:true,seal:true});assert.equal(s.cap,false);
});
test('an empty pipe drains water but never creates smoke',()=>{
 const s=ready({cap:true,water:1});s.action('lighter');s.angle=45;advance(s,7,{fire:true,aim:1});assert.ok(s.water<.6);assert.equal(s.smoke,0);assert.equal(s.bud,0);
});
test('no water means no suction even with an ignited loaded pipe',()=>{
 const s=ready({cap:true,water:.072,bud:1,embers:1,held:'bottle'});s.action('lighter');assert.equal(s.mode,'idle');advance(s,3,{fire:true,aim:1});assert.equal(s.smoke,0);assert.equal(s.flow,0);
});
test('outlet seal prevents drainage and smoke displacement',()=>{
 const s=ready({cap:true,water:1,bud:1});s.action('lighter');s.angle=45;advance(s,5,{fire:true,aim:1,seal:true});assert.equal(s.water,1);assert.equal(s.smoke,0);assert.ok(s.embers>.8);
});
test('ignited material and draining water produce smoke; opening the cap leaks',()=>{
 const s=ready({cap:true,water:1,bud:1,held:'bottle'});s.action('lighter');s.angle=45;advance(s,5,{fire:true,aim:1});assert.ok(s.smoke>.3);
 const before=s.smoke;s.action('bottle');advance(s,2,{left:true,seal:true});assert.equal(s.cap,false);advance(s,2,{seal:true});assert.ok(s.smoke<before);
});
test('wrong tilt cannot heat a held glass pipe',()=>{
 const s=new Simulation();s.action('pipe');s.action('lighter');s.angle=99;advance(s,9,{fire:true,aim:1});assert.equal(s.heat,0);
});
test('hit requires a held bottle, open cap, and trapped smoke',()=>{
 const s=ready({water:.15,smoke:.6});assert.equal(s.action('hit'),false);assert.equal(s.hits,0);s.action('bottle');assert.equal(s.action('hit'),true);
 assert.equal(s.hits,1);assert.equal(s.phase,'inhale');assert.equal(s.action('hit'),false);assert.equal(s.cancel(),false);advance(s,5);
 assert.equal(s.water,0);assert.equal(s.bud,0);assert.equal(s.tutorial,false);assert.equal(s.phase,'free');
 const closed=ready({cap:true,held:'bottle',water:.15,smoke:.6});assert.equal(closed.action('hit'),false);
});
test('dry hit has a stronger game cough response',()=>{
 const dry=ready({held:'bottle',smoke:.6,water:0}),wet=ready({held:'bottle',smoke:.6,water:.16});dry.action('hit');wet.action('hit');assert.ok(dry.cough>wet.cough);
});
test('ten real charges lead to sleep and the automatic second day',()=>{
 const s=ready();for(let i=0;i<10;i++)ritual(s);assert.equal(s.hits,10);assert.equal(s.stock,0);assert.equal(s.phase,'sleep');assert.equal(s.held,null);
 advance(s,8);assert.equal(s.day,2);assert.equal(s.stock,1000);s.action('bag');assert.equal(s.bud,1);assert.equal(s.mode,'idle');
 s.action('bottle');s.action('stream');assert.equal(s.water,1);s.action('bottle');s.action('lighter');advance(s,20);assert.equal(s.hits,11);assert.equal(s.phase,'free');assert.equal(s.stock,999);
});
test('missing every charge still completes the afternoon',()=>{
 const s=ready();for(let i=0;i<10;i++){s.action('bag');assert.equal(s.pack(false),true);}s.step(.02);assert.equal(s.phase,'sleep');assert.equal(s.lost,10);advance(s,8);assert.equal(s.day,2);
});
test('second-day automatic draw needs both a charge and an already held bottle',()=>{
 const empty=ready({day:2,cap:true,water:1,held:'bottle'});empty.action('lighter');assert.notEqual(empty.mode,'auto');advance(empty,20);assert.equal(empty.hits,0);assert.equal(empty.smoke,0);
 const resting=ready({day:2,cap:true,water:1,bud:1});resting.action('lighter');assert.notEqual(resting.mode,'auto');assert.equal(resting.isHeld('bottle'),false);
});
test('state stays bounded through arbitrary physical inputs and invalid time deltas',()=>{
 const s=ready({water:1,cap:true,bud:1,held:'bottle'});s.action('lighter');for(let i=0;i<10000;i++){
  s.step(i%71===0?NaN:i%53===0?-1:.05,{fire:i%3===0,aim:(i%11)/10,seal:i%9<3,left:i%7===0,right:i%5===0});
  for(const k of ['water','smoke','bud','embers'])assert.ok(s[k]>=0&&s[k]<=1,k);assert.ok(s.smoke<=1-s.water);assert.ok(s.held!==s.supporting||s.held===null);
 }
});
