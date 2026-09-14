import * as T from 'three';

// ATM-01 is deliberately a small, bounded participating-medium pass.  The
// scene already has the two expensive inputs we need: an opaque depth target
// from stream-water.js and the directional light's packed shadow map.  This
// class only owns a low-resolution scattering target and a pair of full-screen
// materials; it never draws the forest a second time.
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const WHITE_PIXEL=new Uint8Array([255,255,255,255]);

export const ATMOSPHERE_QUALITY=Object.freeze({
 low:{scale:0,samples:0},
 medium:{scale:1/3,samples:40},
 high:{scale:.5,samples:64},
});
const QUALITY=ATMOSPHERE_QUALITY;

// Keep the CPU contract and the generated GLSL on the same physical knobs.
// Single-scattering albedo stays below one. The existing scene fog still owns
// background attenuation; this pass adds the integrated sun radiance.
export const ATMOSPHERE_PHYSICS=Object.freeze({
 clipDistance:.05,
 extinction:.025,
 albedo:.74,
 heightReference:.15,
 heightFalloff:.48,
 distanceFalloff:.032,
 samplePower:1.38,
 });

// These controls shape how the existing physical shadow visibility is
// presented. They are intentionally separate from ATMOSPHERE_PHYSICS: the
// gap lift is an artistic radiance gain for readable shafts, not a claim of
// fully physical transport. The volume compare is kept tighter than the
// former .00035 guard so a narrow illuminated column is not eaten away by a
// roughly 3 cm normalized-depth margin in the 89 m shadow camera range.
export const ATMOSPHERE_ARTISTIC=Object.freeze({
 volumeShadowBias:.00012,
 canopyGapGain:2.4,
 canopyGapMax:3.0,
 canopyGapPower:.72,
 canopyGapEdgeLow:.34,
 canopyGapEdgeHigh:.62,
 canopyGapNearStart:.35,
 canopyGapNearEnd:1.0,
 canopyGapFarStart:5.0,
 canopyGapFarEnd:8.0,
 canopyGapFarScale:.22,
 pollenShadedFloor:.045,
 pollenAlpha:.72,
 });

// These points are generated inside this module so the original world RNG
// stream and its 180 authored positions remain untouched. They are small,
// player-near understory dust particles, rather than a second visual effect.
export const SUPPLEMENTARY_POLLEN_COUNT=420;

function stableUnit(index,salt){
 const value=Math.sin((index+1)*12.9898+salt*78.233)*43758.5453;
 return value-Math.floor(value);
}

const MEDIUM_FIELD_GLSL=`
float atmoHash3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float atmoNoise3(vec3 p){
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 float n000=atmoHash3(i),n100=atmoHash3(i+vec3(1,0,0)),n010=atmoHash3(i+vec3(0,1,0)),n110=atmoHash3(i+vec3(1,1,0));
 float n001=atmoHash3(i+vec3(0,0,1)),n101=atmoHash3(i+vec3(1,0,1)),n011=atmoHash3(i+vec3(0,1,1)),n111=atmoHash3(i+vec3(1,1,1));
 return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y),f.z);
}
float atmoMediumField(vec3 p){
 float broad=atmoNoise3(p*vec3(.12,.09,.12)+vec3(3.0,-.5,9.0));
 float detail=atmoNoise3(p*vec3(.28,.22,.28)-vec3(7.0,2.0,4.0));
 return clamp(.82+.30*(broad-.5)+.10*(detail-.5),.48,1.10);
}
`;

// Small CPU-side contract used by the unit suite to guard the physical intent
// of the shader: after the 5 cm camera clip, a short ground-level path still
// has non-zero in-scattering. The live integration uses the same sigma values
// and segment layout in GLSL.
export function atmospherePathScattering(distance,samples=40){
 const d=Math.max(0,Number(distance)||0),count=Math.max(1,Math.floor(samples));
 const clip=Math.min(ATMOSPHERE_PHYSICS.clipDistance,d),path=Math.max(0,d-clip);
 if(path<=0)return 0;
 let transmittance=1,scattered=0;
 for(let i=0;i<count;i++){
  const u0=i/count,u1=(i+1)/count;
  const t0=clip+path*Math.pow(u0,ATMOSPHERE_PHYSICS.samplePower),t1=clip+path*Math.pow(u1,ATMOSPHERE_PHYSICS.samplePower);
  const t=.5*(t0+t1),segment=Math.max(.0001,t1-t0);
  const sigmaT=ATMOSPHERE_PHYSICS.extinction*Math.exp(-t*ATMOSPHERE_PHYSICS.distanceFalloff),sigmaS=sigmaT*ATMOSPHERE_PHYSICS.albedo;
  const segmentTrans=Math.exp(-sigmaT*segment);
  const scatterWeight=(1-segmentTrans)*(sigmaS/Math.max(.00001,sigmaT));
  scattered+=transmittance*scatterWeight*.62;
  transmittance*=segmentTrans;
 }
 return scattered;
}

