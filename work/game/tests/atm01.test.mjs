import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Atmosphere,ATMOSPHERE_PHYSICS,SUPPLEMENTARY_POLLEN_COUNT,atmospherePathScattering} from '../src/atmosphere.js';

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

test('ATM-01 every preset keeps a bounded atmosphere target and explicit off bypasses depth',()=>{
 const {atmosphere:a}=fixture();
 a.setQuality('medium');assert.deepEqual(a.getDiagnostics().effectResolution,{width:460,height:259,scale:.24});assert.equal(a.sampleCount,24);
 a.setQuality('high');assert.equal(a.sampleCount,32);assert.equal(a.effectResolution.width,537);
 a.setQuality('low');assert.equal(a.sampleCount,12);assert.equal(a.effectResolution.width,345);assert.equal(a.needsDepth(),true);
 a.setEnabled(false);assert.equal(a.needsDepth(),false);
 a.dispose();assert.equal(a._volumeTarget,null);
});

test('ATM-01 independent pollen motion updates the uploaded buffer and releases owned resources',()=>{
 const {world,atmosphere:a}=fixture();const original=new Float32Array([0,1,0,1,1,1]);
 const pollen=a.createPollen(original);const before=Array.from(pollen.geometry.attributes.position.array);
 assert.equal(pollen.geometry.attributes.position.count,original.length/3+SUPPLEMENTARY_POLLEN_COUNT);
 assert.equal(pollen.userData.originalPollenCount,original.length/3);assert.equal(pollen.userData.supplementaryPollenCount,SUPPLEMENTARY_POLLEN_COUNT);
 assert.deepEqual(before.slice(0,original.length),Array.from(original));
 a.update(.05,{wind:.5});const after=Array.from(pollen.geometry.attributes.position.array);
 assert.notDeepEqual(after,before);assert.deepEqual(Array.from(original),before.slice(0,original.length));
 const delta0=after.slice(0,3).map((x,i)=>x-before[i]),delta1=after.slice(3,6).map((x,i)=>x-before[i+3]);
 assert.notDeepEqual(delta0,delta1);assert.equal(pollen.material.depthWrite,false);assert.equal(pollen.material.depthTest,true);
 a.dispose();assert.ok(!world.scene.children.includes(pollen));
});

test('ATM-01 continuous medium keeps short ground paths nonzero after the camera clip',()=>{
 const {atmosphere:a}=fixture();
 const shader=a._volumeMesh.material.fragmentShader;
 assert.match(shader,new RegExp(`float clipDistance=min\\(${ATMOSPHERE_PHYSICS.clipDistance.toFixed(3)}`));
 assert.match(shader,new RegExp(`float sigmaS=sigmaT\\*${ATMOSPHERE_PHYSICS.albedo.toFixed(2)}`));
 assert.equal(atmospherePathScattering(ATMOSPHERE_PHYSICS.clipDistance, a.sampleCount),0);
 const shortPath=atmospherePathScattering(.12,a.sampleCount);
 const groundPath=atmospherePathScattering(1.5,a.sampleCount);
 assert.ok(shortPath>0,'a 12 cm ground/inter-shrub path must scatter');
 assert.ok(groundPath>shortPath,'continuous medium should accumulate over the visible short path');
 a.dispose();
});
