import * as T from 'three';
import {SMAAPass} from 'three/addons/postprocessing/SMAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {CopyShader} from 'three/addons/shaders/CopyShader.js';

// GH-39: operate on the completed display image. Rendering the forest into a
// new composer target would change where Three applies tone mapping relative
// to glass/alpha blending. A GPU framebuffer copy preserves that existing image.
export class FinalEdgePass {
 constructor(){
  this.mode='smaa';
  this.texture=null;this.size=new T.Vector2();
  this.viewport=new T.Vector4();this.scissor=new T.Vector4();this.clearColor=new T.Color();
  this.smaa=new SMAAPass();this.smaa.renderToScreen=true;this.smaa.clear=true;
  // Edge flags and area weights are normalized values, not HDR colors.
  // RGBA8 avoids two half-float buffers (16.6 MB saved at 1080p).
  this.smaa._edgesRT.texture.type=T.UnsignedByteType;
  this.smaa._weightsRT.texture.type=T.UnsignedByteType;
  this.smaa._materialEdges.defines.SMAA_THRESHOLD='0.05';
  this.smaa._materialWeights.defines.SMAA_MAX_SEARCH_STEPS='16';
  // The bundled SMAA blend decodes/encodes gamma itself. Use exact sRGB for
  // this already display-encoded input; flat pixels bypass the conversion.
  this.smaa._materialBlend.fragmentShader=this.smaa._materialBlend.fragmentShader
   .replace('pow(C.xyz, vec3(2.2))','sRGBTransferEOTF(C).rgb')
   .replace('pow(Cop.xyz, vec3(2.2))','sRGBTransferEOTF(Cop).rgb')
   .replace('pow(mixed.xyz, vec3(1.0 / 2.2))','sRGBTransferOETF(mixed).rgb');
  this.fxaa=new ShaderPass(FXAAShader);this.fxaa.renderToScreen=true;
  this.copy=new ShaderPass(CopyShader);this.copy.renderToScreen=true;
  for(const material of [this.smaa._materialEdges,this.smaa._materialWeights,this.smaa._materialBlend,this.fxaa.material,this.copy.material]){
   material.toneMapped=false;material.depthTest=false;material.depthWrite=false;
  }
 }
 render(renderer){
  if(this.mode==='off'||renderer.getRenderTarget()!==null)return;
  if(this.mode==='smaa'&&(!this.smaa._areaTexture.image.complete||!this.smaa._searchTexture.image.complete))return;
  renderer.getDrawingBufferSize(this.size);
  const {x:width,y:height}=this.size;
  if(!this.texture||this.texture.image.width!==width||this.texture.image.height!==height){
   this.texture?.dispose();this.texture=new T.FramebufferTexture(width,height);
   this.texture.minFilter=this.texture.magFilter=T.LinearFilter;
   this.smaa.setSize(width,height);this.fxaa.uniforms.resolution.value.set(1/width,1/height);
  }
  // No colorSpace annotation: sampling must retain the encoded pixel values.
  renderer.copyFramebufferToTexture(this.texture);
  const autoClear=renderer.autoClear,autoReset=renderer.info.autoReset;
  const scissorTest=renderer.getScissorTest(),alpha=renderer.getClearAlpha();
  renderer.getViewport(this.viewport);renderer.getScissor(this.scissor);renderer.getClearColor(this.clearColor);
  try{
   renderer.autoClear=false;renderer.info.autoReset=false;
   renderer.setScissorTest(false);renderer.setClearColor(0,0);
   const pass=this.mode==='copy'?this.copy:this.mode==='fxaa'?this.fxaa:this.smaa;
   pass.render(renderer,null,{texture:this.texture});
  }finally{
   renderer.setRenderTarget(null);renderer.setViewport(this.viewport);renderer.setScissor(this.scissor);renderer.setScissorTest(scissorTest);
   renderer.setClearColor(this.clearColor,alpha);renderer.autoClear=autoClear;renderer.info.autoReset=autoReset;
  }
 }
 dispose(){this.texture?.dispose();this.smaa.dispose();this.fxaa.dispose();this.copy.dispose();}
}
