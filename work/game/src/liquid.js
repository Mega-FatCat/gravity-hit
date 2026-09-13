import * as T from 'three';
const radius=y=>y<.151?.0320:T.MathUtils.lerp(.0320,.0118,T.MathUtils.smoothstep(y,.151,.208));
export class Liquid {
 constructor(bottle,scene){
  this.bottle=bottle;this.plane=new T.Plane(new T.Vector3(0,-1,0),0);this.inverse=new T.Matrix4();this.localWaterPlane=new T.Vector4(0,1,0,-.006);
  const profile=[
   [0,.007],[.022,.007],[.025,.003],[.028,.005],[.0305,.011],[.0318,.023],[.0320,.036],[.0318,.058],
   [.0318,.120],[.0320,.145],[.029,.165],[.024,.185],[.018,.195],[.012,.205],[.0115,.218],[0,.218]
  ].map(v=>new T.Vector2(...v));
  const material=new T.MeshPhysicalMaterial({color:'#a8dcd4',roughness:.03,transmission:.78,thickness:.048,ior:1.333,transparent:true,opacity:.72,depthWrite:false,side:T.DoubleSide,clippingPlanes:[this.plane],envMapIntensity:.95});
  this.volume=new T.Mesh(new T.LatheGeometry(profile,64),material);this.volume.renderOrder=1;bottle.add(this.volume);
  const surfaceMat=new T.MeshPhysicalMaterial({color:'#b5e4dc',roughness:.02,metalness:.0,transparent:true,opacity:.65,depthWrite:false,side:T.DoubleSide,envMapIntensity:1.1});
  surfaceMat.onBeforeCompile=shader=>{
   shader.uniforms.uBottleInverse={value:this.inverse};
   shader.vertexShader='varying vec3 vLiquidWorld;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvLiquidWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
   shader.fragmentShader='uniform mat4 uBottleInverse;varying vec3 vLiquidWorld;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
vec3 localLiquid=(uBottleInverse*vec4(vLiquidWorld,1.)).xyz;
float r=localLiquid.y<.151?.0320:mix(.0320,.0118,smoothstep(.151,.208,localLiquid.y));
if(localLiquid.y<.005||localLiquid.y>.218||length(localLiquid.xz)>r)discard;
float distNorm=length(localLiquid.xz)/max(.001,r);
float meniscus=smoothstep(.80,.995,distNorm);
float surfaceGrazing=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.2);
diffuseColor.rgb=mix(vec3(.72,.88,.84),vec3(.90,.98,.96),meniscus);
diffuseColor.a=mix(.18,.82,max(meniscus,surfaceGrazing*.7));`);
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
