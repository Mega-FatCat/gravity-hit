import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {foliageRendering} from '../src/foliage-rendering.js';

test('GH-40 foliage coverage widens only the alpha contour while retaining MSAA alpha coverage',()=>{
 const material=new T.MeshStandardMaterial({alphaTest:.28,alphaToCoverage:true,transparent:false,depthWrite:true});
 foliageRendering(material);
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 material.onBeforeCompile(shader);
 assert.match(shader.fragmentShader,/fwidth\(diffuseColor\.a\) \* 1\.35/);
 assert.match(shader.fragmentShader,/ALPHA_TO_COVERAGE/);
 assert.match(shader.fragmentShader,/opaque_fragment/);
 assert.equal(material.transparent,false);
 assert.equal(material.depthWrite,true);
 assert.equal(material.alphaToCoverage,true);
 assert.match(material.customProgramCacheKey(),/gh40-leaf-coverage-ramp-1/);
});