const PACKED_DEPTH_GLSL=`
const float ATMO_UNPACK_DOWNSCALE = 255.0 / 256.0;
const vec4 ATMO_UNPACK_FACTORS4 = vec4(
 ATMO_UNPACK_DOWNSCALE,
 ATMO_UNPACK_DOWNSCALE / 256.0,
 ATMO_UNPACK_DOWNSCALE / 65536.0,
 1.0 / 16777216.0
);
float atmoUnpackRGBAToDepth(const in vec4 value){return dot(value,ATMO_UNPACK_FACTORS4);}
float atmoPerspectiveDepthToViewZ(const in float depth,const in float nearClip,const in float farClip){
 return (nearClip*farClip)/((farClip-nearClip)*depth-farClip);
}
`;

const VOLUME_VERTEX=`
varying vec2 vUv;
void main(){
 vUv=uv;
 gl_Position=vec4(position.xy,0.0,1.0);
}
`;

function volumeFragment(samples){
 return `
uniform sampler2D uOpaqueDepth;
uniform sampler2D uShadowMap;
uniform mat4 uProjectionInverse;
uniform mat4 uCameraWorld;
uniform mat4 uShadowMatrix;
uniform vec3 uSunDirection;
uniform vec3 uSunColor;
uniform vec2 uShadowMapSize;
uniform vec2 uCameraRange;
uniform float uSunIntensity;
uniform float uHasDepth;
uniform float uHasShadow;
uniform float uMaxDistance;
varying vec2 vUv;
${PACKED_DEPTH_GLSL}

vec3 atmoWorldFromClip(vec3 clip){
 vec4 p=uProjectionInverse*vec4(clip,1.0);
 p/=max(.000001,p.w);
 return (uCameraWorld*p).xyz;
}

${MEDIUM_FIELD_GLSL}

// The map is the same RGBA packed depth representation used by Three r180's
// shadowmap_pars_fragment chunk. A five tap PCF footprint is enough to soften
// shafts at the existing PCFSoft shadow-map resolution without multiplying the
// full 17-tap surface-lighting lookup across every ray step.
vec2 atmoShadowVisibility(vec3 worldPosition){
 if(uHasShadow<.5)return vec2(.62);
 vec4 sc=uShadowMatrix*vec4(worldPosition,1.0);
 sc.xyz/=max(.000001,sc.w);
 vec2 uv=sc.xy;
 float z=sc.z;
 float inside=step(0.0,uv.x)*step(uv.x,1.0)*step(0.0,uv.y)*step(uv.y,1.0)*step(0.0,z)*step(z,1.0);
 if(inside<.5)return vec2(0.0);
 vec2 texel=1.0/max(vec2(1.0),uShadowMapSize);
 float compare=z+${ATMOSPHERE_ARTISTIC.volumeShadowBias.toFixed(5)};
 float lit=0.0;
 lit+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv)))*.36;
 lit+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv+vec2(texel.x,0.0))))*.16;
 lit+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv-vec2(texel.x,0.0))))*.16;
 lit+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv+vec2(0.0,texel.y))))*.16;
 lit+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv-vec2(0.0,texel.y))))*.16;
 // Fade toward the finite shadow camera boundary instead of producing a
 // hard unshadowed seam where the frustum ends.
 float edge=min(min(uv.x,1.0-uv.x),min(uv.y,1.0-uv.y));
 float edgeFade=smoothstep(.015,.12,edge);
 edgeFade*=smoothstep(.015,.12,z)*(1.0-smoothstep(.84,.985,z));
 // Existing distance fog supplies the uniform airlight. Emphasize narrow
 // illuminated gaps surrounded by real canopy shadows, rather than raising
 // haze everywhere in the open clearing. This light-space footprint moves
 // with the actual sun and its casters, independently of the camera.
 vec2 gapOffset=texel*44.0;
 float nearby=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv+vec2(gapOffset.x,0.0))));
 nearby+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv-vec2(gapOffset.x,0.0))));
 nearby+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv+vec2(0.0,gapOffset.y))));
 nearby+=step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,uv-vec2(0.0,gapOffset.y))));
 return vec2(lit*edgeFade,(1.0-nearby*.25)*lit*edgeFade);
}

void main(){
 vec3 rayOrigin=atmoWorldFromClip(vec3(vUv*2.0-1.0,-1.0));
 vec3 rayFar=atmoWorldFromClip(vec3(vUv*2.0-1.0,1.0));
 vec3 rayDirection=normalize(rayFar-rayOrigin);
 float sceneDistance=uMaxDistance;
 float sceneDepthMetric=1.0;
 float rawDepth=1.0;
 if(uHasDepth>.5){
  rawDepth=texture2D(uOpaqueDepth,vUv).x;
  vec3 scenePoint=atmoWorldFromClip(vec3(vUv*2.0-1.0,rawDepth*2.0-1.0));
  sceneDistance=min(uMaxDistance,max(.05,distance(rayOrigin,scenePoint)));
  sceneDepthMetric=clamp(-atmoPerspectiveDepthToViewZ(rawDepth,uCameraRange.x,uCameraRange.y)/max(.001,uCameraRange.y),0.0,1.0);
 }
 float clipDistance=min(${ATMOSPHERE_PHYSICS.clipDistance.toFixed(3)},sceneDistance);
 float pathDistance=max(0.0,sceneDistance-clipDistance);
 float mediumEnabled=step(.000001,pathDistance);
 float optical=0.0;
 vec3 scattered=vec3(0.0);
 // Fixed midpoint samples are intentional: camera movement must not produce
 // temporal shimmer in the shafts or a noisy, animated sky.
 for(int i=0;i<${samples};i++){
  float u0=float(i)/float(${samples});
  float u1=float(i+1)/float(${samples});
  // A power-law parameterization spends more samples in the first few metres
  // where the player sees ground, stream edges and inter-shrub air columns.
  float t0=clipDistance+pathDistance*pow(u0,${ATMOSPHERE_PHYSICS.samplePower.toFixed(2)});
  float t1=clipDistance+pathDistance*pow(u1,${ATMOSPHERE_PHYSICS.samplePower.toFixed(2)});
  float t=.5*(t0+t1);
  float segmentLength=max(.0001,t1-t0);
  vec3 p=rayOrigin+rayDirection*t;
  float heightDensity=exp(-max(p.y-${ATMOSPHERE_PHYSICS.heightReference.toFixed(2)},0.0)*${ATMOSPHERE_PHYSICS.heightFalloff.toFixed(2)});
  float distanceFade=exp(-t*${ATMOSPHERE_PHYSICS.distanceFalloff.toFixed(3)});
  float aerosol=atmoMediumField(p);
  vec2 shadow=atmoShadowVisibility(p);
  // Aerosol exists continuously in ground and canopy air. Shadows only
  // modulate the light reaching it, so downward and side-lit rays retain a
  // coherent short-path presence instead of disappearing in gaps.
  float sigmaT=${ATMOSPHERE_PHYSICS.extinction.toFixed(4)}*aerosol*heightDensity*distanceFade;
  float sigmaS=sigmaT*${ATMOSPHERE_PHYSICS.albedo.toFixed(2)};
  float phaseCos=dot(rayDirection,uSunDirection);
  float g=.20;
  float hg=(1.0-g*g)/pow(max(.001,1.0+g*g-2.0*g*phaseCos),1.5);
  float phase=mix(1.0,hg,.50);
 float gapLight=clamp(shadow.y,0.0,1.0);
  // The clearing immediately around the camera is broadly sunlit. Keep its
  // base contribution quiet, then lift only a genuinely lit sample whose
  // four-tap neighborhood is interrupted by real shadow. The common .25
  // coverage value is an edge between foliage layers, so it must not become
  // a full-frame airlight source; stronger breaks retain the original source
  // response and receive the bounded artistic lift below.
  float gapSource=smoothstep(${ATMOSPHERE_ARTISTIC.canopyGapEdgeLow.toFixed(2)},.72,gapLight)*pow(gapLight,1.20);
  float baseDirect=clamp(.008+shadow.x*.13+gapSource*.85,0.0,1.0);
 float gapEdge=smoothstep(${ATMOSPHERE_ARTISTIC.canopyGapEdgeLow.toFixed(2)},${ATMOSPHERE_ARTISTIC.canopyGapEdgeHigh.toFixed(2)},gapLight);
 float gapLit=smoothstep(.35,.85,shadow.x);
 float gapPath=smoothstep(${ATMOSPHERE_ARTISTIC.canopyGapNearStart.toFixed(2)},${ATMOSPHERE_ARTISTIC.canopyGapNearEnd.toFixed(2)},t);
 gapPath*=1.0-${(1-ATMOSPHERE_ARTISTIC.canopyGapFarScale).toFixed(2)}*smoothstep(${ATMOSPHERE_ARTISTIC.canopyGapFarStart.toFixed(2)},${ATMOSPHERE_ARTISTIC.canopyGapFarEnd.toFixed(2)},t);
 float gapContrast=gapEdge*pow(gapLight,${ATMOSPHERE_ARTISTIC.canopyGapPower.toFixed(2)})*gapLit*gapPath;
 float artisticSunScatteringGain=min(${ATMOSPHERE_ARTISTIC.canopyGapMax.toFixed(2)},1.0+${ATMOSPHERE_ARTISTIC.canopyGapGain.toFixed(2)}*gapContrast);
 float direct=baseDirect*artisticSunScatteringGain;
  float segmentTrans=exp(-sigmaT*segmentLength);
  float scatterWeight=(1.0-segmentTrans)*(sigmaS/max(.00001,sigmaT))*mediumEnabled;
  vec3 tint=uSunColor*uSunIntensity;
  scattered+=(1.0-optical)*scatterWeight*tint*phase*direct;
  optical=1.0-segmentTrans*(1.0-optical);
 }

 gl_FragColor=vec4(scattered,sceneDepthMetric);
}
`;
}

