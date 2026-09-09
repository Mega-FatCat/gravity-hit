import * as T from 'three';
const radius=y=>y<.145?.0312:T.MathUtils.lerp(.0312,.012,T.MathUtils.smoothstep(y,.145,.215));
export class Liquid {
 constructor(bottle,scene){
  this.bottle=bottle;this.plane=new T.Plane(new T.Vector3(0,-1,0),0);this.inverse=new T.Matrix4();this.localWaterPlane=new T.Vector4(0,1,0,-.006);
  const profile=[[0,.006],[.022,.006],[.0312,.020],[.0312,.145],[.026,.175],[.019,.195],[.012,.215],[0,.215]].map(v=>new T.Vector2(...v));
  const material=new T.MeshPhysicalMaterial({color:'#bfd3c4',roughness:.075,transmission:.35,thickness:.026,ior:1.333,transparent:true,opacity:.26,depthWrite:false,side:T.FrontSide,clippingPlanes:[this.plane],envMapIntensity:.32});
  this.volume=new T.Mesh(new T.LatheGeometry(profile,64),material);this.volume.renderOrder=1;bottle.add(this.volume);
  const surfaceMat=new T.MeshPhysicalMaterial({color:'#1a2e22',roughness:.28,metalness:.0,transparent:true,opacity:.14,depthWrite:false,side:T.DoubleSide,envMapIntensity:.06});
  surfaceMat.onBeforeCompile=shader=>{
   shader.uniforms.uBottleInverse={value:this.inverse};
   shader.vertexShader='varying vec3 vLiquidWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvLiquidWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='uniform mat4 uBottleInverse;varying vec3 vLiquidWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
vec3 localLiquid=(uBottleInverse*vec4(vLiquidWorld,1.)).xyz;
float r=mix(.0312,.012,smoothstep(.145,.215,localLiquid.y));
if(localLiquid.y<.006||localLiquid.y>.215||length(localLiquid.xz)>r)discard;
float distNorm=length(localLiquid.xz)/max(.001,r);
float meniscus=smoothstep(.80,.98,distNorm);
diffuseColor.rgb=mix(vec3(.04,.10,.07),vec3(.10,.18,.13),meniscus);
diffuseColor.a=mix(.015,.18,meniscus);`);
  };
  this.surface=new T.Mesh(new T.PlaneGeometry(.4,.4),surfaceMat);this.surface.rotation.x=-Math.PI/2;this.surface.renderOrder=2;scene.add(this.surface);
  // Equal-volume sample positions determine a level surface at any bottle tilt.
  this.samples=[];let seed=881;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};while(this.samples.length<1600){const y=.006+random()*.205,x=(random()-.5)*.064,z=(random()-.5)*.064;if(x*x+z*z<radius(y)**2)this.samples.push(new T.Vector3(x,y,z));}
  this._linear=new Float64Array(9).fill(NaN);this._heights=new Float32Array(1600);this.heights=[];this._scratch=new T.Vector3();
 }
 update(amount,time){
  this.bottle.updateWorldMatrix(true,false);this.inverse.copy(this.bottle.matrixWorld).invert();const m=this.bottle.matrixWorld.elements;
  let changed=this.heights.length===0;
  for(let col=0;col<3;col++)for(let row=0;row<3;row++){const index=col*3+row,value=m[col*4+row];if(!Number.isFinite(this._linear[index])||Math.abs(this._linear[index]-value)>1e-7)changed=true;this._linear[index]=value;}
  if(changed){
   // Use the complete parent/world linear transform, including combined-axis
   // rotation and inherited scale. Local Euler Z alone cannot define gravity.
   for(let i=0;i<this.samples.length;i++){const p=this.samples[i];this._heights[i]=m[1]*p.x+m[5]*p.y+m[9]*p.z;}
   this._heights.sort();this.heights=this._heights;
  }
  const fraction=T.MathUtils.clamp(amount*.94,0,1),sample=fraction*(this.heights.length-1),i=Math.floor(sample);
  const level=m[13]+T.MathUtils.lerp(this.heights[i],this.heights[Math.min(i+1,this.heights.length-1)],sample-i);
  this.plane.constant=level;this.surface.position.set(m[12],level,m[14]);this.volume.visible=this.surface.visible=amount>.002;this.level=level;
  // Signed world height expressed in bottle-local coordinates. Both smoke and
  // water now share the very same horizontal physical boundary at every tilt.
  this.localWaterPlane.set(m[1],m[5],m[9],m[13]-level);
 }
}
