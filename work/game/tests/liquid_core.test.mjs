import test from 'node:test';
import assert from 'node:assert/strict';
import {BottleSurface,writeJetCenters,outletHead,advanceLegacyFlow} from '../src/liquid_core.mjs';

test('liquid_core: levels, rotations, general plane transform, decay, reset, dry outlet, jet, seal', () => {
 const pts=[];
 for(let x=0;x<20;x++)for(let y=0;y<20;y++)for(let z=0;z<20;z++)pts.push([(x+.5)/20-.5,(y+.5)/20-.5,(z+.5)/20-.5]);
 const id=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 const s=new BottleSurface(pts);s.update(0,.5,id);assert(Math.abs(s.offset)<1e-12);
 for(const a of [0,.2,.8,1.5,2.5,Math.PI]){
  const m=[Math.cos(a),Math.sin(a),0,0,-Math.sin(a),Math.cos(a),0,0,0,0,1,0,2,3,4,1];
  s.update(0,.5,m);assert(Math.abs(s.offset-3)<1e-12);
  for(const p of pts.slice(0,30)){
   const lhs=s.localPlane[0]*p[0]+s.localPlane[1]*p[1]+s.localPlane[2]*p[2]+s.localPlane[3];
   const worldY=m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13];assert(Math.abs(lhs-(worldY-s.offset))<1e-12);
  }
 }
 // General tilted normal and nonuniform scale: compare full plane identity.
 s.sx=.12;s.sz=-.07;
 const m=[1.7,.2,.1,0,-.3,.9,.2,0,.1,-.2,.7,0,2,3,-4,1];
 s.update(0,.37,m);
 for(const p of pts.filter((_,i)=>i%113===0)){
  const w=[0,1,2].map(r=>m[r]*p[0]+m[r+4]*p[1]+m[r+8]*p[2]+m[r+12]);
  const lhs=s.localPlane[0]*p[0]+s.localPlane[1]*p[1]+s.localPlane[2]*p[2]+s.localPlane[3];
  assert(Math.abs(lhs-(w.reduce((a,x,i)=>a+x*s.normal[i],0)-s.offset))<1e-12);
 }
 const final=[],peak=[];
 for(const fps of [20,30,60,120]){
  const v=new BottleSurface(pts);let max=0;
  for(let i=0;i<fps*4;i++){v.update(1/fps,.5,id,i<fps?1.5:0,0);max=Math.max(max,v.sx);}
  assert(Math.abs(v.sx)<1e-5);final.push(v.sx);peak.push(max);
 }
 assert.ok(Math.max(...peak)<.14,'held-water response should stay within a believable free-surface tilt');
 assert(Math.max(...final)-Math.min(...final)<1e-6);
 assert(Math.max(...peak)-Math.min(...peak)<.001);
 s.reset();s.update(0,.5,id);assert.equal(outletHead(s,[0,.1,0]),0);
 s.sx=.1;s.vx=1;s.update(1,.5,id);assert.equal(s.sx,0);assert.equal(s.vx,0);
 const paused=new BottleSurface(pts);paused.update(1/60,.5,id,1.2,-.4);
 const pausedState=[paused.sx,paused.sz,paused.vx,paused.vz];
 paused.update(0,.5,id,100,-100);
 assert.deepEqual([paused.sx,paused.sz,paused.vx,paused.vz],pausedState,'zero elapsed world time must not advance liquid inertia');
 for(const fraction of [.1,.25,.5,.75,.9]){
  s.update(0,fraction,id);assert(Math.abs(s.offset-(fraction-.5))<=.026);
 }
 const b=new Float32Array(36);writeJetCenters(b,[1,2,3],[1,0,0],1,.2);
 assert.deepEqual(Array.from(b.slice(0,3)),[1,2,3]);assert(Math.abs(b[34]-(2-4.905*.04))<1e-6);
 const state={outlet:true,seal:false,mode:'idle',water:.5};
 assert.equal(advanceLegacyFlow(state,.02,true),0);
 assert.equal(advanceLegacyFlow(state,NaN),0);
 assert.equal(advanceLegacyFlow(state,1),advanceLegacyFlow(state,.05));
 assert.equal(advanceLegacyFlow({...state,mode:'fill'},.05),0);
});