const COMPOSITE_DECLARATIONS=`
uniform sampler2D atmosphereTexture;
uniform vec2 atmosphereSize;
uniform vec2 atmosphereCameraRange;
uniform float atmosphereEnabled;
uniform vec2 atmosphereSunUV;
uniform float atmosphereSunAspect;
uniform vec3 atmosphereSunColor;
uniform float atmosphereSunIntensity;
uniform float atmosphereSunForward;
uniform float atmosphereTanHalfFov;

float atmoPerspectiveDepthToViewZ(const in float depth,const in float nearClip,const in float farClip){
 return (nearClip*farClip)/((farClip-nearClip)*depth-farClip);
}

vec4 atmoSample(vec2 uv,float sceneDepth){
 vec2 texel=1.0/max(vec2(1.0),atmosphereSize);
 vec2 cell=uv*atmosphereSize-.5;
 vec2 base=floor(cell),blend=fract(cell);
 vec4 sum=vec4(0.0);
 float total=0.0;
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec2 corner=vec2(float(x),float(y));
  vec2 p=clamp((base+corner+.5)*texel,texel*.5,1.0-texel*.5);
  vec4 s=texture2D(atmosphereTexture,p);
  float depthWeight=exp(-abs(s.a-sceneDepth)*atmosphereCameraRange.y/(.10+.03*sceneDepth*atmosphereCameraRange.y));
  vec2 weightXY=mix(1.0-blend,blend,corner);
  float weight=weightXY.x*weightXY.y*depthWeight;
  sum+=s*weight;
  total+=weight;
 }
 return sum/max(.0001,total);
}
`;

