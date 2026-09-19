import test from 'node:test';import assert from 'node:assert/strict';import {Simulation} from '../src/simulation.js';
const advance=(s,t,input={})=>{for(let i=0;i<t*60;i++)s.step(1/60,input);};
test('reloading during inhale cannot duplicate a charge or hit',()=>{const s=new Simulation({phase:'inhale',stock:4,hits:6,bud:.4,smoke:.6,water:.1,cap:false,prep:2,outlet:true});assert.equal(s.phase,'free');assert.equal(s.hits,6);assert.equal(s.bud,0);assert.equal(s.water,0);s.action('hit');assert.equal(s.hits,6);});
test('compressed smoke load remains bounded while visual density adapts to headspace',()=>{const s=new Simulation({phase:'free',prep:2,outlet:true,cap:false,water:.2,smoke:.7});s.action('bottle');s.action('fill');advance(s,3,{fire:true,aim:1,seal:true});assert.ok(s.smoke<=1);assert.ok(s.smokeDensity>=0&&s.smokeDensity<=1);});
test('reloading last hit stays in free phase and allows refill',()=>{const s=new Simulation({phase:'inhale',stock:0,hits:10,prep:2,outlet:true});assert.equal(s.phase,'free');assert.equal(s.stock,0);assert.equal(s.refill(),true);assert.equal(s.stock,10);});
test('fill-first, empty ignition, then load remains recoverable',()=>{const s=new Simulation({phase:'free',prep:2,outlet:true,cap:false});s.action('bottle');s.action('fill');advance(s,4,{fire:true,aim:1,seal:true});s.action('bottle');advance(s,2,{right:true,seal:true});s.action('ignite');s.angle=45;advance(s,3,{fire:true,aim:1});assert.equal(s.smoke,0);s.cancel();s.action('bottle');s.action('bottle');advance(s,2,{left:true,seal:true});s.action('pack');s.pack(true);assert.equal(s.bud,1);assert.equal(s.stock,9);});
test('manual ritual workflow retains physical continuity across refill',()=>{const s=new Simulation({phase:'free',prep:2,outlet:true,cap:false,stock:0});assert.equal(s.action('bag'),false);assert.equal(s.refill(),true);assert.equal(s.action('bag'),true);s.pack(true);assert.equal(s.stock,9);assert.equal(s.bud,1);});
test('draining stops below the real outlet while inhaling empties the rest',()=>{const s=new Simulation({phase:'free',prep:2,outlet:true,cap:true,water:1});advance(s,30);assert.ok(Math.abs(s.water-.072)<.001);});

test('save and reload preserve explicitly held companions without acquiring other tools',()=>{
 const s=new Simulation();s.action('pipe');s.action('lighter');advance(s,1,{fire:true,aim:1});
 const restored=new Simulation(s.snapshot());assert.equal(restored.held,'lighter');assert.equal(restored.supporting,'pipe');
 assert.equal(restored.mode,'idle');restored.action('lighter');advance(restored,8,{fire:true,aim:1});assert.equal(restored.phase,'press');
 restored.cancel();const putDown=new Simulation(restored.snapshot());assert.equal(putDown.held,null);assert.equal(putDown.supporting,null);
});

test('cancel and reload at each preparation phase always allow explicit recovery',()=>{
 let s=new Simulation();s.action('pipe');s.action('lighter');s.angle=45;advance(s,5,{fire:true,aim:1});
 s.cancel();s=new Simulation(s.snapshot());assert.equal(s.phase,'press');s.action('pipe');s.action('bottle');advance(s,3,{fire:true,aim:1});
 assert.equal(s.phase,'unscrew');advance(s,.8,{left:true});s.cancel();s=new Simulation(s.snapshot());
 s.action('bottle');advance(s,3,{left:true});assert.equal(s.phase,'hole');s.cancel();s=new Simulation(s.snapshot());
 s.action('bottle');s.action('lighter');advance(s,5,{fire:true,aim:1});assert.equal(s.phase,'free');assert.equal(s.outlet,true);
});

test('reload after an interrupted charge drag cannot spend a charge until packing restarts',()=>{
 const s=new Simulation({phase:'free',prep:2,outlet:true,cap:false});s.action('bag');
 const restored=new Simulation(s.snapshot());assert.equal(restored.pack(false),false);assert.equal(restored.stock,10);
 restored.action('bag');assert.equal(restored.pack(true),true);assert.equal(restored.stock,9);
});

test('restored depleted state allows refill and manual lighting cycle',()=>{
 const s=new Simulation({phase:'free',prep:2,outlet:true,cap:false,stock:0});
 const restored=new Simulation(s.snapshot());assert.equal(restored.stock,0);
 assert.equal(restored.action('refill'),true);assert.equal(restored.stock,10);
 restored.action('bag');assert.equal(restored.pack(true),true);assert.equal(restored.bud,1);
});

