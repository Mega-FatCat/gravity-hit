import * as T from 'three';
import {createStreamWater} from './stream-water.js';
import {buildForestClutter} from './clutter.js';
import {buildStreambed,applyStreambedTextures} from './streambed.js';
import {foliageRendering,foliageDepthMaterial,pineNeedleTile} from './foliage-rendering.js';

// Metres throughout: the near field gets real relief and the same creek profile
// drives the bed, wet margin, water outline, plant placement and collision height.
const W=-.065,TAU=Math.PI*2;
// The ritual slab is an uneven scanned rock, so use a rounded-rectangle
// footprint close to its measured world-space bounds instead of a large
// circular exclusion zone. This keeps nearby plants rooted in soil while
// preventing roots/bases from appearing to grow through the one stone that
// carries the ritual props.
const RITUAL_SLAB_CENTER_Z=.83,RITUAL_SLAB_FOOTPRINT_X=.82,RITUAL_SLAB_FOOTPRINT_Z=.65;
// GH-50: the user's marked screenshot identified three specific midground
// bush roots that still read as growing out of the ritual slab. Keep this
// list deliberately narrow: nearby plants rooted in the soil behind the slab
// are part of the intended dense backdrop and must remain.
const RITUAL_SLAB_MARKED_BUSH_ROOTS=[
 [1.6269,1.5113],
 [.4548,-.5828],
 [.7806,-.2388]
];
const smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp;
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy,u=a*a*(3-2*a),v=b*b*(3-2*b);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),u),lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
const gaussian=(x,z,cx,cz,r)=>Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r));
export function creekX(z){return -1.65+Math.sin(z*.18)*.50+(noise(z*.31+4,8)-.5)*.31;}
export function creekWidth(z){return 1.23+(noise(z*.45+15,3)-.5)*.57+Math.sin(z*.28)*.20;}

function distToSegmentSq(px,pz,x1,z1,x2,z2){
 const dx=x2-x1,dz=z2-z1,lenSq=dx*dx+dz*dz;
 if(lenSq===0)return(px-x1)**2+(pz-z1)**2;
 const t=Math.max(0,Math.min(1,((px-x1)*dx+(pz-z1)*dz)/lenSq));
 return(px-(x1+t*dx))**2+(pz-(z1+t*dz))**2;
}

const ROOT_BERM_SEGMENTS=[
 [1.45,2.15,1.10,2.05,0.038,0.20],
 [1.10,2.05,0.75,1.95,0.046,0.22],
 [0.75,1.95,0.45,1.88,0.042,0.20],
 [0.45,1.88,0.20,1.82,0.026,0.18],
 [-0.30,1.68,-0.55,1.78,0.034,0.18],
 [-0.55,1.78,-0.78,1.86,0.038,0.20],
 [-0.78,1.86,-0.98,1.90,0.025,0.16],
 [0.90,0.40,0.72,0.70,0.042,0.20],
 [0.72,0.70,0.58,1.00,0.046,0.22],
 [0.58,1.00,0.40,1.30,0.036,0.18],
 [-0.85,0.15,-0.90,0.55,0.036,0.20],
 [-0.90,0.55,-0.92,0.90,0.042,0.22],
 [-0.92,0.90,-0.84,1.25,0.032,0.18],
 [2.65,0.45,2.25,0.62,0.052,0.26],
 [2.25,0.62,1.85,0.80,0.046,0.24],
 [1.85,0.80,1.45,0.98,0.034,0.20],
 [1.85,3.15,1.50,3.40,0.042,0.22],
 [1.50,3.40,1.15,3.60,0.038,0.20],
 [1.15,3.60,0.80,3.75,0.026,0.18]
];

function rootSoilBerm(x,z){
 let h=0;
 for(let i=0;i<ROOT_BERM_SEGMENTS.length;i++){
  const [x1,z1,x2,z2,amp,w]=ROOT_BERM_SEGMENTS[i];
  const dSq=distToSegmentSq(x,z,x1,z1,x2,z2);
  if(dSq<(w*2.2)**2)h=Math.max(h,amp*Math.exp(-dSq/(w*w)));
 }
 return h;
}

function nurseLog(x,z,x0,z0,len,angle,width,height){
 const cos=Math.cos(angle),sin=Math.sin(angle);
 const dx=x-x0,dz=z-z0,u=dx*cos+dz*sin,v=-dx*sin+dz*cos;
 if(Math.abs(u)>len*0.55||Math.abs(v)>width*1.6)return 0;
 const along=Math.max(0,1-(u/(len*0.5))**2);
 const across=Math.exp(-(v*v)/(width*width));
 const dip=-0.32*Math.exp(-((v-width*0.85)**2)/(width*width*0.45));
 return(across+dip)*along*height;
}

function knollCradle(x,z,kx,kz,radius,height,dip){
 const d2=(x-kx)**2+(z-kz)**2,r2=radius*radius;
 if(d2>r2*4.0)return 0;
 const mound=Math.exp(-d2/r2)*height;
 const cd2=(x-(kx+radius*0.5))**2+(z-(kz-radius*0.4))**2;
 const cradle=-Math.exp(-cd2/(r2*0.55))*dip;
 return mound+cradle;
}

function disturbedSoil(x,z){
 const n1=noise(x*3.6+7.2,z*3.6-11.4);
 const n2=noise(x*7.2-4.1,z*7.2+8.5);
 const n3=noise(x*14.0+1.2,z*14.0-2.3);
 const ridge=Math.pow(Math.abs(n1-0.5)*2.0,1.5)*0.046;
 const fine=(n2-0.5)*0.024+(n3-0.5)*0.012;
 const hollowNoise=noise(x*2.1+19,z*2.1-13);
 const hollow=hollowNoise<0.26?-0.040*(1.0-hollowNoise/0.26):0;
 return ridge+fine+hollow;
}

function bankProfile(s,z){
 const lipS=0.72+(noise(z*0.75+12,4)-0.5)*0.12;
 const lowS=0.28+(noise(z*1.1-7,9)-0.5)*0.08;
 if(s>=lipS){
  const u=(s-lipS)/Math.max(0.01,1.0-lipS);
  return lerp(0.66,1.0,smooth(u,0,1));
 }else if(s>=lowS){
  const u=(s-lowS)/Math.max(0.01,lipS-lowS);
  return lerp(0.24,0.56,u);
 }else{
  const u=s/Math.max(0.01,lowS);
  return lerp(0.0,0.22,smooth(u,0,1));
 }
}

// Small, shallow bank-only scours. The broad bank profile remains unchanged;
// these localized pockets give the waterline a little physical breakup where
// damp soil, stones, and roots meet.
function bankErosionPocket(x,z,s){
 const band=smooth(s,0.035,0.34)*(1-smooth(s,0.38,0.62));
 const n=noise(x*3.2+21.0,z*3.2-9.0);
 const pocket=n>.62?-(n-.62)*.105:0;
 const rib=(noise(x*7.4-5.0,z*7.4+12.0)-.5)*.018;
 return band*(pocket+rib);
}

export function forestBase(x,z){
 const r=Math.hypot(x,z-.8);
 const ridge=smooth(r,10,32)*(.22+noise(x*.048+23,z*.048-4)*.85);
 const grade=Math.pow(Math.max(0,r-6)*.075,1.40)*.38+ridge;
 const macro=(noise(x*.17+17,z*.17+6)-.5)*.46+(noise(x*.43-2,z*.43+3)-.5)*.17;
 const mesoBase=(noise(x*1.65+12,z*1.65-7)-.5)*.087+(noise(x*4.8,z*4.8)-.5)*.034;
 const hummocks=gaussian(x,z,1.4,-1.0,1.15)*.18+gaussian(x,z,2.3,3.2,1.2)*.22+gaussian(x,z,-3.3,1.8,1.5)*.16
  +gaussian(x,z,2.8,0.2,1.6)*.19+gaussian(x,z,3.6,-1.4,1.8)*.21
  +gaussian(x,z,3.5,3.2,1.9)*.22+gaussian(x,z,4.6,1.8,2.0)*.23
  +gaussian(x,z,1.6,5.8,2.1)*.20+gaussian(x,z,-1.8,6.2,1.9)*.18
  +gaussian(x,z,-4.5,0.8,1.8)*.20+gaussian(x,z,-4.2,3.8,1.9)*.22;
 const midRelief=smooth(r,1.4,4.2)*((noise(x*.92+8,z*.92+17)-.5)*.16+(noise(x*2.3-5,z*2.3+9)-.5)*.08);

 const logs=nurseLog(x,z,1.9,3.4,3.4,0.45,0.42,0.16)
  +nurseLog(x,z,3.2,1.2,2.8,-0.6,0.38,0.14)
  +nurseLog(x,z,-3.8,1.8,3.0,0.25,0.45,0.15)
  +nurseLog(x,z,2.6,-1.8,2.6,0.8,0.35,0.13)
  +nurseLog(x,z,-0.6,3.6,2.2,-0.3,0.36,0.12);

 const knolls=knollCradle(x,z,1.4,-0.8,0.85,0.14,0.07)
  +knollCradle(x,z,2.4,2.6,1.1,0.17,0.08)
  +knollCradle(x,z,-1.2,3.8,0.95,0.13,0.06)
  +knollCradle(x,z,3.6,-1.2,1.2,0.18,0.09)
  +knollCradle(x,z,-4.2,0.8,1.3,0.16,0.08)
  +knollCradle(x,z,0.9,1.9,0.55,0.075,0.04)
  +knollCradle(x,z,-0.5,2.2,0.60,0.065,0.035);

 const soil=disturbedSoil(x,z);
 const rootBerms=rootSoilBerm(x,z);

 const dxS=x/0.72,dzS=(z-0.83)/0.52;
 const dSlab=Math.sqrt(dxS*dxS+dzS*dzS);
 const underSlab=1-smooth(dSlab,0.75,1.05);
 const slabCollar=smooth(dSlab,0.90,1.20)*(1-smooth(dSlab,1.25,1.85))*0.038;

 const totalMeso=mesoBase+logs+knolls+soil*0.85+rootBerms+slabCollar;
 const clearing=1-smooth(r,0.9,2.8);
 const clearingGround=.038+(soil*0.75+rootBerms+slabCollar+knolls*0.7);
 const fullGround=.04+macro+totalMeso+grade+hummocks+midRelief;

 return lerp(lerp(fullGround,clearingGround,clearing*0.45),.038,underSlab);
}