export class Atmosphere {
 constructor(world){
  this.world=world;
  this.enabled=true;
  this.quality='medium';
  this.effectResolution={width:0,height:0,scale:QUALITY.medium.scale};
  this.sampleCount=QUALITY.medium.samples;
  this.depthTexture=null;
  this._lastShadowTexture=null;
  this._lastPrepared=false;
  this._sourceSize=new T.Vector2();
  this._viewport=new T.Vector4();
  this._scissor=new T.Vector4();
  this._clearColor=new T.Color();
  this._sunDirection=V();
  this._sunTarget=V();
  this._dummyShadow=new T.DataTexture(WHITE_PIXEL,1,1,T.RGBAFormat,T.UnsignedByteType);
  this._dummyShadow.colorSpace=T.NoColorSpace;
  this._dummyShadow.needsUpdate=true;
  this._volumeScene=new T.Scene();
  this._volumeCamera=new T.Camera();
  this._volumeCamera.matrixAutoUpdate=false;
  this._volumeMesh=new T.Mesh(new T.PlaneGeometry(2,2),new T.ShaderMaterial({
   uniforms:{
    uOpaqueDepth:{value:null},uShadowMap:{value:this._dummyShadow},
    uProjectionInverse:{value:new T.Matrix4()},uCameraWorld:{value:new T.Matrix4()},uShadowMatrix:{value:new T.Matrix4()},
    uSunDirection:{value:new T.Vector3(0,1,0)},uSunColor:{value:new T.Color(1,1,1)},uShadowMapSize:{value:new T.Vector2(1,1)},
    uCameraRange:{value:new T.Vector2(.025,150)},uSunIntensity:{value:1},uHasDepth:{value:0},uHasShadow:{value:0},uMaxDistance:{value:40},
   },vertexShader:VOLUME_VERTEX,fragmentShader:volumeFragment(this.sampleCount),depthTest:false,depthWrite:false,transparent:false,toneMapped:false,
  }));
  this._volumeMesh.frustumCulled=false;this._volumeScene.add(this._volumeMesh);
  this._volumeTarget=null;
  this._compositeMaterial=null;
  this._compositeUniforms=null;
  this._pollenData=null;
  this.pollen=null;
  this._pollenTime=0;
 }

 setEnabled(value){this.enabled=value!==false;return this.enabled;}

