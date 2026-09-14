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
 // Different contour widths must not reuse a compiled shader. The previous
 // assertion pinned an internal version string and missed this actual contract.
 const wider=new T.MeshStandardMaterial({alphaTest:.28,alphaToCoverage:true});
 foliageRendering(wider,.32,.42,1.0,1.90);
 assert.notEqual(material.customProgramCacheKey(),wider.customProgramCacheKey());
 const wideShader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
 wider.onBeforeCompile(wideShader);
 assert.match(wideShader.fragmentShader,/fwidth\(diffuseColor\.a\) \* 1\.90/);
});
