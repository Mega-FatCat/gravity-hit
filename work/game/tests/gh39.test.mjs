import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {cleanPineTrunkGeometry} from '../src/environment.js';
import {normalizeLatheNormals,specularAntialiasing} from '../src/edge-quality.js';
import {isolateAtlasMask,foliageRendering,foliageDepthMaterial} from '../src/foliage-rendering.js';

test('GH-39 atlas extraction removes opaque exterior without erasing fractional needle edges',()=>{
 const w=9,h=9,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<w*h;i++){data[i*4+3]=255;const x=i%w,y=Math.floor(i/w);const v=(x===0||x===8||y===0||y===8)?255:(x>=3&&x<=5&&y>=3&&y<=5)?(x===3?64:255):0;data.fill(v,i*4,i*4+3);}
 const result=isolateAtlasMask(data,w,h);
 assert.equal(result[1],0);assert.equal(data[1],255);
 assert.equal(result[(3*w+3)*4+1],64);
 assert.equal(result[(4*w+4)*4+1],255);
});

test('GH-39 leaf transmission uses the occluded light and keeps the existing wind hook',()=>{
 const m=new T.MeshStandardMaterial({alphaTest:.16,alphaToCoverage:true});
 m.onBeforeCompile=s=>{s.uniforms.wind={value:7};};
 foliageRendering(m);
 const s={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 m.onBeforeCompile(s);
 const shadow=s.fragmentShader.indexOf('directLight.color *=',s.fragmentShader.indexOf('getDirectionalLightInfo'));
 const transmission=s.fragmentShader.indexOf('float leafNdotL');
 assert.ok(shadow>0&&transmission>shadow);
 assert.equal(s.uniforms.wind.value,7);
 assert.match(s.fragmentShader,/directLight.color \*/);
 assert.match(s.fragmentShader,/alphaTest\) \/ leafWidth \+ 0.5/);
 const d={uniforms:{},fragmentShader:T.ShaderLib.depth.fragmentShader};
 foliageDepthMaterial(m).onBeforeCompile(d);
 assert.equal(d.uniforms.leafShadowCutoff.value,.16);
 assert.match(d.fragmentShader,/diffuseColor.a < leafShadowCutoff/);
});

test('GH-39 trunk normals remain finite at every ring, including the tip',()=>{
 const g=cleanPineTrunkGeometry();
 const p=g.attributes.position,n=g.attributes.normal;
 for(let i=0;i<n.count;i++){
  assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
  assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6,`normal ${i}`);
 }
 // The silhouette retains the authored trunk size and buried root flare.
 assert.ok(Math.abs(g.boundingBox.min.y+.45)<1e-6);
 assert.equal(g.boundingBox.max.y,12.5);
 g.dispose();
});

test('GH-39 closed lathe has unit normals and continuous profile closure without moving vertices',()=>{
 const points=[[.00345,-.049],[.00405,-.0478],[.00334,-.034],[.00505,.0475],[.00466,.047],[.00272,-.033],[.003,.0-.049],[.00345,-.049]].map(p=>new T.Vector2(...p));
 const g=new T.LatheGeometry(points,96),before=Array.from(g.attributes.position.array);
 normalizeLatheNormals(g,true);
 const n=g.attributes.normal;
 assert.deepEqual(Array.from(g.attributes.position.array),before);
 for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-6);
 for(let i=0;i<n.count;i+=points.length){const j=i+points.length-1;assert.equal(n.getX(i),n.getX(j));assert.equal(n.getY(i),n.getY(j));assert.equal(n.getZ(i),n.getZ(j));}
});

test('GH-39 specular filtering composes with existing material hooks and uses final perturbed normals',()=>{
 const m=new T.MeshPhysicalMaterial();let invoked=0;
 m.onBeforeCompile=shader=>{invoked++;shader.uniforms.existing={value:2};};
 m.customProgramCacheKey=()=>'original';
 specularAntialiasing(m);
 const shader={uniforms:{},fragmentShader:'#include <normal_fragment_maps>\n#include <lights_physical_fragment>'};
 m.onBeforeCompile(shader);
 assert.equal(invoked,1);assert.equal(shader.uniforms.existing.value,2);
 assert.match(m.customProgramCacheKey(),/^original:/);
 assert.ok(shader.fragmentShader.indexOf('dFdx(normal)')>shader.fragmentShader.indexOf('<normal_fragment_maps>'));
 assert.match(shader.fragmentShader,/dFdx\(clearcoatNormal\)/);
});
