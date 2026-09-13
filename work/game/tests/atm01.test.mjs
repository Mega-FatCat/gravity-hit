import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Atmosphere} from '../src/atmosphere.js';

function fixture(){
 const scene=new T.Scene(),sun=new T.DirectionalLight();sun.position.set(-12,26,-9);scene.add(sun,sun.target);
 const camera=new T.PerspectiveCamera(53,16/9,.025,150);camera.position.set(0,.98,2.65);camera.rotation.set(.8,.9273,0,'YXZ');camera.updateMatrixWorld();scene.updateMatrixWorld();
 const renderer={getDrawingBufferSize:v=>v.set(1920,1080),shadowMap:{enabled:true}};
 const world={scene,sun,camera,renderer};const atmosphere=new Atmosphere(world);return {world,atmosphere};
}

test('ATM-01 solar projection is invariant under camera translation for a directional sun',()=>{
 const {world,atmosphere:a}=fixture();
 const before=a.getDiagnostics().projectedSunUV;
 world.camera.position.set(-3.5,1.2,2.65);world.camera.updateMatrixWorld();
 const after=a.getDiagnostics().projectedSunUV;
 assert.ok(Math.abs(before[0]-after[0])<1e-10);assert.ok(Math.abs(before[1]-after[1])<1e-10);
 assert.ok(before[1]>.5,'positive pitch still leaves the physical sun above image centre in texture coordinates');
 a.dispose();
});

test('ATM-01 Low and explicit off bypass depth; resizing quality keeps bounded targets',()=>{
 const {atmosphere:a}=fixture();
 a.setQuality('medium');assert.deepEqual(a.getDiagnostics().effectResolution,{width:640,height:360,scale:1/3});
 a.setQuality('high');assert.equal(a.sampleCount,40);assert.equal(a.effectResolution.width,960);
 a.setQuality('low');assert.equal(a.needsDepth(),false);
 a.setQuality('medium');a.enabled=false;assert.equal(a.needsDepth(),false);
 a.dispose();assert.equal(a._volumeTarget,null);
});

test('ATM-01 independent pollen motion updates the uploaded buffer and releases owned resources',()=>{
 const {world,atmosphere:a}=fixture();const original=new Float32Array([0,1,0,1,1,1]);
 const pollen=a.createPollen(original);const before=Array.from(pollen.geometry.attributes.position.array);
 a.update(.05,{wind:.5});const after=Array.from(pollen.geometry.attributes.position.array);
 assert.notDeepEqual(after,before);assert.deepEqual(Array.from(original),before);
 const delta0=after.slice(0,3).map((x,i)=>x-before[i]),delta1=after.slice(3).map((x,i)=>x-before[i+3]);
 assert.notDeepEqual(delta0,delta1);assert.equal(pollen.material.depthWrite,false);assert.equal(pollen.material.depthTest,true);
 a.dispose();assert.ok(!world.scene.children.includes(pollen));
});