 setQuality(value){
  const q=QUALITY[value]??QUALITY.medium;
  this.quality=QUALITY[value]?value:'medium';
  this.sampleCount=q.samples;
  this.effectResolution.scale=q.scale;
  if(!q.samples){this.effectResolution.width=0;this.effectResolution.height=0;}
  const material=this._volumeMesh.material;
  material.fragmentShader=volumeFragment(Math.max(1,this.sampleCount));
  material.needsUpdate=true;
  this._resizeTarget(true);
 }

 isActive(){return this.enabled&&this.sampleCount>0;}
 needsDepth(){return this.isActive();}

 _resizeTarget(force=false){
  if(!this.world?.renderer||!this.isActive())return;
  this.world.renderer.getDrawingBufferSize(this._sourceSize);
  const width=Math.max(1,Math.floor(this._sourceSize.x*this.effectResolution.scale));
  const height=Math.max(1,Math.floor(this._sourceSize.y*this.effectResolution.scale));
  this.effectResolution.width=width;this.effectResolution.height=height;
  if(!this._volumeTarget){
   this._volumeTarget=new T.WebGLRenderTarget(width,height,{depthBuffer:false,stencilBuffer:false,type:T.HalfFloatType,minFilter:T.NearestFilter,magFilter:T.NearestFilter});
   this._volumeTarget.texture.colorSpace=T.NoColorSpace;
  }else if(force||this._volumeTarget.width!==width||this._volumeTarget.height!==height){
   this._volumeTarget.setSize(width,height);
  }
 }

 resize(){this._resizeTarget(true);}