export function creekBankMeander(z){
 return (noise(z*1.2+8,4)-.5)*.18+(noise(z*3.2-2,11)-.5)*.08+(noise(z*7.5+3.1,17)-.5)*.09+(noise(z*16.0-5,23)-.5)*.04;
}

export function ritualSlabCoverage(x,z,margin=0){
 const rx=RITUAL_SLAB_FOOTPRINT_X+Math.max(0,margin),rz=RITUAL_SLAB_FOOTPRINT_Z+Math.max(0,margin);
 const dx=Math.abs(x/rx),dz=Math.abs((z-RITUAL_SLAB_CENTER_Z)/rz);
 return dx**4+dz**4<=1;
}

export function ritualSlabMarkedBush(x,z){
 return RITUAL_SLAB_MARKED_BUSH_ROOTS.some(([rx,rz])=>Math.hypot(x-rx,z-rz)<.04);
}

export function forestHeight(x,z){
 const half=creekWidth(z)*.5;
 const bankMeander=creekBankMeander(z);
 const effCreekX=creekX(z)+bankMeander;
 const d=Math.abs(x-effCreekX),base=forestBase(x,z);
 if(d<half){
  const side=(x-effCreekX)/half;
  const sideAbs=Math.abs(side);
  const wFactor=1.0-Math.pow(sideAbs,1.8);
  // Sinuous thalweg meander
  const thalweg=Math.sin(z*.38+1.2)*.35+(noise(z*.28+6,9)-.5)*.26;
  const t=Math.abs((side-thalweg)/(side<thalweg?1+thalweg:1-thalweg));
  // Pool-and-riffle longitudinal variation (calibrated base depth ~24cm to 34cm below water plane W)
  const poolRiffle=Math.sin(z*.68+noise(z*.32+5,8)*1.8)*.052;
  const stepPool=(noise(z*1.45+3.1,7.8)-.5)*.038;
  const baseDepth=.275+noise(z*.48+18,4)*.065+poolRiffle+stepPool;
  const channelBed=-baseDepth*(1.0-Math.pow(Math.min(1.0,t),1.55));
  // Depositional gravel bars on inner bends
  const barSide=-Math.sign(thalweg||1)*.42;
  const barDist=(side-barSide)/.38;
  const barDeposit=Math.exp(-barDist*barDist)*Math.max(0.0,Math.sin(z*.72+1.4))*.045;
  // Sediment scour pockets near bends and anchor zones
  const scourN=noise(x*2.2+7.1,z*2.2-5.4);
  const scour=scourN>.62?-(scourN-.62)*.080:0.0;
  // 3D Meso gravel relief on the bed itself
  const mesoGravel=(noise(x*4.8+12,z*4.8-4)-.5)*.032+(noise(x*11.5,z*11.5+7)-.5)*.018;
  // Smoothly blend to bank contact (W + 0.012 at side = +-1)
  return W+(channelBed+barDeposit+scour+mesoGravel)*wFactor+.012*Math.pow(sideAbs,6);
 }
 const bank=1.05+noise(z*.6,14)*.6;
 const s=Math.max(0,Math.min(1,(d-half)/bank));
 const t=bankProfile(s,z);
 const slump=Math.sin(z*2.1+noise(z*0.8,14)*2.4)*0.032*smooth(s,0.22,0.45)*(1-smooth(s,0.58,0.82));
 const bankLipDetail=(noise(x*6.5,z*6.5)-0.5)*0.028;
 const bankHeight=lerp(W+0.012,Math.max(0.018,base),t)+slump+bankLipDetail*(1-t)*t*3.5+bankErosionPocket(x,z,s);
 const rootBerm=rootSoilBerm(x,z);
 return bankHeight+rootBerm*smooth(s,0.3,0.8);
}
function addMesh(world,geometry,material,name){const m=new T.Mesh(geometry,material);m.name=name;m.receiveShadow=true;world.scene.add(m);return m;}
function placeAllowed(x,z,height=.3,margin=.16,slabMargin=0){
 // Strict water exclusion: roots and stems can NEVER grow inside water (W = -0.065)
 if(forestHeight(x,z)<W+0.048)return false;
 const effCreekX=creekX(z)+creekBankMeander(z);
 if(Math.abs(x-effCreekX)<creekWidth(z)*.5+margin)return false;
 // Only the central ritual slab is protected here. Do not use a circular
 // clearing radius: that would incorrectly remove plants rooted in nearby soil.
 if(ritualSlabCoverage(x,z,slabMargin))return false;
 const playerRadius=height<=.22?.45:.62+Math.min(height,.9)*.30;
 if(Math.hypot(x,z-2.65)<playerRadius)return false;
 // View corridor between player and stone (and behind bottle) for taller growth
 if(height>.22&&Math.abs(x)<.48+height*.18&&z>-.20&&z<2.45)return false;
 return true;
}
function instances(world,geometry,material,placements,name,shadow=true){
 const batches=new Map(),d=new T.Object3D(),color=new T.Color();
 // Previously unshadowed undergrowth needs local occlusion, but distant
 // carpets must not all enter the shadow pass. Split only these near batches.
 const localShadow=!shadow&&material.userData.foliage&&!/grass/i.test(name);
 for(const p of placements){const key=`${Math.floor(p.x/8)},${Math.floor(p.z/8)}${localShadow?(Math.hypot(p.x,p.z-2.65)<5?':shadow':':unshadowed'):''}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(p);}
 for(const [key,list]of batches){const m=new T.InstancedMesh(geometry,material,list.length);m.name=`${name}:${key}`;m.castShadow=localShadow?key.endsWith(':shadow'):shadow&&list.some(p=>Math.hypot(p.x,p.z-.8)<12);m.receiveShadow=true;
  if(m.castShadow&&material.userData.foliage&&material.alphaTest>0)m.customDepthMaterial=foliageDepthMaterial(material,world);
  list.forEach((p,i)=>{d.position.set(p.x,p.y??forestHeight(p.x,p.z),p.z);d.rotation.set(p.rx||0,p.rot||0,p.rz||0);d.scale.set(p.sx??p.s??1,p.sy??p.s??1,p.sz??p.s??1);d.updateMatrix();m.setMatrixAt(i,d.matrix);const light=p.tint??1;color.setRGB(light,light*(p.green??1),light*(p.blue??1));m.setColorAt(i,color);});
  m.computeBoundingSphere();m.computeBoundingBox();world.scene.add(m);
 }
}
function scanMaterial(source,world,wind=0){const m=source.clone();m.color.setRGB(.92,.92,.92);m.roughness=.94;m.metalness=0;m.side=T.DoubleSide;m.transparent=false;m.depthWrite=true;m.envMapIntensity=.65;
  const isBark=/trunk|bark|stump|branches/.test(source.name);
  const isShrub=/shrub/.test(source.name);
  const isFern=/fern/.test(source.name);
  const pineBark=/^pine_tree_01_(bark|trunk_b)$/.test(source.name)&&world.pineBarkPbr;
  if(isBark){
   m.roughness=.96;m.metalness=0;m.envMapIntensity=1.15;m.normalScale?.set(1.4,1.4);
  }else if(isShrub){
   // Retain waxy grazing response without silver, high-contrast leaf patches.
   m.roughness=.74;m.metalness=0;m.envMapIntensity=.65;
   m.normalScale?.set(.65,.65);
   // Natural color balance for each woodland shrub species: healthy forest chlorophyll greens
   if(source.name.includes('shrub_03')){
    m.color.setRGB(.48,.70,.46); // Rich forest understory green
   }else if(source.name.includes('shrub_02')){
    m.color.setRGB(.52,.76,.48); // Lush living lance-leaf sapling green
   }else{
     m.color.setRGB(.60,.82,.51); // Slightly warmer heath green (GH-31 species separation)
    }
  }else if(isFern){
   m.roughness=.74;m.metalness=0;m.envMapIntensity=.60;
   m.color.setRGB(.76,.90,.72); // Fresh woodland fern green
   m.normalScale?.set(.65,.65);
  }else{
   m.normalScale?.set(.55,.55);
  }
  // GH-39: retain bark relief without exaggerating fine normal-map contrast.
  if(pineBark){m.map=pineBark.map;m.normalMap=pineBark.normalMap;m.roughnessMap=pineBark.roughnessMap;m.roughness=.90;m.metalness=0;m.color.setRGB(.72,.66,.60);m.normalScale?.set(1.25,1.25);m.envMapIntensity=.50;m.needsUpdate=true;}
  const alphaKey=source.name.includes('pine_tree_01_twig')?'pine_tree_01':source.name.includes('fir_sapling_twigs')?'fir_sapling':source.name;
  // Fir needles are modeled opaque geometry, not cutout cards.
  if(alphaKey==='fir_sapling'){m.alphaMap=null;m.alphaTest=0;}
   else if(world.foliageAlphaTextures?.[alphaKey]){
    m.alphaMap=world.foliageAlphaTextures[alphaKey];
    m.alphaTest=isShrub?.16:isFern?.22:.28;
    m.alphaToCoverage=true;
   }else if(m.alphaTest)m.alphaTest=.20;
  if(m.map)m.map.anisotropy=8;if(wind){world.addWind(m,wind);m.userData.foliageWind=wind;}
  if(isBark){
   const compile=m.onBeforeCompile,cache=m.customProgramCacheKey();m.onBeforeCompile=shader=>{compile.call(m,shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     diffuseColor.rgb = diffuseColor.rgb * vec3(0.96, 0.93, 0.89);
    `).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
     #if NUM_DIR_LIGHTS > 0
      vec3 sunDir = directionalLights[0].direction;
      vec3 sunCol = directionalLights[0].color;
      float NdotL = dot(normal, sunDir);
      float barkWrap = smoothstep(-0.45, 0.45, NdotL);
      float normalUp = inverseTransformDirection(nonPerturbedNormal,viewMatrix).y * 0.5 + 0.5;
      vec3 skyAmbient = vec3(0.40, 0.46, 0.42);
      vec3 groundBounce = vec3(0.35, 0.30, 0.24);
      vec3 forestAmbient = mix(groundBounce, skyAmbient, normalUp);
      float edgeCatch = pow(1.0 - max(dot(normal, geometryViewDir), 0.0), 3.0);
      float backScatter = pow(max(dot(geometryViewDir, sunDir), 0.0), 2.0);
      vec3 rimLight = vec3(0.14, 0.16, 0.15) * (edgeCatch * (0.3 + 0.7 * backScatter));
      reflectedLight.indirectDiffuse += diffuseColor.rgb * (forestAmbient * 0.20 + sunCol * (0.08 * barkWrap) + rimLight * 0.40);
     #endif
    `);
   };m.customProgramCacheKey=()=>`${cache}:rough-bark-2`;
  }else if(isShrub){
   const compile=m.onBeforeCompile,cache=m.customProgramCacheKey();m.onBeforeCompile=shader=>{compile.call(m,shader);
    // Vertex shader: blend spherical volume normals for soft 3D foliage lighting
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
     vec3 plantCore = vec3(0.0, 0.24, 0.0);
     vec3 sphereNorm = normalize(position - plantCore);
     objectNormal = normalize(mix(objectNormal, sphereNorm, 0.40));
    `);
   };m.customProgramCacheKey=()=>`${cache}:shrub-leaf-v3`;
 }
 if(!isBark&&(isShrub||m.alphaMap||alphaKey==='fir_sapling'))foliageRendering(m,isShrub?.38:.24);
 return m;}
