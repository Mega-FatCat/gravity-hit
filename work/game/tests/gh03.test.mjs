import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

const ready=(overrides={})=>new Simulation({phase:'free',prep:2,outlet:true,cap:false,...overrides});
const advance=(s,seconds,input={})=>{for(let i=0;i<seconds*60;i++)s.step(1/60,input);};

test('GH-03 matrix: valid actions require the physical target and state',()=>{
 const cases=[
  ['pack with bag held and open pipe target',ready(),s=>{s.action('bag');return s.action('pack')},true],
  ['refill with held bottle and open outlet',ready(),s=>{s.action('bottle');return s.action('stream')},true],
  ['screw with prepared pipe and bottle',ready({water:1,bud:1}),s=>{s.action('bottle');return s.action('pipe')},true],
  ['heating with cap on, water above outlet',ready({cap:true,water:1}),s=>s.action('lighter'),true],
  ['hit with held bottle, open cap, trapped smoke',ready({held:'bottle',smoke:.2}),s=>s.action('hit'),true],
  ['pack before preparation',new Simulation({phase:'free'}),s=>{s.action('bag');return s.action('pack')},false],
  ['refill without held bottle',ready(),s=>s.action('stream'),false],
  ['refill through closed cap',ready({cap:true,held:'bottle'}),s=>s.action('stream'),false],
  ['heat without attached cap',ready({held:'bottle'}),s=>s.action('lighter'),false],
  ['hit without drilled outlet',ready({outlet:false,held:'bottle',smoke:.2}),s=>s.action('hit'),false],
 ];
 for(const [name,state,attempt,valid]of cases){
  const result=attempt(state);
  assert.equal(result,valid,name);
  if(!valid)assert.equal(state.phase,'free',name+' must remain recoverable');
 }
});

test('GH-03 unusual pickup orders retain both preparation tools and start the action',()=>{
 let s=new Simulation();s.action('lighter');s.action('pipe');
 assert.equal(s.phase,'heat');assert.equal(s.mode,'heat');assert.equal(s.held,'lighter');assert.equal(s.supporting,'pipe');

 s=new Simulation({phase:'press',prep:0,cap:true});s.action('bottle');s.action('pipe');
 assert.equal(s.mode,'press');assert.equal(s.held,'bottle');assert.equal(s.supporting,'pipe');

 s=new Simulation({phase:'hole',prep:1,cap:false,held:'bottle',supporting:'pipe'});s.action('lighter');s.action('bottle');
 assert.equal(s.mode,'hole');assert.equal(s.held,'lighter');assert.equal(s.supporting,'bottle');
});

test('GH-03 unusual orders can recover without hidden correction or item loss',()=>{
 const s=ready();
 s.action('lighter');
 const before={held:s.held,supporting:s.supporting,mode:s.mode,stock:s.stock,lost:s.lost};
 assert.equal(s.action('stream'),false);
 assert.deepEqual({held:s.held,supporting:s.supporting,mode:s.mode,stock:s.stock,lost:s.lost},before);
 s.cancel();s.action('bag');assert.equal(s.mode,'pack');assert.equal(s.pack(true),true);
 s.action('bottle');s.action('stream');advance(s,4,{fire:true,aim:1,seal:true});
 assert.equal(s.held,'bottle');assert.ok(s.water>=.995);

 const invalid=ready({held:'pipe'});assert.equal(invalid.action('lighter'),false);
 assert.equal(invalid.held,'lighter');assert.equal(invalid.supporting,'pipe');
});