 createPollen(positionArray){
  const source=positionArray instanceof Float32Array?positionArray:Float32Array.from(positionArray);
  const originalCount=source.length/3;
  const count=originalCount+SUPPLEMENTARY_POLLEN_COUNT;
  const positions=new Float32Array(count*3);positions.set(source);
  for(let i=0;i<SUPPLEMENTARY_POLLEN_COUNT;i++){
   const j=originalCount+i;
   // Keep the additions close to the play space and concentrate them below
   // head height, where a few illuminated points read as dust between shrubs.
   positions[j*3]=(stableUnit(i,11.17)-.5)*6.8;
   positions[j*3+1]=.15+1.65*Math.pow(stableUnit(i,23.71),1.45);
   positions[j*3+2]=-1.8+stableUnit(i,37.29)*6.2;
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  const sizes=new Float32Array(count),phases=new Float32Array(count);
  for(let i=0;i<count;i++){
   // Deterministic variation keeps the particles calm and avoids touching the
   // shared world placement RNG used by rain, foliage and streambed assets.
   if(i<originalCount){
    const h=Math.sin(i*12.9898+78.233)*43758.5453;
    const f=h-Math.floor(h);
    sizes[i]=.010+.012*f;phases[i]=(Math.sin(i*7.123+1.7)*.5+.5)*Math.PI*2;
   }else{
    const f=stableUnit(i,78.233);
    sizes[i]=.007+.008*f;phases[i]=stableUnit(i,41.63)*Math.PI*2;
   }
  }
  geometry.setAttribute('aSize',new T.Float32BufferAttribute(sizes,1));
  geometry.setAttribute('aPhase',new T.Float32BufferAttribute(phases,1));
  const material=new T.ShaderMaterial({
   uniforms:{
    uTime:{value:0},uWind:{value:.5},uSunDirection:{value:new T.Vector3(0,1,0)},
    uShadowMap:{value:this._dummyShadow},uShadowMatrix:{value:new T.Matrix4()},uShadowMapSize:{value:new T.Vector2(1,1)},uHasShadow:{value:0},
   },
   vertexShader:`
attribute float aSize;attribute float aPhase;
uniform float uTime;uniform float uWind;uniform vec3 uSunDirection;
uniform sampler2D uShadowMap;uniform mat4 uShadowMatrix;uniform vec2 uShadowMapSize;uniform float uHasShadow;
varying float vIllum;
${PACKED_DEPTH_GLSL}
float pollenShadow(vec3 p){
 if(uHasShadow<.5)return .62;
 vec4 sc=uShadowMatrix*vec4(p,1.0);sc.xyz/=max(.000001,sc.w);
 if(sc.x<0.0||sc.x>1.0||sc.y<0.0||sc.y>1.0||sc.z<0.0||sc.z>1.0)return 0.0;
 vec2 texel=1.0/max(vec2(1.0),uShadowMapSize);
 float compare=sc.z+${ATMOSPHERE_ARTISTIC.volumeShadowBias.toFixed(5)};
 float lit=.36*step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,sc.xy)));
 lit+=.16*step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,sc.xy+vec2(texel.x,0.0))));
 lit+=.16*step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,sc.xy-vec2(texel.x,0.0))));
 lit+=.16*step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,sc.xy+vec2(0.0,texel.y))));
 lit+=.16*step(compare,atmoUnpackRGBAToDepth(texture2D(uShadowMap,sc.xy-vec2(0.0,texel.y))));
 float edge=min(min(sc.x,1.0-sc.x),min(sc.y,1.0-sc.y));
 return lit*smoothstep(.015,.12,edge);
}
${MEDIUM_FIELD_GLSL}
void main(){
 vec3 p=position;
 float phase=aPhase;
 p.x+=sin(uTime*.17+phase+p.z*.28)*.045+cos(uTime*.071+phase*1.7)*.025;
 p.z+=cos(uTime*.13+phase*1.3+p.x*.22)*.035+sin(uTime*.083+phase*.6)*.018;
 p.y+=sin(uTime*.11+phase*1.9)*.018;
 vec4 worldPosition=modelMatrix*vec4(p,1.0);
 vec4 viewPosition=viewMatrix*worldPosition;
 gl_Position=projectionMatrix*viewPosition;
 gl_PointSize=clamp(aSize*(260.0/max(.1,-viewPosition.z)),.7,3.5);
 float shadow=pollenShadow(worldPosition.xyz);
 float upLight=max(.0,uSunDirection.y);
 float field=atmoMediumField(worldPosition.xyz);
 // Keep shaded grains barely present while giving genuinely lit grains a
 // compact, warm catchlight. The fractional power recovers useful sparkle
 // from the partial .16--.25 shadow values without making fully shadowed
 // grains look like snow or fireflies.
 float litResponse=pow(clamp(shadow,0.0,1.0),.62);
 float lightResponse=${ATMOSPHERE_ARTISTIC.pollenShadedFloor.toFixed(3)}+(1.0-${ATMOSPHERE_ARTISTIC.pollenShadedFloor.toFixed(3)})*litResponse*(.68+.32*upLight);
 vIllum=clamp(lightResponse*field,${ATMOSPHERE_ARTISTIC.pollenShadedFloor.toFixed(3)},1.0);
}
`,
   fragmentShader:`
varying float vIllum;
void main(){
 float d=length(gl_PointCoord-vec2(.5));
 float alpha=(1.0-smoothstep(.08,.5,d))*${ATMOSPHERE_ARTISTIC.pollenAlpha.toFixed(2)}*vIllum;
 if(alpha<.012)discard;
 gl_FragColor=vec4(vec3(.92,.86,.62)*(.72+.28*vIllum),alpha);
 #include <colorspace_fragment>
}
`,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,
  });
  const points=new T.Points(geometry,material);points.name='Individual forest dust';points.frustumCulled=false;
  points.userData.originalPollenCount=originalCount;points.userData.supplementaryPollenCount=SUPPLEMENTARY_POLLEN_COUNT;
  this.world.scene.add(points);this.pollen=points;this._pollenData=geometry.attributes.position.array;
  return points;
 }

 update(dt,settings={}){
  this._pollenTime+=Math.max(0,dt);
  if(this.pollen){
   const p=this._pollenData,wind=Number(settings.wind??this.world.wind??.5),time=this._pollenTime;
   for(let i=0;i<p.length;i+=3){
    const index=i/3,phase=(Math.sin(index*7.123+1.7)*.5+.5)*Math.PI*2;
    p[i]+=dt*(.006*wind+.003*Math.sin(time*.37+phase));
    p[i+1]+=dt*(.002*Math.sin(time*.23+phase*1.4)+.0015);
    p[i+2]+=dt*(.004*Math.cos(time*.29+phase*.8));
    if(p[i]>7.3)p[i]=-7.3;if(p[i]<-7.3)p[i]=7.3;
    if(p[i+2]>4.3)p[i+2]=-7.3;if(p[i+2]<-7.3)p[i+2]=4.3;
    if(p[i+1]>3.35)p[i+1]=.15;if(p[i+1]<.15)p[i+1]=3.35;
   }
   this.pollen.geometry.attributes.position.needsUpdate=true;
   const u=this.pollen.material.uniforms,sun=this.world.sun,target=sun?.target?.getWorldPosition?.(V())??V();
   sun.getWorldPosition(this._sunDirection).sub(target).normalize();
   u.uTime.value=time;u.uWind.value=wind;u.uSunDirection.value.copy(this._sunDirection);
   u.uShadowMap.value=sun?.shadow?.map?.texture??this._dummyShadow;u.uHasShadow.value=sun?.shadow?.map?.texture&&this.world.renderer.shadowMap.enabled?1:0;
   u.uShadowMatrix.value.copy(sun?.shadow?.matrix??new T.Matrix4());u.uShadowMapSize.value.set(sun?.shadow?.map?.width??1,sun?.shadow?.map?.height??1);
  }
 }

 _updateUniforms(renderer,camera,depthTexture){
  this._resizeTarget();
  const sun=this.world.sun;
  if(sun?.target){sun.target.getWorldPosition(this._sunTarget);}else this._sunTarget.set(0,0,0);
  sun.getWorldPosition(this._sunDirection).sub(this._sunTarget).normalize();
  const shadow=sun?.shadow;
  const map=shadow?.map?.texture??null;
  const u=this._volumeMesh.material.uniforms;
  u.uOpaqueDepth.value=depthTexture??null;
  u.uShadowMap.value=map??this._dummyShadow;
  u.uHasDepth.value=depthTexture?1:0;
  u.uHasShadow.value=map&&this.world.renderer.shadowMap.enabled?1:0;
  u.uProjectionInverse.value.copy(camera.projectionMatrixInverse);
  u.uCameraWorld.value.copy(camera.matrixWorld);
  if(shadow?.matrix)u.uShadowMatrix.value.copy(shadow.matrix);
  u.uSunDirection.value.copy(this._sunDirection);
  u.uSunColor.value.copy(sun?.color??new T.Color(1,1,1));
  u.uSunIntensity.value=Math.max(0,sun?.intensity??1);
  u.uShadowMapSize.value.set(shadow?.map?.width??1,shadow?.map?.height??1);
  u.uCameraRange.value.set(camera.near,camera.far);
  u.uMaxDistance.value=Math.min(24,Math.max(8,camera.far*.20));
  this.depthTexture=depthTexture??null;
  this._lastShadowTexture=map;
  if(this._compositeUniforms){
   this._compositeUniforms.atmosphereTexture.value=this._volumeTarget?.texture??null;
   this._compositeUniforms.atmosphereSize.value.set(this.effectResolution.width,this.effectResolution.height);
   this._compositeUniforms.atmosphereCameraRange.value.set(camera.near,camera.far);
   this._compositeUniforms.atmosphereEnabled.value=this.isActive()?1:0;
   const projected=camera.position.clone().addScaledVector(this._sunDirection,100).project(camera);
   this._compositeUniforms.atmosphereSunUV.value.set(projected.x*.5+.5,projected.y*.5+.5);
   this._compositeUniforms.atmosphereSunForward.value=camera.getWorldDirection(V()).dot(this._sunDirection);
   this._compositeUniforms.atmosphereTanHalfFov.value=Math.tan(camera.fov*Math.PI/360);
   this._compositeUniforms.atmosphereSunAspect.value=this._sourceSize.x/Math.max(1,this._sourceSize.y);
   this._compositeUniforms.atmosphereSunColor.value.copy(sun?.color??new T.Color(1,1,1));
   this._compositeUniforms.atmosphereSunIntensity.value=Math.max(0,sun?.intensity??1);
  }
 }

 // Called by stream-water after the opaque color/depth copy is ready. The
 // resulting texture is consumed by finalQuad's existing composite material.
 prepare(renderer,camera,{depthTexture=null}={}){
  this._lastPrepared=false;
  if(!this.isActive()){
   this.depthTexture=null;
   if(this._compositeUniforms)this._compositeUniforms.atmosphereEnabled.value=0;
   return false;
  }
  if(!depthTexture){
   this.depthTexture=null;
   if(this._compositeUniforms)this._compositeUniforms.atmosphereEnabled.value=0;
   return false;
  }
  this._updateUniforms(renderer,camera,depthTexture);
  const target=renderer.getRenderTarget();
  const autoClear=renderer.autoClear,autoReset=renderer.info.autoReset;
  const scissorTest=renderer.getScissorTest(),xr=renderer.xr.enabled,clearAlpha=renderer.getClearAlpha();
  renderer.getViewport(this._viewport);renderer.getScissor(this._scissor);renderer.getClearColor(this._clearColor);
  try{
   renderer.info.autoReset=false;renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.autoClear=true;renderer.xr.enabled=false;
   renderer.setRenderTarget(this._volumeTarget);renderer.setViewport(0,0,this.effectResolution.width,this.effectResolution.height);renderer.clear();
   renderer.render(this._volumeScene,this._volumeCamera);
   this._lastPrepared=true;
  }finally{
   renderer.setRenderTarget(target);renderer.setViewport(this._viewport);renderer.setScissor(this._scissor);renderer.setScissorTest(scissorTest);
   renderer.setClearColor(this._clearColor,clearAlpha);renderer.autoClear=autoClear;renderer.info.autoReset=autoReset;renderer.xr.enabled=xr;
  }
  return true;
 }

 attachCompositeMaterial(material){
  if(!material||this._compositeMaterial===material)return;
  this._compositeMaterial=material;
  const source=material.fragmentShader;
  const declaration='varying vec2 vUv;';
  if(!source.includes(declaration))return;
  let shader=source.replace(declaration,declaration+COMPOSITE_DECLARATIONS);
  const marker='void main(){gl_FragColor=texture2D(color,vUv);gl_FragDepth=texture2D(depth,vUv).x;';
  const replacement=`void main(){
 float opaqueDepth=texture2D(depth,vUv).x;
 vec3 atmosphericAdd=vec3(0.0);
 if(atmosphereEnabled>.5){
  float sceneDistance=clamp(-atmoPerspectiveDepthToViewZ(opaqueDepth,atmosphereCameraRange.x,atmosphereCameraRange.y)/max(.001,atmosphereCameraRange.y),0.0,1.0);
  atmosphericAdd=atmoSample(vUv,sceneDistance).rgb;
  // Keep the small solar disc and halo full resolution so they do not alias
  // with the volume buffer. A depth probe at the actual sun centre blocks the
  // complete halo when a trunk or canopy sits on the line of sight.
  if(atmosphereSunForward>0.0&&atmosphereSunUV.x>=0.0&&atmosphereSunUV.x<=1.0&&atmosphereSunUV.y>=0.0&&atmosphereSunUV.y<=1.0){
   vec2 sunRadius=vec2(1.0/atmosphereSunAspect,1.0)*.00465/(2.0*atmosphereTanHalfFov);
   float sunSky=0.0;
   for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    sunSky+=step(.999999,texture2D(depth,atmosphereSunUV+vec2(float(x),float(y))*sunRadius*.55).x)/9.0;
   }
   float sunDistance=length((vUv-atmosphereSunUV)*vec2(atmosphereSunAspect,1.0))*2.0*atmosphereTanHalfFov;
   float edgeWidth=max(fwidth(sunDistance),.0001);
   float disc=1.0-smoothstep(.00465-edgeWidth,.00465+edgeWidth,sunDistance);
   float haloCore=exp(-sunDistance*sunDistance/(.055*.055));
   float haloVeil=exp(-sunDistance*sunDistance/(.14*.14));
   float edgeFade=smoothstep(0.0,.035,min(min(atmosphereSunUV.x,1.0-atmosphereSunUV.x),min(atmosphereSunUV.y,1.0-atmosphereSunUV.y)));
   atmosphericAdd+=atmosphereSunColor*atmosphereSunIntensity*(disc*2.0*step(.999999,opaqueDepth)+(haloCore*.42+haloVeil*.065)*sunSky)*edgeFade;
  }
 }
 vec4 sceneColor=texture2D(color,vUv);
 gl_FragColor=vec4(sceneColor.rgb+atmosphericAdd,sceneColor.a);
 gl_FragDepth=opaqueDepth;`;
  if(!shader.includes(marker))return;
  material.fragmentShader=shader.replace(marker,replacement);
  material.needsUpdate=true;
  this._compositeUniforms=material.uniforms;
  Object.assign(this._compositeUniforms,{
   atmosphereTexture:{value:null},atmosphereSize:{value:new T.Vector2()},atmosphereCameraRange:{value:new T.Vector2(.025,150)},atmosphereEnabled:{value:0},
   atmosphereSunUV:{value:new T.Vector2(-2,-2)},atmosphereSunAspect:{value:1},atmosphereSunColor:{value:new T.Color(1,1,1)},atmosphereSunIntensity:{value:0},
   atmosphereSunForward:{value:0},atmosphereTanHalfFov:{value:.5},
  });
 }

 getDiagnostics(){
  const camera=this.world?.camera;
  const sun=this.world?.sun;
  const target=sun?.target?.getWorldPosition?.(V())??V();
  const dir=(sun?.position?.clone?.()??V()).sub(target).normalize();
  let projectedSunUV=null;
  if(camera){
   const p=camera.position.clone().addScaledVector(dir,100).project(camera);
   projectedSunUV=[p.x*.5+.5,p.y*.5+.5];
  }
  return{
   enabled:this.enabled,
   quality:this.quality,
   volumetricsEnabled:this.isActive(),
   effectResolution:{width:this.effectResolution.width,height:this.effectResolution.height,scale:this.effectResolution.scale},
   sampleCount:this.sampleCount,
   projectedSunUV,
   sunDirection:dir.toArray(),
   shadowMapAvailable:!!sun?.shadow?.map?.texture,
   depthAvailable:!!this.depthTexture,
   prepared:this._lastPrepared,
   pollenCount:this.pollen?.geometry?.attributes?.position?.count??0,
   supplementaryPollenCount:this.pollen?.userData?.supplementaryPollenCount??0,
  };
 }

 dispose(){
  this._volumeTarget?.dispose();this._volumeTarget=null;
  this._volumeMesh.geometry.dispose();this._volumeMesh.material.dispose();this._dummyShadow.dispose();
  if(this.pollen){this.pollen.removeFromParent();this.pollen.geometry.dispose();this.pollen.material.dispose();this.pollen=null;this._pollenData=null;}
  this.depthTexture=null;this._compositeMaterial=null;this._compositeUniforms=null;
 }
}