function sourceMeshes(model){const meshes=[];model.traverse(o=>{if(o.isMesh)meshes.push(o);});return meshes;}
function groundedGeometry(source){const g=source.geometry.clone();g.computeBoundingBox();const b=g.boundingBox,c=b.getCenter(new T.Vector3());g.translate(-c.x,-b.min.y,-c.z);g.computeBoundingBox();return g;}
function plantVariants(model){
 // Asset roots are arranged on a display grid. Ignore that translation, but
 // preserve the authored rotation and all material parts of each real plant.
 model.updateMatrixWorld(true);
 return model.children.map(root=>{
  const inverse=new T.Matrix4().copy(root.matrixWorld).invert(),orientation=new T.Matrix4().compose(new T.Vector3(),root.quaternion,root.scale),parts=[],bounds=new T.Box3();
  root.traverse(src=>{if(!src.isMesh)return;const g=src.geometry.clone(),relative=new T.Matrix4().multiplyMatrices(inverse,src.matrixWorld);g.applyMatrix4(new T.Matrix4().multiplyMatrices(orientation,relative));g.computeBoundingBox();bounds.union(g.boundingBox);parts.push({geometry:g,material:src.material});});
  if(!parts.length)return null;const center=bounds.getCenter(new T.Vector3()),height=bounds.max.y-bounds.min.y;
  let baseRadius=0;
  const baseBand=Math.min(.12,height*.18);
  parts.forEach(part=>{
   part.geometry.translate(-center.x,-bounds.min.y,-center.z);
   part.geometry.computeBoundingBox();
   const pos=part.geometry.attributes.position;
   for(let i=0;i<pos.count;i++){
    if(pos.getY(i)>baseBand)continue;
    baseRadius=Math.max(baseRadius,Math.hypot(pos.getX(i),pos.getZ(i)));
   }
  });
  return{parts,height,name:root.name,baseRadius};
 }).filter(Boolean);
}

export function buildForestFloor(world){
 world.environmentVersion='woodland-recovery-2';
 // Lighting still comes from the scanned HDR. A distant sky behind real trees
 // avoids projecting the photograph's nearby giant trunks onto our horizon.
 const skyMaterial=new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{horizon:{value:new T.Color('#536657')},zenith:{value:new T.Color('#8da8bc')}},vertexShader:'varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:'uniform vec3 horizon; uniform vec3 zenith; varying vec3 direction; void main(){float h=max(normalize(direction).y,0.0);gl_FragColor=vec4(mix(horizon,zenith,smoothstep(-0.02,.38,h)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
 world.forestSky=addMesh(world,new T.SphereGeometry(125,32,16),skyMaterial,'Distant woodland sky');world.forestSky.renderOrder=-10;
 const alphaLoader=new T.TextureLoader();world.foliageAlphaTextures={};world.foliageAlphaReady=[];
 for(const id of ['fern_02','shrub_02','shrub_03','shrub_04','grass_medium_01','pine_tree_01','fir_sapling']){
  world.foliageAlphaReady.push(new Promise((resolve,reject)=>{const texture=alphaLoader.load(`./assets/${id}/alpha.png`,resolve,undefined,reject);texture.flipY=false;texture.anisotropy=8;world.foliageAlphaTextures[id]=texture;}));
 }
 world.groundMat=new T.MeshStandardMaterial({color:'#9e9277',roughness:.97,vertexColors:true});
 // One continuous displaced surface blends the existing gravel and loam scans.
 // A second raised bed used to make a gray ribbon with a hard material edge.
 world.creekTextures={creekMap:{value:null},creekNormal:{value:null},creekRoughness:{value:null},creekDetailMap:{value:null},creekDetailNormal:{value:null},creekDetailRoughness:{value:null}};
 world.groundMat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,world.creekTextures);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec4 creekSurface;\nvarying vec4 vCreekSurface;\nvarying vec3 vWorldBedPos;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCreekSurface = creekSurface;\nvWorldBedPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec4 vCreekSurface;\nvarying vec3 vWorldBedPos;\nuniform sampler2D creekMap;\nuniform sampler2D creekNormal;\nuniform sampler2D creekRoughness;\nuniform sampler2D creekDetailMap;\nuniform sampler2D creekDetailNormal;\nuniform sampler2D creekDetailRoughness;\nfloat gh36GroundHash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+41.7);return fract(p.x*p.y);}\nfloat gh36GroundNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=gh36GroundHash(i),b=gh36GroundHash(i+vec2(1.0,0.0)),c=gh36GroundHash(i+vec2(0.0,1.0)),d=gh36GroundHash(i+vec2(1.0,1.0));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}\nfloat gh36GroundFbm(vec2 p){return gh36GroundNoise(p)*.62+gh36GroundNoise(p*2.1+3.7)*.25+gh36GroundNoise(p*4.0-2.4)*.13;}');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`float bankDamp = vCreekSurface.z;
vec4 creekBedSample = texture2D(creekMap, vMapUv * 1.7);
sampledDiffuseColor = mix(sampledDiffuseColor, creekBedSample, max(vCreekSurface.x, bankDamp * .62));
// Keep a small, patchy trace of the existing forest-floor scan in the bed:
// organic flecks should collect in quiet pockets, not tile across the whole
// channel as an additional uniform texture layer.
float organicPocket = smoothstep(.52, .78, gh36GroundFbm(vWorldBedPos.xz * .72 + vec2(3.0, -12.0)));
 float organicBedBlend = vCreekSurface.x * (.11 + organicPocket * .17);
