import {ShaderChunk,MeshDepthMaterial,RGBADepthPacking,CanvasTexture} from 'three';
import {specularAntialiasing} from './edge-quality.js';

// Analytical cutout coverage, following Ben Golus' Alpha To Coverage method:
// https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f
// Centre the transition on the authored contour. Only the intersected pixel
// gets partial coverage; leaf interiors still write opaque depth samples.
export const foliageCoverage = `
 #ifdef USE_ALPHATEST
  #ifdef ALPHA_TO_COVERAGE
   // A single-pixel alpha contour is too abrupt on the four-sample path.
   // Widen only the analytical transition; leaf interiors remain opaque and
   // the authored density/coverage is unchanged.
   float leafWidth = max(fwidth(diffuseColor.a) * 1.35, 0.0001);
   diffuseColor.a = clamp((diffuseColor.a - alphaTest) / leafWidth + 0.5, 0.0, 1.0);
   if (diffuseColor.a == 0.0) discard;
  #else
   if (diffuseColor.a < alphaTest) discard;
  #endif
 #endif
`;

// A thin-leaf approximation, not transparency. Reuse the light *after* its
// shadow lookup so an occluded leaf cannot glow through an opaque neighbour.
// The bounded wrap redistributes front diffuse instead of adding another sun.
export function foliageRendering(material, transmission = 0.32, skyTransmission = 0.42, transmissionColorPower = 1.0) {
 material.userData.foliage=true;
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.onBeforeCompile=function(shader,renderer){
  compile.call(this,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',foliageCoverage);
  const begin=ShaderChunk.lights_fragment_begin;
  const start=begin.indexOf('#if ( NUM_DIR_LIGHTS > 0 )');
  const end=begin.indexOf('#if ( NUM_RECT_AREA_LIGHTS > 0 )',start);
  const direct='RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const directional=begin.slice(start,end).replace(direct,`${direct}
   float leafNdotL = dot(geometryNormal, directLight.direction);
   float leafWrap = max(0.0, leafNdotL + 0.25) / 1.5625;
   float leafBack = max(0.0, -dot(nonPerturbedNormal, directLight.direction));
   float leafForward = pow(max(dot(geometryViewDir, -directLight.direction), 0.0), 2.0);
   vec3 leafTransmit = vec3(0.55, 0.85, 0.35) * ${transmission.toFixed(3)} * leafBack * (0.35 + 0.65 * leafForward);
   reflectedLight.directDiffuse += RECIPROCAL_PI * directLight.color *
    (material.diffuseColor * (leafWrap - max(0.0, leafNdotL)) + leafTransmissionColor * leafTransmit);
  `);
  // Reflected albedo and tissue transmission are distinct. For the pine atlas
  // (which has dark baked shading), use a shorter absorption path estimate.
  // This changes transmitted light only, keeping photographed surface detail.
  const transmissionColor=`vec3 leafTransmissionColor = pow(max(material.diffuseColor,vec3(0.0)),vec3(${transmissionColorPower.toFixed(3)}));\n`;
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',transmissionColor+begin.slice(0,start)+directional+begin.slice(end));
  // Diffuse sky light also passes through thin tissue. Use the actual scene
  // hemisphere in view space (transformed by Three), never camera-space "up"
  // or unoccluded direct sunlight. The normal AO stage still attenuates this.
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   #if NUM_HEMI_LIGHTS > 0
    #pragma unroll_loop_start
    for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
     reflectedLight.indirectDiffuse += getHemisphereLightIrradiance(hemisphereLights[i], -geometryNormal) *
      leafTransmissionColor * RECIPROCAL_PI * vec3(0.55, 0.85, 0.35) * ${skyTransmission.toFixed(3)};
    }
    #pragma unroll_loop_end
    #endif
   `);
  };
 material.customProgramCacheKey=()=>`${key}:gh40-leaf-coverage-ramp-1:${transmission}:${skyTransmission}:${transmissionColorPower}`;
 return specularAntialiasing(material);
}

// Three r180 substitutes a fixed .5 shadow cutoff for A2C. Keep the shadow
// contour consistent with our material cutoff, without multisampling shadows.
export function foliageDepthMaterial(material,world) {
 const depth=new MeshDepthMaterial({depthPacking:RGBADepthPacking});
 if(world&&material.userData.foliageWind)world.addWind(depth,material.userData.foliageWind);
 const compile=depth.onBeforeCompile,key=depth.customProgramCacheKey();
 depth.onBeforeCompile=shader=>{
  compile.call(depth,shader);
  shader.uniforms.leafShadowCutoff={value:material.alphaTest};
  shader.fragmentShader='uniform float leafShadowCutoff;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`
   #ifdef USE_ALPHATEST
    if (diffuseColor.a < leafShadowCutoff) discard;
   #endif
  `);
 };
 depth.customProgramCacheKey=()=>`${key}:gh39-leaf-shadow-1`;
 return depth;
}

// The pine atlas includes opaque bark outside the black collar around the
// needle island. Remove border-connected background before generating mips.
// Preserve original antialiased values on the enclosed needle island.
export function isolateAtlasMask(data,width,height) {
 const output=new Uint8ClampedArray(data),seen=new Uint8Array(width*height);
 const queue=new Int32Array(width*height);let head=0,tail=0;
 const visit=i=>{if(!seen[i]&&data[i*4+1]>0){seen[i]=1;queue[tail++]=i;}};
 for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
 for(let y=0;y<height;y++){visit(y*width);visit(y*width+width-1);}
 while(head<tail){const i=queue[head++],x=i%width,y=Math.floor(i/width);
  output[i*4]=output[i*4+1]=output[i*4+2]=0;
  if(x)visit(i-1);if(x<width-1)visit(i+1);if(y)visit(i-width);if(y<height-1)visit(i+width);
 }
 return output;
}

const pineTiles=new WeakMap();
export function pineNeedleTile(alphaMap,diffuseMap) {
 if(pineTiles.has(diffuseMap))return pineTiles.get(diffuseMap);
 const image=alphaMap.image;
 // This box contains the complete first needle island plus a black gutter.
 const width=Math.round(image.width*.26),height=Math.round(image.height*.46);
 const mask=document.createElement('canvas');mask.width=width;mask.height=height;
 const ctx=mask.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,width,height);
 pixels.data.set(isolateAtlasMask(pixels.data,width,height));ctx.putImageData(pixels,0,0);
 const color=document.createElement('canvas');
 color.width=Math.round(diffuseMap.image.width*.26);color.height=Math.round(diffuseMap.image.height*.46);
 color.getContext('2d').drawImage(diffuseMap.image,0,0);
 const alpha=new CanvasTexture(mask),map=new CanvasTexture(color);
 for(const texture of [alpha,map]){texture.flipY=false;texture.anisotropy=8;}
 map.colorSpace=diffuseMap.colorSpace;
 const result={alpha,map};pineTiles.set(diffuseMap,result);return result;
}