sampledDiffuseColor = mix(sampledDiffuseColor, texture2D(map, vMapUv * 3.10 + vec2(.21, -.14)), organicBedBlend);
   diffuseColor *= sampledDiffuseColor;

   // GH-36 high-resolution sediment detail: reuse the loaded 4K rock scan as
   // a quiet mineral/silt layer. It is deliberately broad and low-contrast so
   // the bed gains real texture without becoming a second noisy material.
   float bedDetailMask = max(vCreekSurface.x, vCreekSurface.z * .62);
   vec3 highResBedMacro = texture2D(creekDetailMap, vWorldBedPos.xz * 1.20 + vec2(.13, -.09)).rgb;
   vec3 highResBedFine = texture2D(creekDetailMap, vWorldBedPos.xz * 3.40 + vec2(-.37, .22)).rgb;
   vec3 highResBed = mix(highResBedMacro, highResBedFine, .22);
   vec3 highResBedSoft = mix(highResBed, vec3(dot(highResBed, vec3(.299, .587, .114))), .16);
   diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, highResBedSoft, .54), bedDetailMask * .76);
   float depositPatch = gh36GroundFbm(vWorldBedPos.xz * 1.35 + vec2(-4.0, 9.0));
   float gravelPocket = smoothstep(.56, .78, gh36GroundNoise(vWorldBedPos.xz * 3.8 + vec2(14.0, -6.0)));
   vec3 darkSiltDetail = highResBedSoft * vec3(.62, .59, .53);
   vec3 lightGravelDetail = highResBedSoft * vec3(1.12, 1.07, .98);
   vec3 depositedBed = mix(darkSiltDetail, lightGravelDetail, smoothstep(.36, .68, depositPatch));
   depositedBed = mix(depositedBed, lightGravelDetail * 1.04, gravelPocket * .18);
   diffuseColor.rgb = mix(diffuseColor.rgb, depositedBed, bedDetailMask * .34);

   // GH-36 substrate variation: quiet sediment pockets with a few lighter bars.
   float bedField = gh36GroundFbm(vWorldBedPos.xz * .52 + vec2(6.0, -3.0));
   float pebbleField = gh36GroundNoise(vWorldBedPos.xz * 1.65 + vec2(-8.0, 4.0));
   float sediment = vCreekSurface.x * (.30 + .70 * bedField) * (.58 + .42 * vCreekSurface.y) + bankDamp * (.12 + .22 * bedField);
   float paleGravel = vCreekSurface.x * smoothstep(.62, .84, pebbleField) * .13;
   float edgeMoss = vCreekSurface.x * (1.0 - vCreekSurface.y * .72) * smoothstep(.74, .91, gh36GroundNoise(vWorldBedPos.xz * .86 + 11.0)) * .12;
   float litter = vCreekSurface.x * (1.0 - vCreekSurface.y * .82) * smoothstep(.82, .94, gh36GroundNoise(vWorldBedPos.xz * 1.18 - 17.0)) * .16;
   vec3 substrate = diffuseColor.rgb;
   substrate = mix(substrate, substrate * vec3(.52, .48, .42), sediment * .58);
   substrate = mix(substrate, substrate * vec3(1.10, 1.07, .96), paleGravel);
   substrate = mix(substrate, substrate * vec3(.60, .72, .46), edgeMoss);
   // A muted damp-soil shoulder carries the channel tone into the bank.
   substrate = mix(substrate, substrate * vec3(.78, .74, .64), bankDamp * .52);
   vec3 leafLitter = substrate * vec3(.50, .43, .33);
   substrate = mix(substrate, leafLitter, litter);
   diffuseColor.rgb = substrate;`));
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;','mapN = mix(mapN, texture2D(creekNormal, vNormalMapUv * 1.7).xyz * 2.0 - 1.0, vCreekSurface.x);\nvec3 bedDetailN = texture2D(creekDetailNormal, vWorldBedPos.xz * 1.20 + vec2(.13, -.09)).xyz * 2.0 - 1.0;\nmapN = mix(mapN, bedDetailN, max(vCreekSurface.x, vCreekSurface.z * .62) * .24);\nmapN.xy *= normalScale;'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',T.ShaderChunk.roughnessmap_fragment.replace('roughnessFactor *= texelRoughness.g;',`roughnessFactor *= mix(texelRoughness.g, texture2D(creekRoughness, vRoughnessMapUv * 1.7).g, max(vCreekSurface.x, vCreekSurface.z * .62));
roughnessFactor = mix(roughnessFactor, texture2D(creekDetailRoughness, vWorldBedPos.xz * 1.20 + vec2(.13, -.09)).g, max(vCreekSurface.x, vCreekSurface.z * .62) * .24);
roughnessFactor = mix(roughnessFactor, .44, vCreekSurface.y * .65);
roughnessFactor = mix(roughnessFactor, .78, vCreekSurface.x * .22);
roughnessFactor = mix(roughnessFactor, .82, vCreekSurface.z * .45);`));
 };
 world.groundMat.customProgramCacheKey=()=> 'continuous-creek-loam-gh36-materials-1';
 world.rockMat=new T.MeshStandardMaterial({color:'#b6b5a3',roughness:.91});
 world.barkMat=new T.MeshStandardMaterial({color:'#aaa28b',roughness:.96});
 const axis=[];for(let x=-80;x< -14;x+=2)axis.push(x);for(let x=-14;x< -9;x+=.4)axis.push(x);for(let i=0;i<=720;i++)axis.push(-9+i*.025);for(let x=9.4;x<=14;x+=.4)axis.push(x);for(let x=16;x<=80;x+=2)axis.push(x);
  const n=axis.length,positions=[],uvs=[],colors=[],creekSurface=[],indices=[];
 for(let zi=0;zi<n;zi++)for(let xi=0;xi<n;xi++){
  const x=axis[xi],z=axis[zi],y=forestHeight(x,z),half=creekWidth(z)*.5,d=Math.abs(x-creekX(z)),edge=noise(x*3.3+8,z*3.3)*.21+noise(x*8,z*8)*.06;
  const wet=1-smooth(y+edge*.12,W-.025,W+.065),gravel=1-smooth(d+edge,half-.13,half+.44);
  const edgeDist=d+edge*.42;
  const bankDamp=(1-smooth(y,W-.01,W+.14))*smooth(edgeDist,half-.08,half+.18)*(1-smooth(edgeDist,half+.18,half+.78));
  creekSurface.push(gravel,wet,bankDamp,0);
  positions.push(x,y,z);uvs.push(x*.5,z*.5);
  // Vertex values are linear multipliers, not a second black soil material.
  const dist=Math.hypot(x,z-.8),canopy=smooth(dist,2.5,13),v=(.56+noise(x*.6,z*.6)*.32)*(1-canopy*.40);
  const distantShade=1-smooth(dist,22,60)*.42;const vD=v*distantShade;
  colors.push(vD*(1-wet*.16),vD*(1-wet*.18),vD*(1-wet*.22));
 }
 for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){const a=z*n+x,b=a+1,c=a+n,d=c+1;indices.push(a,c,b,b,c,d);}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('creekSurface',new T.Float32BufferAttribute(creekSurface,4));geo.setIndex(indices);geo.computeVertexNormals();
 world.groundMesh=addMesh(world,geo,world.groundMat,'Forest loam • high-resolution near-field relief');world.groundMesh.castShadow=false;
 const stone=new T.IcosahedronGeometry(1,2),p=stone.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=.94+noise(x*4+11,z*4+y)*.15;p.setXYZ(i,x*f,y*f,z*f);}stone.computeVertexNormals();
 world.slab=addMesh(world,stone,world.rockMat,'Ritual stone');world.slab.position.set(0,.06,.8);world.slab.scale.set(.80,.23,.58);world.slab.castShadow=true;
 world.bedMat=world.groundMat;
  buildStreambed(world);
  // Reuse the already-loaded 4K stream-rock maps for subtle substrate detail;
  // this adds resolution to the ground without loading a second texture set.
  const detailMat=world.streambedMaterials?.gritMat;
  if(detailMat){world.creekTextures.creekDetailMap.value=detailMat.map;world.creekTextures.creekDetailNormal.value=detailMat.normalMap;world.creekTextures.creekDetailRoughness.value=detailMat.roughnessMap;}
   const waterGeo=new T.PlaneGeometry(1,72,16,600),wp=waterGeo.attributes.position;
   for(let i=0;i<wp.count;i++){const z=-wp.getY(i),x=creekX(z)+creekBankMeander(z)+wp.getX(i)*creekWidth(z)*1.14;wp.setX(i,x);}waterGeo.computeVertexNormals();
    const normalData=new Uint8Array(256*256*4);
    const heightData=new Float32Array(256*256);
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
     const u=(x/256)*Math.PI*2,v=(y/256)*Math.PI*2;
     const h=Math.sin(u*4.0+Math.cos(v*3.0))*0.32
            +Math.cos(v*5.0-Math.sin(u*3.0))*0.26
            +Math.sin((u+v)*7.0)*0.20
            +Math.cos((u-v)*9.0)*0.14
            +Math.sin(u*13.0+v*11.0)*0.08;
     heightData[y*256+x]=h;
    }
    for(let y=0;y<256;y++)for(let x=0;x<256;x++){
     const xL=(x-1+256)%256,xR=(x+1)%256,yD=(y-1+256)%256,yU=(y+1)%256;
     const dhdx=(heightData[y*256+xR]-heightData[y*256+xL])*1.4;
     const dhdy=(heightData[yU*256+x]-heightData[yD*256+x])*1.4;
     let nx=-dhdx,ny=-dhdy,nz=1.0;
     const len=Math.hypot(nx,ny,nz);
     nx/=len;ny/=len;nz/=len;
     const i=(y*256+x)*4;
     normalData[i]=Math.round((nx*0.5+0.5)*255);
     normalData[i+1]=Math.round((ny*0.5+0.5)*255);
     normalData[i+2]=Math.round((nz*0.5+0.5)*255);
     normalData[i+3]=255;
    }
    const normalTex=new T.DataTexture(normalData,256,256,T.RGBAFormat);normalTex.wrapS=normalTex.wrapT=T.RepeatWrapping;normalTex.magFilter=T.LinearFilter;normalTex.minFilter=T.LinearMipmapLinearFilter;normalTex.generateMipmaps=true;normalTex.needsUpdate=true;
 world.stream=createStreamWater(world,waterGeo,normalTex,W);
   world.scene.add(world.stream);world.interactive.push(world.stream);world.ripples=[];
 // Stable forest lighting: the weather updater uses these same values.
 const hemi=world.scene.children.find(o=>o.isHemisphereLight);if(hemi){hemi.color.set('#b8c8d2');hemi.groundColor.set('#71664b');hemi.intensity=1.1;world.forestHemisphere=hemi;}
 world.sun.position.set(-12,26,-9);world.sun.color.set('#ffe8bc');world.sun.intensity=1.7;
 world.sun.shadow.camera.left=-28;world.sun.shadow.camera.right=28;world.sun.shadow.camera.top=28;world.sun.shadow.camera.bottom=-28;world.sun.shadow.camera.far=90;world.sun.shadow.camera.updateProjectionMatrix();world.sun.shadow.normalBias=.008;world.sun.shadow.bias=-.00005;
}

function plantModel(world,model,{name,seed,count,radius=17,minRadius=0,height=[.2,.5],wind=.025,near=.9,shadow=true,cluster=1.8,maxTriangles=Infinity,belt=false,midground=false,variantPattern=null,nearPatches=false,lodModel=null,lodDistance=6}){
 const randomPlant=random(seed),variants=plantVariants(model).filter(v=>(!variantPattern||variantPattern.test(v.name))&&v.parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0)<=maxTriangles),sets=variants.map(()=>[]),centers=[];
 if(!variants.length)throw new Error(`No plant variants for ${name}`);
 const sparseAnchors=[
  // Sector A: North-East / right of slab
  [2.2,0.2],[3.2,-0.8],[2.6,1.2],[3.8,0.5],[3.4,-2.0],[2.0,-1.2],[4.2,-1.0],
  // Sector B: East / South-East
  [2.8,2.8],[4.0,3.5],[3.6,4.6],[4.8,2.2],[2.5,3.8],[4.4,4.2],[3.2,5.0],
  // Sector C: South / Rear (behind player)
  [1.4,5.2],[2.6,6.4],[0.5,6.0],[-1.2,5.5],[1.8,7.8],[-1.8,7.2],[0.2,7.0],[2.2,8.5],
  // Sector D: Far stream bank (west / southwest across creek)
  [-3.8,0.5],[-4.5,-1.5],[-4.2,2.4],[-4.8,4.0],[-3.6,4.8],[-4.0,-2.6],[-5.2,1.8]
 ];
 for(let i=0;i<320;i++){
  if(midground&&i<sparseAnchors.length){
   centers.push(sparseAnchors[i]);
   continue;
  }
  const a=randomPlant()*TAU;
  const r=nearPatches?1.5+randomPlant()*5.5:belt?6+Math.sqrt(randomPlant())*(radius-6):midground?(minRadius||2.2)+(randomPlant()*.7+Math.sqrt(randomPlant())*.3)*(radius-(minRadius||2.2)):i<120?1.3+Math.sqrt(randomPlant())*Math.min(radius-2,10):6+Math.sqrt(randomPlant())*(radius-6);
  const cz=midground?(randomPlant()<.45?.8:2.4):i%2===0?.8:2.2;
  centers.push([Math.cos(a)*r,Math.sin(a)*r+cz]);
 }
 for(let i=0;i<count;i++){
  // Clustered around thickets/anchors vs distributed across radius
  let x,z;
  if(randomPlant()<(midground?0.40:0.35)){
   const a=randomPlant()*TAU;
   const r=nearPatches?1.5+randomPlant()*5.5:belt?6+Math.sqrt(randomPlant())*(radius-6):midground?(minRadius||2.2)+(randomPlant()*.7+Math.sqrt(randomPlant())*.3)*(radius-(minRadius||2.2)):1.3+Math.sqrt(randomPlant())*(radius-1.3);
   const cz=randomPlant()<0.5?.8:2.2;
   x=Math.cos(a)*r;z=Math.sin(a)*r+cz;
  }else{
   const c=centers[i%centers.length],a=randomPlant()*TAU,r=Math.sqrt(randomPlant())*cluster;
   x=c[0]+Math.cos(a)*r;z=c[1]+Math.sin(a)*r;
  }
  const h=lerp(height[0],height[1],randomPlant());
  const index=i%variants.length,s=h/Math.max(.04,variants[index].height);
  const isBush=/shrub|sapling|heath|understory|fir/i.test(name);
  // Keep roots on the damp bank shoulder, never in the water trough. A
  // slightly wider exclusion for woody bushes removes the few apparent
  // floating shrubs while leaving plants that grow out of the bank intact.
  const rootY=forestHeight(x,z);
  const bankRootClearance=isBush?.105:.060;
  // Keep a shrub's low stem/base on the damp shoulder as well as its root
  // point. This removes the few visually floating bushes whose foliage base
  // overhung the water even though their instance center was outside it.
  const lowBaseReach=isBush?Math.min(.12,(variants[index].baseRadius??0)*s):Math.min(.08,(variants[index].baseRadius??0)*s*.55);
  const bankMargin=(isBush?.115:.055)+lowBaseReach;
  // A few broad ground-cover variants have a low leaf fan wider than their
  // root point. Keep only that small base overlap off the slab; plants rooted
  // just behind the stone must remain in the scene.
  const slabMargin=Math.min(.08,.008+lowBaseReach);
  // These are the three screenshot-marked bush roots on the ritual slab.
  // This is intentionally limited to the named midground group so the dense
  // plants rooted immediately behind the stone remain in the scene.
  if((name==='Midground screening bushes'&&ritualSlabMarkedBush(x,z))||rootY<W+bankRootClearance||!placeAllowed(x,z,h,bankMargin,slabMargin)||Math.hypot(x,z-2.65)<near)continue;
  const eps=0.25;
  const slopeX=(forestHeight(x+eps,z)-forestHeight(x-eps,z))/(2*eps);
  const slopeZ=(forestHeight(x,z+eps)-forestHeight(x,z-eps))/(2*eps);
  const rx=isBush?-slopeZ*.35+(randomPlant()-.5)*.22:-slopeZ*.18+(randomPlant()-.5)*.10;
  const rz=isBush?slopeX*.35+(randomPlant()-.5)*.22:slopeX*.18+(randomPlant()-.5)*.08;
  // GH-31 secondary diversity: deterministic per-plant age/species accent.
  // Same RNG call count as before (placement sequence preserved); same total
  // counts, zones, clearing/stream exclusions. Only tint + silhouette vary to
  // avoid a monoculture read without adding clutter or new assets.
  const isFern=/fern/i.test(name);
  const greenBase=randomPlant(),blueBase=randomPlant(),sxBase=randomPlant(),szBase=randomPlant(),rotBase=randomPlant(),tintBase=randomPlant();
  const accent=hash(Math.round(x*23.7)+seed%977,Math.round(z*23.7)+seed%613);
  let green,blue,tint,sxMul,syMul,szMul;
  if(isFern){
   if(accent<.78){green=.96+greenBase*.08;blue=.88+blueBase*.10;tint=.80+tintBase*.20;sxMul=.85+sxBase*.35;syMul=.92+greenBase*.16;szMul=.85+szBase*.35;}
   else if(accent<.90){green=.90+greenBase*.08;blue=.90+blueBase*.08;tint=.64+tintBase*.16;sxMul=.90+sxBase*.35;syMul=.78+greenBase*.16;szMul=.90+szBase*.35;}
   else{green=1.04+greenBase*.10;blue=.86+blueBase*.08;tint=.90+tintBase*.18;sxMul=.78+sxBase*.28;syMul=1.02+greenBase*.20;szMul=.78+szBase*.28;}
  }else if(isBush){
   if(accent<.68){green=.96+greenBase*.08;blue=.88+blueBase*.10;tint=.80+tintBase*.19;sxMul=.85+sxBase*.35;syMul=.92+greenBase*.16;szMul=.85+szBase*.35;}
   else if(accent<.84){green=1.03+greenBase*.09;blue=.82+blueBase*.10;tint=.88+tintBase*.17;sxMul=.76+sxBase*.20;syMul=1.06+greenBase*.20;szMul=.76+szBase*.20;}
   else{green=.95+greenBase*.08;blue=.88+blueBase*.08;tint=.74+tintBase*.16;sxMul=1.06+sxBase*.30;syMul=.80+greenBase*.15;szMul=1.06+szBase*.30;}
  }else{green=isBush?.96+greenBase*.08:1;blue=isBush?.88+blueBase*.10:.90+blueBase*.08;tint=.80+tintBase*.20;sxMul=.85+sxBase*.35;syMul=1;szMul=.85+szBase*.35;}
  sets[index].push({x,z,y:forestHeight(x,z)-.007,sx:s*sxMul,sy:s*syMul,sz:s*szMul,rot:rotBase*TAU,rx,rz,tint,green,blue});
 }
 const lods=new Map(lodModel?plantVariants(lodModel).map(v=>[v.name,v]):[]);
 variants.forEach((variant,i)=>{if(!sets[i].length)return;const lod=lods.get(variant.name),close=lod?sets[i].filter(p=>Math.hypot(p.x,p.z-2.65)<lodDistance):sets[i],far=lod?sets[i].filter(p=>Math.hypot(p.x,p.z-2.65)>=lodDistance):[];
  variant.parts.forEach(part=>{const material=scanMaterial(part.material,world,wind),low=lod?.parts.find(p=>p.material.name===part.material.name);if(close.length)instances(world,part.geometry,material,close,`${name} variant ${i+1}`,shadow);if(far.length)instances(world,low?.geometry??part.geometry,material,far,`${name} variant ${i+1} distant`,shadow);});
 });
 world.environmentCounts??={};world.environmentCounts[name]=sets.reduce((n,p)=>n+p.length,0);
}
export function plantFerns(world,model,lodModel){
 plantModel(world,model,{name:'Stream-bank fern colonies',seed:3511,count:1200,radius:28,height:[.24,.68],cluster:2.4,near:1.0,wind:.020,lodModel,lodDistance:2.2,shadow:false});
 plantModel(world,model,{name:'Woodland fern carpets',seed:3577,count:1400,radius:38,height:[.20,.58],cluster:3.0,near:1.1,wind:.016,lodModel,lodDistance:2.2,shadow:false});
 plantModel(world,model,{name:'Midground fern understory',seed:41022,count:550,minRadius:1.8,radius:12.5,midground:true,height:[.28,.66],cluster:2.2,near:1.0,wind:.018,lodModel,lodDistance:2.2,shadow:false});
}
export function plantShrubs(world,model,lodModel){
 plantModel(world,model,{name:'Low woody heath',seed:9901,count:220,radius:26,height:[.24,.48],cluster:2.2,near:1.4,wind:.012,lodModel,lodDistance:2.0});
 plantModel(world,model,{name:'Dense woodland bushes',seed:9943,count:260,radius:32,height:[.46,.95],cluster:2.8,near:1.6,wind:.014,lodModel,lodDistance:2.0});
 plantModel(world,model,{name:'Screening heath thickets',seed:9987,count:200,radius:32,height:[.85,1.55],cluster:3.0,near:3.0,wind:.010,lodModel,lodDistance:2.0,shadow:false});
 plantModel(world,model,{name:'Midground screening bushes',seed:52311,count:150,minRadius:2.2,radius:12.0,midground:true,height:[.52,1.15],cluster:2.4,near:1.6,wind:.014,lodModel,lodDistance:2.0,shadow:false});
 plantModel(world,model,{name:'Midground heath thickets',seed:52345,count:130,minRadius:2.0,radius:11.5,midground:true,height:[.32,.65],cluster:2.2,near:1.4,wind:.012,lodModel,lodDistance:2.0,shadow:false});
}
export function plantGrass(world,model,lodModel){
 plantModel(world,model,{name:'Low woodland grasses',seed:81351,count:4200,radius:38,height:[.055,.16],cluster:2.6,near:.5,wind:.016,shadow:false,variantPattern:/small|mid/,lodModel,lodDistance:2.2});
 plantModel(world,model,{name:'Leafy grass tussocks',seed:15382,count:2200,radius:30,height:[.09,.26],cluster:1.8,near:.6,wind:.021,shadow:false,variantPattern:/large/,nearPatches:true,lodModel,lodDistance:2.4});
 plantModel(world,model,{name:'Scattered grass seedheads',seed:86311,count:380,radius:34,height:[.20,.40],cluster:2.8,near:.8,wind:.024,shadow:false,variantPattern:/tall/});
}
// ── Dense foliage puff system ─────────────────────────────────────────
// Multi-plane volumetric foliage cluster: 10 oriented planes distributed spherically
// around the cluster center, ensuring an opaque 3D leaf cloud from every viewing angle.
function appendFoliagePuff(positions,uvs,normals,colors,indices,center,size,color,r,ao=1.0){
 const orientations=[];
 const count=10;
 for(let i=0;i<count;i++){
  const phi=Math.acos(1-2*(i+0.5)/count);
  const theta=Math.PI*(1+Math.sqrt(5))*(i+0.5)+r()*0.35;
  const nVec=new T.Vector3(
   Math.sin(phi)*Math.cos(theta),
   Math.cos(phi)*0.65,
   Math.sin(phi)*Math.sin(theta)
  ).normalize();
  const up=Math.abs(nVec.y)>0.88?new T.Vector3(1,0,0):new T.Vector3(0,1,0);
  const right=new T.Vector3().crossVectors(nVec,up).normalize();
  const realUp=new T.Vector3().crossVectors(right,nVec).normalize();
  orientations.push([right,realUp,nVec]);
 }
 const halfW=size*(.44+r()*.16),halfH=size*(.36+r()*.12);
 for(const [right,up,planeNormal]of orientations){
  const base=positions.length/3;
  const angle=(r()-.5)*2.6; // GH-39: vary spray roll; keep RNG calls and card count unchanged.
  const rotRight=right.clone().applyAxisAngle(planeNormal,angle);
  const rotUp=up.clone().applyAxisAngle(planeNormal,angle);
  const jitter=new T.Vector3((r()-.5)*size*.22,(r()-.5)*size*.14,(r()-.5)*size*.22);
  for(const [u,v,su,sv]of [[-1,-1,0,1],[-1,1,1,1],[1,-1,0,0],[1,1,1,0]]){
   const p=center.clone().add(jitter).addScaledVector(rotRight,u*halfW).addScaledVector(rotUp,v*halfH);
   positions.push(p.x,p.y,p.z);
   uvs.push(su,sv);
   // Rounded volumetric normal pointing outward from cluster center for soft 3D lighting
   const outNorm=p.clone().sub(center).normalize();
   const blendNorm=planeNormal.clone().lerp(outNorm,0.50).normalize();
   normals.push(blendNorm.x,blendNorm.y,blendNorm.z);
   const shade=(0.78+r()*.35)*ao;
   colors.push(color[0]*shade,color[1]*shade,color[2]*shade);
  }
  indices.push(base,base+1,base+2,base+1,base+3,base+2);
 }
}

// Sturdy main branch bough with 6-sided cross section
function appendBranchCylinder(positions,colors,indices,start,end,radiusStart,radiusEnd,segments,color){
 const axis=end.clone().sub(start),len=axis.length();if(len<.001)return;
 axis.normalize();
 const up=new T.Vector3(0,1,0),side=new T.Vector3().crossVectors(axis,up);
 if(side.lengthSq()<.001)side.crossVectors(axis,new T.Vector3(1,0,0));
 side.normalize();const other=new T.Vector3().crossVectors(axis,side).normalize();
 const segs=segments||6,rings=3,at=positions.length/3;
 for(let ring=0;ring<=rings;ring++){
  const t=ring/rings,radius=radiusStart+(radiusEnd-radiusStart)*t;
  const pos=start.clone().addScaledVector(axis,t*len);
  for(let i=0;i<segs;i++){
   const a=i/segs*TAU;
   const p=pos.clone().addScaledVector(side,Math.cos(a)*radius).addScaledVector(other,Math.sin(a)*radius);
   positions.push(p.x,p.y,p.z);
   const shade=1-t*.20;colors.push(color[0]*shade,color[1]*shade,color[2]*shade);
  }
 }
 for(let ring=0;ring<rings;ring++)for(let i=0;i<segs;i++){
  const n=(i+1)%segs,a=at+ring*segs+i,b=at+ring*segs+n,c=at+(ring+1)*segs+i,d=at+(ring+1)*segs+n;
  indices.push(a,b,c,b,d,c);
 }
}

// Generate Scots pine canopy: lush cloud-like foliage masses, hidden small branches, and dense crown
// Generate Scots pine canopy: lush cloud-like foliage masses, rugged primary limb scaffolding, and natural crown
function buildPineCanopy(source,height,{seed=91053,density=640,branchCount=130,cardPlanes=2,distant=false,crownBaseRatio=0.28}={}){
 const p=source.geometry.attributes.position,r=random(seed);
 const cards={positions:[],uvs:[],indices:[]};
 const foliage={positions:[],uvs:[],normals:[],colors:[],indices:[]};
 const branches={positions:[],colors:[],indices:[]};
 const center=new T.Vector3(),radial=new T.Vector3(),axis=new T.Vector3(),side=new T.Vector3(),plane=new T.Vector3(),up=new T.Vector3(0,1,0);

 // Deep, authentic forest conifer greens matching the reference photo
 const greens=[
  [.72,.86,.68],
  [.65,.80,.62],
  [.78,.92,.74],
  [.60,.75,.58],
  [.82,.95,.78],
  [.70,.84,.66]
 ];
 // Cool weathered grey-brown bark for structural boughs matching trunk
 const wood=[[.38,.34,.30],[.35,.31,.28],[.42,.38,.34]];

 // Foliage puff size: large clouds that form continuous voluminous masses
 const puffSize=height*(distant?.048:.072);
 const maxCrownRadius=height*(distant?.20:.27);

 const addFoliageCluster=(clusterCenter,clusterRadial,intensity=1,ao=1.0)=>{
  const col=greens[Math.floor(r()*greens.length)];
  appendFoliagePuff(foliage.positions,foliage.uvs,foliage.normals,foliage.colors,foliage.indices,clusterCenter,puffSize*intensity,col,r,ao);
 };

 const crownBase=height*(distant?.38:crownBaseRatio),crownTop=height*.88;

 // ── Weathered lower dead branch stubs below live crown (characteristic of mature pines) ─────
 if(!distant){
  const stubCount=1+Math.floor(r()*2);
  for(let s=0;s<stubCount;s++){
   const stubY=crownBase-height*(.018+s*.022);
   const stubAngle=r()*TAU;
   const stubLen=height*(.010+r()*.012);
   const stubRadius=height*.0075*(1-s*.15);
   const sCos=Math.cos(stubAngle),sSin=Math.sin(stubAngle);
   const trunkR=height*.016;
   const sStart=new T.Vector3(sCos*trunkR,stubY,sSin*trunkR);
   const sEnd=new T.Vector3(sCos*(trunkR+stubLen),stubY-stubLen*(.45+r()*.25),sSin*(trunkR+stubLen));
   const stubCol=[.36,.32,.28];
   appendBranchCylinder(branches.positions,branches.colors,branches.indices,
    sStart,sEnd,stubRadius,stubRadius*.25,5,stubCol);
  }
 }

 // ── Structural Boughs (rugged primary limbs radiating from trunk into foliage) ─────
 const whorls=distant?6:10,branchesPerWhorl=distant?4:7;
 for(let w=0;w<whorls;w++){
  const wt=w/(whorls-1);
  const branchY=crownBase+(crownTop-crownBase)*wt;
  const whorlRadius=height*(.10+(.22-wt*.16))*(distant?.72:1);
  // Rugged primary limbs reach 48-58% of crown radius, clearly visible from underneath
  const boughReach=whorlRadius*(.48+r()*.10);
  const branchRadius=height*(distant?.0030:.0055)*(1-wt*.38); // Sturdy realistic bough thickness
  const angleOffset=w*1.41+(r()-.5)*.4;
  for(let b=0;b<branchesPerWhorl;b++){
   const angle=angleOffset+b/branchesPerWhorl*TAU+(r()-.5)*.25;
   // Lowest whorl droops downward organically to soften transition from trunk
   const droop=w===0?(-.14-r()*.10):(-.04-r()*.08-wt*.04);
   const trunkR=height*.016*(1-wt*.45);
   const cosA=Math.cos(angle),sinA=Math.sin(angle);
   const branchStart=new T.Vector3(cosA*trunkR,branchY,sinA*trunkR);
   const midPoint=new T.Vector3(
    cosA*boughReach*.48+(-sinA)*(r()-.5)*boughReach*.08,
    branchY+boughReach*(.05+(r()-.5)*.02),
    sinA*boughReach*.48+cosA*(r()-.5)*boughReach*.08
   );
   const branchEnd=new T.Vector3(
    cosA*boughReach,
    branchY+boughReach*droop,
    sinA*boughReach
   );
   const woodCol=wood[Math.floor(r()*wood.length)];
   // Sturdy bough cylinder visible from underneath
   appendBranchCylinder(branches.positions,branches.colors,branches.indices,
    branchStart,midPoint,branchRadius,branchRadius*.72,6,woodCol);
   appendBranchCylinder(branches.positions,branches.colors,branches.indices,
    midPoint,branchEnd,branchRadius*.72,branchRadius*.45,5,woodCol);

   // Dense foliage pads along and extending past the bough reach to the full crown radius
   const nClusters=distant?5:8;
   for(let c=0;c<nClusters;c++){
    const t=.20+c/(nClusters-1)*.95;
    const radialDist=trunkR+(whorlRadius-trunkR)*t;
    const clusterY=branchY+radialDist*droop+(r()-.5)*puffSize*.35;
    const clusterPos=new T.Vector3(
     cosA*radialDist+(-sinA)*(r()-.5)*puffSize*.5,
     clusterY,
     sinA*radialDist+cosA*(r()-.5)*puffSize*.5
    );
    const ao=0.68+0.32*Math.min(1.0,radialDist/maxCrownRadius);
    addFoliageCluster(clusterPos,new T.Vector3(cosA,0,sinA),.85+r()*.35,ao);

    // Lateral flanking clusters to create thick horizontal bough clouds
    if(!distant&&c>=1){
     const flankDist=puffSize*(.42+r()*.22);
     const leftPos=clusterPos.clone().add(new T.Vector3(-sinA*flankDist,(r()-.5)*puffSize*.2,cosA*flankDist));
     const rightPos=clusterPos.clone().add(new T.Vector3(sinA*flankDist,(r()-.5)*puffSize*.2,-cosA*flankDist));
     addFoliageCluster(leftPos,new T.Vector3(cosA,0,sinA),.78+r()*.30,ao);
     addFoliageCluster(rightPos,new T.Vector3(cosA,0,sinA),.78+r()*.30,ao);
    }
   }
  }
 }

 // ── Dense Apical Crown Summit (closing the top against sky) ─────────
 const apexClusters=distant?14:26;
 for(let a=0;a<apexClusters;a++){
  const u=a/(apexClusters-1);
  const apexY=height*(.80+u*.18);
  const apexRadius=height*(.07*(1-u*.65))*(.7+r()*.5);
  const ang=r()*TAU;
  const apexPos=new T.Vector3(Math.cos(ang)*apexRadius,apexY+(r()-.5)*height*.02,Math.sin(ang)*apexRadius);
  addFoliageCluster(apexPos,new T.Vector3(Math.cos(ang),.3,Math.sin(ang)).normalize(),.95+r()*.4,0.95);
 }

 // ── Dense canopy fill from source vertex positions ───────────────────
 const shellDensity=distant?Math.min(density,100):Math.min(density,540);
 for(let i=0;i<shellDensity;i++){
  let j=0;for(let tries=0;tries<18;tries++){j=Math.floor(r()*p.count);if(p.getY(j)>crownBase&&Math.hypot(p.getX(j),p.getZ(j))>height*.020)break;}
  center.fromBufferAttribute(p,j);
  radial.set(center.x,0,center.z);if(radial.lengthSq()<.001)radial.set(1,0,0);radial.normalize();
  const depth=height*(distant?.006:.014);
  const clusterCenter=center.clone().addScaledVector(radial,(r()-.5)*depth).addScaledVector(up,(r()-.5)*depth*.6);
  const distR=Math.hypot(clusterCenter.x,clusterCenter.z);
  const ao=0.60+0.40*Math.min(1.0,distR/maxCrownRadius);
  addFoliageCluster(clusterCenter,radial,.80+r()*.40,ao);
 }

 // ── Inner volume fill (near/mid only) ────────────────────────────────
 if(!distant){
  const rings=10,samples=14;
  for(let ring=0;ring<rings;ring++)for(let i=0;i<samples;i++){
   const u=ring/(rings-1),a=(i/samples)*TAU+ring*.73+(r()-.5)*.35;
   const radius=height*(.035+(.20*(1-u*.65)))*(0.80+r()*.35);
   center.set(Math.cos(a)*radius,crownBase+(crownTop-crownBase)*u+(r()-.5)*height*.035,Math.sin(a)*radius);
   radial.set(Math.cos(a),0,Math.sin(a));
   addFoliageCluster(center,radial,.70+r()*.35,0.55);
  }
 }

 const makeGeo=(data,hasColors=false,hasNormals=false)=>{
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));
  if(data.uvs)g.setAttribute('uv',new T.Float32BufferAttribute(data.uvs,2));
  if(hasColors&&data.colors)g.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));
  if(hasNormals&&data.normals)g.setAttribute('normal',new T.Float32BufferAttribute(data.normals,3));
  g.setIndex(data.indices);
  if(!hasNormals)g.computeVertexNormals();
  return g;
 };
 return{
  cards:makeGeo(cards),
  foliage:makeGeo(foliage,true,true),
  branches:makeGeo(branches,true,false)
 };
}

// Dense foliage material: uses alpha map for needle silhouettes, double-sided, rich contrast SSS
function pineVolumeMaterial(world,diffuseMap){
 const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.85,metalness:0,side:T.DoubleSide,vertexColors:true,envMapIntensity:.52});
 if(diffuseMap){m.map=diffuseMap;}
 if(world?.foliageAlphaTextures?.['pine_tree_01']){
  const tile=pineNeedleTile(world.foliageAlphaTextures['pine_tree_01'],diffuseMap);
  m.map=tile.map;m.alphaMap=tile.alpha;
  m.alphaTest=.34;
  m.alphaToCoverage=true;
 }
 return foliageRendering(m,.24,.65,.5);
}

// Clean conifer trunk: procedural organic tapered Scots pine trunk with natural root buttresses,
// flared ground penetration, gentle trunk sway, and seamless vertical cylindrical 4K UV mapping.
export function cleanPineTrunkGeometry(srcGeometry){
 const positions=[],normals=[],uvs=[],indices=[];
 const rings=72,radial=48;
 const yMin=-0.45,yMax=12.5;

 for(let j=0;j<=rings;j++){
  const t=j/rings;
  const y=yMin+(yMax-yMin)*t;
  const flare=1.0+0.75*Math.pow(Math.max(0,(0.8-y)/1.25),2.0);
  const R=(0.28-0.20*Math.pow(t,0.70))*flare;
  const dx=0.04*Math.sin(y*0.5)+0.02*Math.cos(y*1.1);
  const dz=0.03*Math.cos(y*0.45)-0.02*Math.sin(y*0.9);

  // Use a backward derivative at the tip instead of dividing zero by zero.
  const tNext=(j===rings?j-0.5:j+0.5)/rings;
  const yNext=yMin+(yMax-yMin)*tNext;
  const flareNext=1.0+0.75*Math.pow(Math.max(0,(0.8-yNext)/1.25),2.0);
  const RNext=(0.28-0.20*Math.pow(tNext,0.70))*flareNext;
  const slopeY=-(RNext-R)/(yNext-y);

  const v=(y-yMin)*0.65;

  for(let i=0;i<=radial;i++){
   const uFrac=i/radial;
   const theta=uFrac*Math.PI*2;
   const buttress=0.08*Math.cos(3*theta+0.5)*Math.pow(Math.max(0,(1.2-y)/1.65),2.0);
   const rad=R+buttress;

   const px=dx+rad*Math.cos(theta);
   const pz=dz+rad*Math.sin(theta);
   positions.push(px,y,pz);

   const nLen=Math.hypot(Math.cos(theta),slopeY,Math.sin(theta))||1;
   normals.push(Math.cos(theta)/nLen,slopeY/nLen,Math.sin(theta)/nLen);

   uvs.push(uFrac*2.0,v);
  }
 }

 for(let j=0;j<rings;j++){
  for(let i=0;i<radial;i++){
   const p0=j*(radial+1)+i;
   const p1=p0+1;
   const p2=(j+1)*(radial+1)+i;
   const p3=p2+1;
   indices.push(p0,p2,p1);
   indices.push(p1,p2,p3);
  }
 }

 // Closed bottom cap at yMin to ensure watertight mesh
 const bottomCenterIdx=positions.length/3;
 positions.push(0.04*Math.sin(yMin*0.5)+0.02*Math.cos(yMin*1.1),yMin,0.03*Math.cos(yMin*0.45)-0.02*Math.sin(yMin*0.9));
 normals.push(0,-1,0);
 uvs.push(0,0);
 for(let i=0;i<radial;i++){
  indices.push(bottomCenterIdx,i+1,i);
 }

 const geom=new T.BufferGeometry();
 geom.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geom.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 geom.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 const colors=new Float32Array(positions.length).fill(1.0);
 geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));
 geom.setIndex(indices);
 geom.computeBoundingBox();
 geom.computeBoundingSphere();
 return geom;
}

// Branch skeleton material: wood-colored, vertex-colored
function pineBranchMaterial(){
 return new T.MeshStandardMaterial({color:'#ffffff',roughness:.94,metalness:0,side:T.DoubleSide,vertexColors:true,envMapIntensity:.55});
}
export function plantPines(world,model,distant=false){
 const box=new T.Box3().setFromObject(model),height=box.getSize(new T.Vector3()).y,sources=sourceMeshes(model),r=random(distant?81500:71032);
 const canopyPlacements=[],trunkPlacements=[];
 const deadWood=[[2.3,-1.5],[-3.6,2.8],[4.7,4.0],[-5.0,-5.4],[1.6,-7.8],[1.8,-.95],[4.2,3.8],[-4.7,-3.9]];
 for(let tries=0;tries<5000&&canopyPlacements.length<(distant?190:90);tries++){
   const a=r()*TAU,dist=distant?25+Math.sqrt(r())*43:4.5+Math.sqrt(r())*24,x=Math.cos(a)*dist,z=Math.sin(a)*dist+.8;
   if(Math.abs(x-creekX(z))<creekWidth(z)*.5+.80||Math.hypot(x,z-2.65)<3.0||deadWood.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<1.5)||canopyPlacements.some(p=>Math.hypot(x-p.x,z-p.z)<(dist<18?2.5:3.2)))continue;
   const roll=r();
   let h,trunkRatio,crownWidthRatio,tint;
   if(distant){
    if(roll<.22){h=12.5+r()*4;trunkRatio=.72+r()*.26;crownWidthRatio=.38+r()*.12;tint=.88+r()*.12;}
    else if(roll<.65){h=15.5+r()*5;trunkRatio=1.20+r()*.35;crownWidthRatio=.46+r()*.16;tint=.82+r()*.14;}
    else if(roll<.88){h=18.5+r()*6;trunkRatio=1.70+r()*.40;crownWidthRatio=.54+r()*.18;tint=.76+r()*.12;}
    else{h=21.5+r()*6;trunkRatio=2.30+r()*.55;crownWidthRatio=.62+r()*.20;tint=.70+r()*.12;}
   }else{
    if(roll<.22){h=(dist<13?10.5:12.0)+r()*3;trunkRatio=.70+r()*.28;crownWidthRatio=.36+r()*.12;tint=.88+r()*.12;}
    else if(roll<.65){h=(dist<13?12.5:14.5)+r()*4;trunkRatio=1.20+r()*.35;crownWidthRatio=.46+r()*.16;tint=.82+r()*.14;}
    else if(roll<.88){h=16.0+r()*6;trunkRatio=1.70+r()*.40;crownWidthRatio=.54+r()*.18;tint=.76+r()*.12;}
    else{h=17.5+r()*5.5;trunkRatio=2.35+r()*.55;crownWidthRatio=.62+r()*.20;tint=.70+r()*.12;}
   }
   const s=h/height,width=s*crownWidthRatio,trunkBase=s*trunkRatio;
   const aspect=1+(r()-.5)*.16,trunkSx=trunkBase*aspect,trunkSz=trunkBase/aspect;
   const embed=.045+trunkBase*.018;
   const baseProps={x,z,y:forestHeight(x,z)-embed,sy:s,rot:r()*TAU,rx:(r()-.5)*.03,rz:(r()-.5)*.035,tint,distance:Math.hypot(x,z-2.65)};
   canopyPlacements.push({...baseProps,sx:width,sz:width});
   const trunkTint=distant?.90+r()*.14:.96+r()*.14;
   trunkPlacements.push({...baseProps,sx:trunkSx,sz:trunkSz,tint:trunkTint});
  }
  const nearCanopy=canopyPlacements.filter(p=>p.distance<15),midCanopy=canopyPlacements.filter(p=>p.distance>=15);
  for(const src of sources){
   if(src.material.name.includes('dead_branches')||src.material.name.includes('pine_tree_01_bark'))continue;
   const isTrunk=src.material.name.includes('trunk');
   const isTwig=src.material.name.includes('twig'),label=distant?'Distant pine ':'Mature pine ';
    if(isTwig){
       const twigMat=scanMaterial(src.material,world,0);twigMat.color.setRGB(.70,.85,.65);twigMat.roughness=.94;twigMat.alphaTest=.35;
       const tiers=distant?[{placements:canopyPlacements,seed:91053,density:60,branches:20,planes:1,distant:true,crownBaseRatio:0.36,label:'distant'}]:[
        {placements:nearCanopy.filter((_,i)=>i%2===0),seed:91053,density:480,branches:150,planes:2,crownBaseRatio:0.22,label:'near low'},
        {placements:nearCanopy.filter((_,i)=>i%2!==0),seed:91077,density:480,branches:150,planes:2,crownBaseRatio:0.34,label:'near high'},
        {placements:midCanopy.filter((_,i)=>i%2===0),seed:91091,density:280,branches:96,planes:2,crownBaseRatio:0.24,label:'mid low'},
        {placements:midCanopy.filter((_,i)=>i%2!==0),seed:91105,density:280,branches:96,planes:2,crownBaseRatio:0.36,label:'mid high'}
       ];
       for(const tier of tiers){
        if(!tier.placements.length)continue;
        const canopy=buildPineCanopy(src,height,{seed:tier.seed,density:tier.density,branchCount:tier.branches,cardPlanes:tier.planes,distant:tier.distant,crownBaseRatio:tier.crownBaseRatio});
        instances(world,canopy.foliage,pineVolumeMaterial(world,src.material.map),tier.placements,`${label}${tier.label} foliage puffs`,!distant);
        instances(world,canopy.branches,pineBranchMaterial(),tier.placements,`${label}${tier.label} branch skeleton`,!distant);
       }
      continue;
    }
    const g=isTrunk?cleanPineTrunkGeometry(src.geometry):src.geometry.clone();
    if(!isTrunk)g.translate(0,-box.min.y,0);
    const m=scanMaterial(src.material,world,0);
    m.vertexColors=false;
    instances(world,g,m,trunkPlacements,label+src.material.name,!distant);
  }
  world.environmentCounts??={};world.environmentCounts[distant?'Distant pines':'Mature pines']=canopyPlacements.length;
 }

export async function loadForestDetails(world,gl,texture){
  const floor=async()=>{const [map,normalMap,roughnessMap,displacementMap]=await Promise.all([texture('forrest_ground_01/diff.jpg',true,1),texture('forrest_ground_01/nor_gl.jpg',false,1),texture('forrest_ground_01/rough.jpg',false,1),texture('forrest_ground_01/disp.jpg',false,1)]);Object.assign(world.groundMat,{map,normalMap,roughnessMap,displacementMap,displacementScale:.014,displacementBias:-.007});world.groundMat.normalScale.set(.6,.6);world.groundMat.needsUpdate=true;};
  const bed=async()=>{const [map,normalMap,roughnessMap]=await Promise.all([texture('sandy_gravel/diff.jpg',true,1),texture('sandy_gravel/nor_gl.jpg',false,1),texture('sandy_gravel/rough.jpg',false,1)]);world.creekTextures.creekMap.value=map;world.creekTextures.creekNormal.value=normalMap;world.creekTextures.creekRoughness.value=roughnessMap;world.groundMat.needsUpdate=true;applyStreambedTextures(world,{diffMap:map,normalMap,roughMap:roughnessMap});};
  const plant=async(id,options)=>{const [model,lod]=await Promise.all([gl.loadAsync(`./assets/${id}/${id}.gltf`),gl.loadAsync(`./assets/${id}_lod.glb`)]);plantModel(world,model.scene,{lodDistance:options.lodDistance||2.5,...options,lodModel:lod.scene});};
  const wood=async()=>{
   for(const [id,positions]of [
    ['tree_stump_01',[
     [2.3,-1.5,.8],[-3.6,2.8,.7],[4.7,4.0,1.2],
     // Midground stumps targeting sparse directions
     [2.8,0.4,.95],[3.8,2.6,1.0],[1.8,5.4,.95],[-4.2,1.2,1.0]
    ]],
    ['dead_tree_trunk',[
     [1.8,-.95,.65],[4.2,3.8,.8],[-4.7,-3.9,.5],
     // Midground fallen logs across empty ground belts
     [2.6,0.9,.85],[3.4,3.2,.95],[1.8,5.8,.90]
    ]]
   ]){const model=(await gl.loadAsync(id==='dead_tree_trunk'?'./assets/dead_tree_trunk_lod.glb':`./assets/${id}/${id}.gltf`)).scene,sources=sourceMeshes(model),r=random(id.length*232);
    sources.forEach((src,i)=>{const g=groundedGeometry(src),m=scanMaterial(src.material,world),sz=g.boundingBox.getSize(new T.Vector3()),max=Math.max(sz.x,sz.z);const p=positions.filter((_,j)=>j%sources.length===i).map(([x,z,s])=>({x,z,s:s/Math.max(.1,max),rot:r()*TAU,y:forestHeight(x,z)-.018,tint:.86+r()*.14}));instances(world,g,m,p,id,true);});
   }
   // Fallen dry branch clusters embedded in midground loam
   const branchModel=(await gl.loadAsync('./assets/dry_branches_medium_01/dry_branches_medium_01.gltf')).scene,branchSources=sourceMeshes(branchModel),rB=random(77319);
   const branchPositions=[
    [2.1,0.2,.85],[2.8,0.7,.80],[3.2,-0.5,.95],[3.9,-1.6,.90],
    [2.8,2.3,.85],[3.6,2.9,.95],[4.4,3.6,.90],[4.8,2.1,1.00],
    [1.3,4.7,.85],[2.4,5.3,.95],[0.8,6.3,.80],[-1.1,5.1,.85],
    [-3.8,0.7,.90],[-4.4,-0.6,.95],[-4.2,2.7,.85],[-3.5,4.4,.90]
   ];
   // GH-37: short root/debris fragments settle on both sides of the bank
   // shoulder. They are explicit edge accents, not a terrain-wide scatter.
   for(const [z,side,offset,scale] of [
    [-1.25,1,.16,.66],[-.42,-1,.20,.60],[.36,1,.18,.62],[1.18,-1,.17,.58],
    [1.96,1,.22,.70],[2.74,-1,.16,.64],[3.56,1,.20,.58],[4.28,-1,.18,.66]
   ]){
    const hw=creekWidth(z)*.5,x=creekX(z)+creekBankMeander(z)+side*(hw+offset);
    branchPositions.push([x,z,scale]);
   }
   branchSources.forEach((src,i)=>{const g=groundedGeometry(src),m=scanMaterial(src.material,world),sz=g.boundingBox.getSize(new T.Vector3()),max=Math.max(sz.x,sz.z);const p=branchPositions.filter((_,j)=>j%branchSources.length===i).map(([x,z,s])=>({x,z,s:s/Math.max(.1,max),rot:rB()*TAU,rx:(rB()-.5)*.10,rz:(rB()-.5)*.10,y:forestHeight(x,z)-.022,tint:.80+rB()*.18}));instances(world,g,m,p,'Fallen dry branches',true);});
  };
  await Promise.all([...world.foliageAlphaReady,floor(),bed(),wood(),
   plant('shrub_02',{name:'Lance-leaf saplings',seed:31351,count:300,radius:34,height:[.80,2.10],cluster:3.4,near:2.0,wind:.016,lodDistance:2.0}),
   plant('shrub_02',{name:'Midground lance saplings',seed:41921,count:130,minRadius:2.4,radius:12.5,midground:true,height:[.85,2.05],cluster:2.6,near:2.0,wind:.015,lodDistance:2.0,shadow:false}),
   plant('shrub_03',{name:'Paired-leaf understory',seed:78011,count:500,radius:34,height:[.22,.68],cluster:2.8,near:1.6,wind:.018,lodDistance:1.8,shadow:false}),
   plant('shrub_03',{name:'Midground paired understory',seed:89123,count:240,minRadius:2.0,radius:12.0,midground:true,height:[.26,.72],cluster:2.4,near:1.6,wind:.018,lodDistance:1.8,shadow:false}),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/fir_sapling_lod.glb'),gl.loadAsync('./assets/fir_far_lod.glb')]);
    plantModel(world,model.scene,{name:'Conifer seedlings',seed:14502,count:200,radius:30,height:[.45,1.15],cluster:2.6,near:2.0,wind:.012,lodModel:lod.scene,lodDistance:2.6,shadow:false});
    plantModel(world,model.scene,{name:'Conifer saplings',seed:28901,count:220,radius:32,height:[1.10,2.20],cluster:2.8,near:2.4,wind:.010,lodModel:lod.scene,lodDistance:2.8,shadow:false});
    plantModel(world,model.scene,{name:'Midground conifer saplings',seed:33412,count:120,minRadius:2.6,radius:12.5,midground:true,height:[1.10,2.30],cluster:2.6,near:2.2,wind:.010,lodModel:lod.scene,lodDistance:2.8,shadow:false});
    plantModel(world,model.scene,{name:'Young firs',seed:22281,count:340,radius:34,height:[2.10,4.20],cluster:3.0,near:2.8,wind:.009,lodModel:lod.scene,lodDistance:3.0});
    plantModel(world,model.scene,{name:'Midground young firs',seed:44198,count:140,minRadius:3.0,radius:13.5,midground:true,height:[1.80,3.90],cluster:2.8,near:2.6,wind:.009,lodModel:lod.scene,lodDistance:3.0});
    plantModel(world,model.scene,{name:'Wooded slope firs',seed:67812,count:300,radius:42,height:[3.60,7.20],cluster:3.2,near:3.5,belt:true,wind:.006,lodModel:lod.scene,lodDistance:4.5,shadow:false});
   })(),
   (async()=>{const [model]=await Promise.all([gl.loadAsync('./assets/pine_distant.glb'),world.pineBarkReady,...world.foliageAlphaReady]);plantPines(world,model.scene,true);})()
  ]);
 }

export function updateEnvironment(world,dt,sim,settings){
  const storm=settings.weather==='rain',mist=settings.weather==='mist',morning=sim.upgraded;
  if(world.daylightDay!==sim.day){world.daylightDay=sim.day;world.sun.position.set(morning?12:-12,morning?18:26,morning?-7:-9);world.sun.color.set(morning?'#f4ecd9':'#ffe8bc');world.stream.material.uniforms.sunDirection.value.copy(world.sun.position).normalize();}
  world.scene.fog.color.set(storm?'#536052':mist?'#889784':morning?'#5b6f60':'#536657');
  world.forestSky.material.uniforms.horizon.value.copy(world.scene.fog.color);
  world.forestSky.material.uniforms.zenith.value.set(storm?'#687977':mist?'#a4b1a9':morning?'#a0bed2':'#8da8bc');
  world.scene.fog.near=storm?10:mist?5:20;world.scene.fog.far=storm?46:mist?36:64;
 world.sun.intensity=storm?.65:mist?1.05:morning?2.8:3.8;
 world.renderer.toneMappingExposure=storm?.87:.94;
 if(world.forestHemisphere)world.forestHemisphere.intensity=storm?.95:mist?1.4:1.05;
 if(world.rain)world.rain.visible=storm;
 // Keep the established water appearance and slow only its animation clock.
 // Geometry and normal-map wavelengths/amplitudes stay unchanged.
 world.stream.material.uniforms.time.value+=dt*.42;
 world.stream.material.uniforms.distortionScale.value=0.05+settings.wind*0.03;
}
