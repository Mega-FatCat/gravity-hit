import * as T from 'three';
import {createStreamWater} from './stream-water.js';
import {buildForestClutter} from './clutter.js';
import {buildStreambed,applyStreambedTextures} from './streambed.js';
import {foliageRendering,foliageDepthMaterial,pineNeedleTile} from './foliage-rendering.js';
import {foliageMipmaps} from './foliage-mipmaps.js';

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
  list.forEach((p,i)=>{d.position.set(p.x,p.y??forestHeight(p.x,p.z),p.z);if(p.q)d.quaternion.set(p.q[0],p.q[1],p.q[2],p.q[3]);else d.rotation.set(p.rx||0,p.rot||0,p.rz||0);d.scale.set(p.sx??p.s??1,p.sy??p.s??1,p.sz??p.s??1);d.updateMatrix();m.setMatrixAt(i,d.matrix);const light=p.tint??1;color.setRGB(light,light*(p.green??1),light*(p.blue??1));m.setColorAt(i,color);});
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
   // FOREST-TEXTURE-01: the scan already carries believable species colour,
   // age mottling and vein variation.  The older saturated multiplier crushed
   // that information into one synthetic green.  Keep only a restrained,
   // species-scale bias so the actual high-resolution albedo remains visible.
   m.roughness=.78;m.metalness=0;m.envMapIntensity=.58;
   m.normalScale?.set(.58,.58);
   if(source.name.includes('shrub_03')){
    m.color.setRGB(.79,.88,.75); // darker paired-leaf understory
   }else if(source.name.includes('shrub_02')){
    m.color.setRGB(.84,.93,.80); // lance-leaf sapling, close to native scan
   }else{
    m.color.setRGB(.86,.92,.78); // warmer woody heath
   }
  }else if(isFern){
   m.roughness=.80;m.metalness=0;m.envMapIntensity=.54;
   m.color.setRGB(.86,.93,.80);
   m.normalScale?.set(.58,.58);
  }else{
   m.normalScale?.set(.55,.55);
  }
  // GH-39: retain bark relief without exaggerating fine normal-map contrast.
  if(pineBark){m.map=pineBark.map;m.normalMap=pineBark.normalMap;m.roughnessMap=pineBark.roughnessMap;m.roughness=.90;m.metalness=0;m.color.setRGB(.72,.66,.60);m.normalScale?.set(1.25,1.25);m.envMapIntensity=.50;m.needsUpdate=true;}
  const alphaKey=source.name.includes('pine_tree_01_twig')?'pine_tree_01':source.name.includes('fir_sapling_twigs')?'fir_sapling':source.name;
  // FOREST-TEXTURE-02: the original broadleaf atlases are intentionally pale
  // capture-neutral scans.  Across hundreds of instances that turned the whole
  // midground into the silver/cyan card wall visible in the user's screenshot.
  // Use the offline forest-tuned scan atlases instead; all photographed veins,
  // blemishes and stems remain intact, only woodland value/contrast is restored.
  if(world.foliageDiffuseTextures?.[alphaKey]){
   m.map=world.foliageDiffuseTextures[alphaKey];
   // Keep the forest-tuned atlas from being washed back toward white by the
   // material multiplier.  The source scans are capture-neutral; in the game
   // they need a restrained woodland-green bias so shaded bushes remain green
   // rather than silver/cyan while preserving the photographed vein detail.
   if(alphaKey==='shrub_03')m.color.setRGB(.78,.88,.70);
   else if(alphaKey==='shrub_02')m.color.setRGB(.80,.90,.72);
   else if(alphaKey==='shrub_04')m.color.setRGB(.82,.90,.74);
   else m.color.setRGB(.92,.94,.88);
  }
  if(alphaKey==='fir_sapling'){
   // Fir needles are genuine geometry.  The offline forest atlas now carries
   // the darker chlorophyll value, so keep this multiplier nearly neutral; the
   // old .38/.54/.30 multiplier crushed all photographed needle variation while
   // the untouched scan itself still read pale in backlight.
   m.color.setRGB(.62,.76,.52);m.roughness=.92;m.envMapIntensity=.20;m.normalScale?.set(.26,.26);
  }
  // Fir needles are modeled opaque geometry, not cutout cards.
  if(alphaKey==='fir_sapling'||alphaKey==='shrub_01'){m.alphaMap=null;m.alphaTest=0;m.alphaToCoverage=false;}
   else if(world.foliageAlphaTextures?.[alphaKey]){
    m.alphaMap=world.foliagePackedTextures?.[alphaKey]?null:world.foliageAlphaTextures[alphaKey];
    m.alphaTest=isShrub?.22:isFern?.22:.28;
    m.alphaToCoverage=true;
   }else if(m.alphaTest)m.alphaTest=.20;
  if(m.map)m.map.anisotropy=16;
  if(m.normalMap)m.normalMap.anisotropy=16;
  if(m.roughnessMap)m.roughnessMap.anisotropy=16;
  if(wind){world.addWind(m,wind);m.userData.foliageWind=wind;}
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
 if(!isBark&&(isShrub||m.alphaMap||alphaKey==='fir_sapling')){
  if(isShrub)foliageRendering(m,.25,.20,1.0,2.45);
  else if(isFern)foliageRendering(m,.24,.42,1.0,1.35);
  else if(alphaKey==='fir_sapling')foliageRendering(m,.08,.06,1.0,1.35);
  else foliageRendering(m,.22,.28,1.0,1.48);
 }
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
 const alphaLoader=new T.TextureLoader();world.foliageAlphaTextures={};world.foliageDiffuseTextures={};world.foliagePackedTextures={};world.foliageAlphaReady=[];
  for(const id of ['fern_02','shrub_02','shrub_03','shrub_04','grass_medium_01','pine_tree_01','fir_sapling']){
   // Scanned broadleaf masks shipped nearly binary.  Use the generated narrow
   // coverage ramp for those assets; conifers/grass keep their authored masks.
   const alphaFile=/^(fern_02|shrub_0[234])$/.test(id)?'alpha_forest.png':'alpha.png';
   world.foliageAlphaReady.push(new Promise((resolve,reject)=>{const texture=alphaLoader.load(`./assets/${id}/${alphaFile}`,resolve,undefined,reject);texture.flipY=false;texture.anisotropy=8;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;world.foliageAlphaTextures[id]=texture;}));
  }
  for(const id of ['shrub_02','shrub_03','shrub_04']){
   world.foliageAlphaReady.push(new Promise((resolve,reject)=>{
    const texture=alphaLoader.load(`./assets/${id}/diff_forest_rgba.png`,loaded=>{
     try{foliageMipmaps(loaded,.26);resolve(loaded);}catch(error){reject(error);}
    },undefined,reject);
    texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=16;
    texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
    world.foliageDiffuseTextures[id]=texture;
    world.foliagePackedTextures[id]=texture;
   }));
  }
  for(const id of ['fir_sapling','shrub_01'])world.foliageAlphaReady.push(new Promise((resolve,reject)=>{
   const texture=alphaLoader.load(`./assets/${id}/diff_forest.png`,resolve,undefined,reject);
   texture.flipY=false;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=16;
   texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;
   world.foliageDiffuseTextures[id]=texture;
  }));
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
 world.groundMesh=addMesh(world,geo,world.groundMat,'Forest loam â€˘ high-resolution near-field relief');world.groundMesh.castShadow=false;
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

function plantModel(world,model,{name,seed,count,radius=17,minRadius=0,height=[.2,.5],wind=.025,near=.9,shadow=true,cluster=1.8,maxTriangles=Infinity,belt=false,midground=false,variantPattern=null,nearPatches=false,lodModel=null,lodDistance=6,layered=false,layerScale=.76,layerYScale=.90,layerMaxDistance=8,visualFamilies=null,primaryWeight=1,scatterChance=null}){
 const randomPlant=random(seed);
 const acceptVariants=source=>plantVariants(source).filter(v=>(!variantPattern||variantPattern.test(v.name))&&v.parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0)<=maxTriangles);
 const familyDefs=[{model,lodModel,weight:primaryWeight,lodDistance},...(visualFamilies??[])];
 const families=familyDefs.map((def,familyIndex)=>{
  const variants=acceptVariants(def.model);
  if(!variants.length)throw new Error(`No plant variants for ${name} family ${familyIndex+1}`);
  return{
   variants,
   sets:variants.map(()=>[]),
   lods:new Map(def.lodModel?plantVariants(def.lodModel).map(v=>[v.name,v]):[]),
   weight:Math.max(0,def.weight??1),
   widthScale:def.widthScale??1,
   heightScale:def.heightScale??1,
   tiltScale:def.tiltScale??1,
   layered:def.layered??true,
   lodDistance:def.lodDistance??lodDistance,
   label:def.label??(familyIndex===0?'primary':`family ${familyIndex+1}`)
  };
 });
 const totalFamilyWeight=families.reduce((sum,f)=>sum+f.weight,0)||1;
 const chooseFamily=roll=>{let cursor=roll*totalFamilyWeight;for(let fi=0;fi<families.length;fi++){cursor-=families[fi].weight;if(cursor<=0)return fi;}return families.length-1;};
 const centers=[];
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
   const anchor=sparseAnchors[i];
   const ja=hash(seed%997+i*43,i*71+17)*TAU;
   const jr=.16+hash(seed%613+i*59,i*31+29)*.30;
   centers.push([anchor[0]+Math.cos(ja)*jr,anchor[1]+Math.sin(ja)*jr]);
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
  if(randomPlant()<(scatterChance??(midground?0.40:0.35))){
   const a=randomPlant()*TAU;
   const r=nearPatches?1.5+randomPlant()*5.5:belt?6+Math.sqrt(randomPlant())*(radius-6):midground?(minRadius||2.2)+(randomPlant()*.7+Math.sqrt(randomPlant())*.3)*(radius-(minRadius||2.2)):1.3+Math.sqrt(randomPlant())*(radius-1.3);
   const cz=randomPlant()<0.5?.8:2.2;
   x=Math.cos(a)*r;z=Math.sin(a)*r+cz;
  }else{
   const c=centers[i%centers.length],a=randomPlant()*TAU,r=Math.sqrt(randomPlant())*cluster;
   x=c[0]+Math.cos(a)*r;z=c[1]+Math.sin(a)*r;
  }
  const h=lerp(height[0],height[1],randomPlant());
  // Species/model choice is a pure position hash: no extra RNG calls, no root
  // movement, and no change to clustering.  This lets one existing shrub root
  // render a different scan family instead of cloning the lance-leaf silhouette
  // hundreds of times across the same forest.
  const familyRoll=hash(Math.round(x*31.7)+seed%991,Math.round(z*31.7)+seed%659);
  const familyIndex=chooseFamily(familyRoll),family=families[familyIndex];
  const index=i%family.variants.length,variant=family.variants[index],s=h/Math.max(.04,variant.height);
  const isBush=/shrub|sapling|heath|understory|fir/i.test(name);
  // Keep roots on the damp bank shoulder, never in the water trough. A
  // slightly wider exclusion for woody bushes removes the few apparent
  // floating shrubs while leaving plants that grow out of the bank intact.
  const rootY=forestHeight(x,z);
  const bankRootClearance=isBush?.105:.060;
  // Keep a shrub's low stem/base on the damp shoulder as well as its root
  // point. This removes the few visually floating bushes whose foliage base
  // overhung the water even though their instance center was outside it.
  const lowBaseReach=isBush?Math.min(.12,(variant.baseRadius??0)*s*family.widthScale):Math.min(.08,(variant.baseRadius??0)*s*.55*family.widthScale);
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
   // Correlated plant-scale variation rather than per-leaf neon noise.  The
   // texture supplies the fine colour detail; instance colour only separates
   // mature, shaded and young patches.
   if(accent<.78){green=.97+greenBase*.05;blue=.92+blueBase*.06;tint=.90+tintBase*.09;sxMul=.85+sxBase*.35;syMul=.92+greenBase*.16;szMul=.85+szBase*.35;}
   else if(accent<.90){green=.94+greenBase*.05;blue=.88+blueBase*.06;tint=.83+tintBase*.10;sxMul=.90+sxBase*.35;syMul=.78+greenBase*.16;szMul=.90+szBase*.35;}
   else{green=1.00+greenBase*.05;blue=.90+blueBase*.06;tint=.94+tintBase*.08;sxMul=.78+sxBase*.28;syMul=1.02+greenBase*.20;szMul=.78+szBase*.28;}
  }else if(isBush){
   if(accent<.68){green=.97+greenBase*.05;blue=.92+blueBase*.06;tint=.89+tintBase*.09;sxMul=.85+sxBase*.35;syMul=.92+greenBase*.16;szMul=.85+szBase*.35;}
   else if(accent<.84){green=1.00+greenBase*.05;blue=.87+blueBase*.07;tint=.94+tintBase*.08;sxMul=.76+sxBase*.20;syMul=1.06+greenBase*.20;szMul=.76+szBase*.20;}
   else{green=.95+greenBase*.05;blue=.90+blueBase*.06;tint=.82+tintBase*.10;sxMul=1.06+sxBase*.30;syMul=.80+greenBase*.15;szMul=1.06+szBase*.30;}
  }else{green=isBush?.96+greenBase*.08:1;blue=isBush?.88+blueBase*.10:.90+blueBase*.08;tint=.80+tintBase*.20;sxMul=.85+sxBase*.35;syMul=1;szMul=.85+szBase*.35;}
  const branchySolid=family.label.includes('solid branch');
  const cardBroadleaf=family.label==='paired broadleaf'||family.label==='woody broadleaf';
  const cardShape=cardBroadleaf?hash(Math.round(x*71)+seed%919,Math.round(z*67)+seed%857):.5;
  const cardLeanX=cardBroadleaf?(hash(Math.round(x*43)+seed%733,Math.round(z*79)+11)-.5)*.24:0;
  const cardLeanZ=cardBroadleaf?(hash(Math.round(x*83)+29,Math.round(z*41)+seed%701)-.5)*.24:0;
  const cardHeight=cardBroadleaf?.76+cardShape*.52:1,cardWidth=cardBroadleaf?.88+(1-cardShape)*.20:1;
  const branchTiltX=branchySolid?.58+hash(Math.round(x*53)+seed%887,Math.round(z*59)+31)*.34:0;
  const branchTiltZ=branchySolid?(hash(Math.round(x*61)+17,Math.round(z*47)+seed%809)-.5)*.46:0;
  // Keep scanned branch masses rooted into the understory. The positive lift
  // used previously made some leaf sprays look detached and hover in mid-air.
  family.sets[index].push({x,z,y:forestHeight(x,z)-(branchySolid?.045:.007),sx:s*sxMul*family.widthScale*cardWidth,sy:s*syMul*family.heightScale*cardHeight,sz:s*szMul*family.widthScale*cardWidth,rot:rotBase*TAU,rx:rx*family.tiltScale+branchTiltX+cardLeanX,rz:rz*family.tiltScale+branchTiltZ+cardLeanZ,tint:branchySolid?tint*.82:tint,green:branchySolid?green*.94:green,blue:branchySolid?blue*.78:blue});
 }
 families.forEach((family,fi)=>family.variants.forEach((variant,i)=>{if(!family.sets[i].length)return;const lod=family.lods.get(variant.name),close=lod?family.sets[i].filter(p=>Math.hypot(p.x,p.z-2.65)<family.lodDistance):family.sets[i],far=lod?family.sets[i].filter(p=>Math.hypot(p.x,p.z-2.65)>=family.lodDistance):[];
 variant.parts.forEach(part=>{
   const material=scanMaterial(part.material,world,wind),low=lod?.parts.find(p=>p.material.name===part.material.name);
   const familyLabel=families.length>1?` ${family.label}`:'';
   const familyCardBroadleaf=family.label==='paired broadleaf'||family.label==='woody broadleaf';
   if(close.length)instances(world,part.geometry,material,close,`${name}${familyLabel} variant ${i+1}`,shadow);
   if(far.length){
    // At LOD distance the individual photographed leaf tips are smaller than a
    // pixel. A slightly lower coverage cutoff lets neighbouring tips resolve as
    // one branchlet mass instead of alternating black/bright pinholes while the
    // custom mip chain still preserves the authored total coverage.
    const farMaterial=scanMaterial(part.material,world,wind);
    if(farMaterial.alphaTest>0)farMaterial.alphaTest=Math.max(.24,farMaterial.alphaTest*1.08);
    instances(world,low?.geometry??part.geometry,farMaterial,far,`${name}${familyLabel} variant ${i+1} distant`,shadow);
   }
   // A real shrub is not a single radial sheet. Keep the exact root, but make
   // the secondary volume unique per plant instead of applying one identical
   // .79-radian rotation to every clone in the forest.
   if(layered&&family.layered&&close.length){
    // The paired broadleaf scan is already made from several photographed leaf
    // planes. Duplicating it again at mid-distance made a few bushes read as
    // obvious stacked shells (the "several layers on top of each other" bug).
    // Keep the extra inner copy only where the player is close enough to resolve
    // the added 3D volume. Solid scanned branches and the primary shrub can keep
    // their wider layering range because their silhouette does not collapse into
    // parallel cards.
    const layeredDistance=midground
     ?Math.min(layerMaxDistance,familyCardBroadleaf?4.6:5.2)
     :(familyCardBroadleaf?Math.min(layerMaxDistance,4.8):layerMaxDistance);
    const layeredPlacements=close.filter(p=>Math.hypot(p.x,p.z-2.65)<layeredDistance);
    if(layeredPlacements.length){
     const detail=part.geometry.clone();
     detail.computeBoundingBox();detail.computeBoundingSphere();
     const inner=layeredPlacements.map((p,j)=>{
      const h1=hash(Math.round(p.x*137)+i*17+j,Math.round(p.z*131)+fi*29),h2=hash(Math.round(p.x*83)+41,Math.round(p.z*97)+j*7);
      const scale=layerScale*(.84+h1*.26);
      return{...p,y:(p.y??forestHeight(p.x,p.z))+(.015+h2*.035)*(p.sy??1),rot:(p.rot??0)+.48+h1*1.35+i*.17,
       rx:(p.rx??0)+(h2-.5)*.16,rz:(p.rz??0)+(h1-.5)*.14,sx:(p.sx??1)*scale,sy:(p.sy??1)*layerYScale*(.90+h2*.18),sz:(p.sz??1)*scale,
       tint:(p.tint??1)*(.94+h2*.05)};
     });
     instances(world,detail,material,inner,`${name}${familyLabel} variant ${i+1} varied inner volume`,shadow);

     // Only the player-resolvable bushes get a third, much smaller lobe.  It is
     // still the same root and species, but breaks the last obvious X/fan read
     // without multiplying the entire mid/far forest cost.
     const nearInner=layeredPlacements.filter(p=>Math.hypot(p.x,p.z-2.65)<4.6).map((p,j)=>{
      const h1=hash(Math.round(p.x*173)+j*11,Math.round(p.z*149)+i*31),h2=hash(Math.round(p.x*71)+19,Math.round(p.z*67)+j*13);
      const scale=layerScale*(.50+h1*.16);
      return{...p,y:(p.y??forestHeight(p.x,p.z))+(.05+h2*.06)*(p.sy??1),rot:(p.rot??0)-.62-h1*1.18,
       rx:(p.rx??0)+(h1-.5)*.22,rz:(p.rz??0)+(h2-.5)*.20,sx:(p.sx??1)*scale,sy:(p.sy??1)*layerYScale*(.58+h2*.14),sz:(p.sz??1)*scale,
       tint:(p.tint??1)*(.91+h1*.06)};
     });
     if(nearInner.length)instances(world,detail,material,nearInner,`${name}${familyLabel} variant ${i+1} close crown lobe`,shadow);

     // A fourth, offset lobe on only the closest resolvable shrubs turns the
     // remaining sparse red-stem/fan silhouettes into a compact woody volume.
     // Keep it smaller than the authored shell so it fills interior voids
     // without inflating the plant footprint or moving the root.
     const closeCore=layeredPlacements.filter((p,j)=>Math.hypot(p.x,p.z-2.65)<3.0&&hash(Math.round(p.x*211)+j*31,Math.round(p.z*199)+i*13)>.48).map((p,j)=>{
      const h1=hash(Math.round(p.x*191)+j*23+i*5,Math.round(p.z*181)+fi*17),h2=hash(Math.round(p.x*101)+29,Math.round(p.z*109)+j*19);
      const scale=layerScale*(.39+h1*.13);
      return{...p,y:(p.y??forestHeight(p.x,p.z))+(.10+h2*.07)*(p.sy??1),rot:(p.rot??0)+1.48+h1*.92,
       rx:(p.rx??0)+(h2-.5)*.25,rz:(p.rz??0)+(h1-.5)*.22,sx:(p.sx??1)*scale,sy:(p.sy??1)*layerYScale*(.48+h2*.12),sz:(p.sz??1)*scale,
       tint:(p.tint??1)*(.90+h2*.05)};
     });
     if(closeCore.length)instances(world,detail,material,closeCore,`${name}${familyLabel} variant ${i+1} close woody core`,shadow);
    }
   }
  });
 }));
 world.environmentCounts??={};world.environmentCounts[name]=families.reduce((sum,f)=>sum+f.sets.reduce((n,p)=>n+p.length,0),0);
}
export function plantFerns(world,model,lodModel){
 plantModel(world,model,{name:'Stream-bank fern colonies',seed:3511,count:1200,radius:28,height:[.24,.68],cluster:2.4,near:1.0,wind:.020,lodModel,lodDistance:2.2,shadow:false});
 plantModel(world,model,{name:'Woodland fern carpets',seed:3577,count:1400,radius:38,height:[.20,.58],cluster:3.0,near:1.1,wind:.016,lodModel,lodDistance:2.2,shadow:false});
 plantModel(world,model,{name:'Midground fern understory',seed:41022,count:550,minRadius:1.8,radius:12.5,midground:true,height:[.28,.66],cluster:2.2,near:1.0,wind:.018,lodModel,lodDistance:2.2,shadow:false});
}
export function plantShrubs(world,model,lodModel,broadleafModel=null,broadleafLod=null,solidBroadleafModel=null){
 const families=(cardWeight,solidWeight,lodDistance)=>{
  const result=[];
  if(broadleafModel)result.push({model:broadleafModel,lodModel:broadleafLod,weight:cardWeight,lodDistance,label:'paired broadleaf',widthScale:.90,heightScale:1.00,tiltScale:1.28});
  // shrub_01 is a real scanned branch with individually modelled leaf geometry.
  // Use it sparingly as the woody core of bushes: it contributes genuine depth
  // and curved leaf silhouettes without reproducing the repeated alpha-card
  // carpet. Its source branch is long and low, so compress X/Z and allow more
  // pitch/roll variation. Never layer-clone this expensive solid mesh.
  if(solidBroadleafModel)result.push({model:solidBroadleafModel,lodModel:null,weight:solidWeight,lodDistance,label:'solid branchy broadleaf',widthScale:.18,heightScale:.96,tiltScale:1.38,layered:false});
  return result;
 };
 plantModel(world,model,{name:'Low woody heath',seed:9901,count:200,radius:26,height:[.22,.42],cluster:1.7,near:1.4,wind:.012,lodModel,lodDistance:5.0,primaryWeight:.34,visualFamilies:families(.36,.30,6.0),layered:true,layerScale:.84,layerYScale:.90,layerMaxDistance:5.8,scatterChance:.18});
 plantModel(world,model,{name:'Dense woodland bushes',seed:9943,count:240,radius:32,height:[.34,.72],cluster:2.0,near:1.6,wind:.014,lodModel,lodDistance:6.8,primaryWeight:.16,visualFamilies:families(.50,.34,8.2),layered:true,layerMaxDistance:8.2,scatterChance:.16});
 plantModel(world,model,{name:'Screening heath thickets',seed:9987,count:165,radius:32,height:[.58,1.08],cluster:2.1,near:3.0,wind:.010,lodModel,lodDistance:7.8,primaryWeight:.24,visualFamilies:families(.44,.32,9.0),layered:true,layerScale:.72,layerYScale:.86,layerMaxDistance:8.5,scatterChance:.18,shadow:false});
 // In the second visual plane prefer the real scanned solid branch family over
 // the old shrub_04 cards. This removes the remaining low-quality tufts without
 // moving roots or thinning the understory that is already working well.
 plantModel(world,model,{name:'Midground screening bushes',seed:52311,count:125,minRadius:2.2,radius:12.0,midground:true,height:[.40,.82],cluster:1.8,near:1.6,wind:.014,lodModel,lodDistance:9.0,primaryWeight:.02,visualFamilies:families(.38,.60,9.5),layered:true,layerScale:.74,layerMaxDistance:8.0,scatterChance:.16,shadow:false});
 plantModel(world,model,{name:'Midground heath thickets',seed:52345,count:110,minRadius:2.0,radius:11.5,midground:true,height:[.24,.50],cluster:1.7,near:1.4,wind:.012,lodModel,lodDistance:8.0,primaryWeight:.03,visualFamilies:families(.37,.60,9.0),layered:true,layerScale:.80,layerYScale:.88,layerMaxDistance:7.5,scatterChance:.17,shadow:false});
}
export function plantGrass(world,model,lodModel){
 plantModel(world,model,{name:'Low woodland grasses',seed:81351,count:4200,radius:38,height:[.055,.16],cluster:2.6,near:.5,wind:.016,shadow:false,variantPattern:/small|mid/,lodModel,lodDistance:2.2});
 plantModel(world,model,{name:'Leafy grass tussocks',seed:15382,count:2200,radius:30,height:[.09,.26],cluster:1.8,near:.6,wind:.021,shadow:false,variantPattern:/large/,nearPatches:true,lodModel,lodDistance:2.4});
 plantModel(world,model,{name:'Scattered grass seedheads',seed:86311,count:380,radius:34,height:[.20,.40],cluster:2.8,near:.8,wind:.024,shadow:false,variantPattern:/tall/});
}
// â”€â”€ Branchlet foliage spray system â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FOREST-TEXTURE-01: the old canopy built every cluster as a 10-plane ball.
// From normal viewing distances that collapsed into the repeated diagonal
// "feather/puff" pattern visible in the pre-fix capture.  A real conifer crown
// is read as bough -> branchlet -> needle spray with air between sprays.  These
// folded ribbons keep a small amount of genuine 3D volume, but share the parent
// bough direction instead of presenting ten unrelated rectangles to the eye.
function appendFoliagePuff(positions,uvs,normals,colors,indices,center,size,color,r,ao=1.0,flowDirection=null,solidNeedles=false){
 const upWorld=new T.Vector3(0,1,0);
 const flow=(flowDirection?.clone()??new T.Vector3(1,0,0));
 flow.y*=.28;
 if(flow.lengthSq()<1e-5)flow.set(1,0,0);
 flow.normalize();
 // Near and mid crowns now use actual tapered needle strips rather than broad
 // alpha-cutout ribbons.  That removes the visible rectangular/card language
 // that remained in the previous pass while keeping distant crowns cheap.
 if(solidNeedles){
  const sprays=3;
  for(let spray=0;spray<sprays;spray++){
   const longDir=flow.clone().applyAxisAngle(upWorld,(r()-.5)*.72);
   longDir.y+=.025+(r()-.5)*.16;
   longDir.normalize();
   let planeNormal=new T.Vector3().crossVectors(longDir,upWorld);
   if(planeNormal.lengthSq()<1e-5)planeNormal.set(1,0,0);
   planeNormal.normalize().applyAxisAngle(longDir,(spray/sprays)*Math.PI+(r()-.5)*.48);
   const side=new T.Vector3().crossVectors(planeNormal,longDir).normalize();
   const origin=center.clone()
    .addScaledVector(side,(r()-.5)*size*.22)
    .addScaledVector(planeNormal,(r()-.5)*size*.16)
    .addScaledVector(longDir,(r()-.5)*size*.10);
   const halfLength=size*(.26+r()*.08);
   const start=origin.clone().addScaledVector(longDir,-halfLength);
   const stations=6;
   for(let station=0;station<stations;station++){
    const t=(station+.28)/(stations-.45);
    const spine=start.clone().addScaledVector(longDir,halfLength*2*t)
     .addScaledVector(planeNormal,Math.sin(t*Math.PI)*size*(.018+r()*.014));
    const phase=station*2.399963+spray*1.173+(r()-.5)*.35;
    for(let pair=0;pair<2;pair++){
     const a=phase+pair*Math.PI+(r()-.5)*.22;
     const radialNeedle=side.clone().multiplyScalar(Math.cos(a)).addScaledVector(planeNormal,Math.sin(a)).normalize();
     const needleDir=radialNeedle.multiplyScalar(.88).addScaledVector(longDir,.22+(t-.5)*.16);
     needleDir.y-=.035+r()*.035;
     needleDir.normalize();
     let widthDir=new T.Vector3().crossVectors(needleDir,longDir);
     if(widthDir.lengthSq()<1e-5)widthDir.copy(side);
     widthDir.normalize();
     const length=size*(.115+r()*.045)*(1-.12*Math.abs(t-.5));
     const width=size*(.0075+r()*.0035);
     const curve=planeNormal.clone().multiplyScalar((r()-.5)*size*.022);
     const mid=spine.clone().addScaledVector(needleDir,length*.56).add(curve);
     const tip=spine.clone().addScaledVector(needleDir,length);
     const base=positions.length/3;
     const pts=[
      spine.clone().addScaledVector(widthDir,-width),spine.clone().addScaledVector(widthDir,width),
      mid.clone().addScaledVector(widthDir,-width*.58),mid.clone().addScaledVector(widthDir,width*.58),
      tip.clone().addScaledVector(widthDir,-width*.10),tip.clone().addScaledVector(widthDir,width*.10)
     ];
     const n=new T.Vector3().crossVectors(widthDir,needleDir).normalize();
     const outward=radialNeedle.clone().normalize();
     if(n.dot(outward)<0)n.multiplyScalar(-1);
     const shade=(.78+r()*.18)*ao*(.92+t*.08);
     for(let k=0;k<pts.length;k++){
      const p=pts[k];positions.push(p.x,p.y,p.z);
      const row=Math.floor(k/2),edge=k&1;uvs.push(edge,row*.5);
      normals.push(n.x,n.y,n.z);
      colors.push(color[0]*shade,color[1]*shade,color[2]*shade);
     }
     indices.push(base,base+2,base+1,base+1,base+2,base+3);
     indices.push(base+2,base+4,base+3,base+3,base+4,base+5);
    }
   }
  }
  return;
 }

 const sprays=4;
 for(let spray=0;spray<sprays;spray++){
  const longDir=flow.clone().applyAxisAngle(upWorld,(r()-.5)*.62);
  longDir.y+=.04+(r()-.5)*.22;
  longDir.normalize();
  let planeNormal=new T.Vector3().crossVectors(longDir,upWorld);
  if(planeNormal.lengthSq()<1e-5)planeNormal.set(1,0,0);
  planeNormal.normalize().applyAxisAngle(longDir,(spray/sprays)*Math.PI+(r()-.5)*.42);
  const side=new T.Vector3().crossVectors(planeNormal,longDir).normalize();
  const origin=center.clone()
   .addScaledVector(side,(r()-.5)*size*.28)
   .addScaledVector(planeNormal,(r()-.5)*size*.18)
   .addScaledVector(longDir,(r()-.5)*size*.12);
  const halfLength=size*(.44+r()*.14);
  const halfWidth=size*(.14+r()*.06);
  const mirror=r()>.5;
  const base=positions.length/3;

  for(let step=0;step<3;step++){
   const t=step-1;
   const width=halfWidth*(1-.28*Math.abs(t));
   const fold=Math.sin((step/2)*Math.PI)*size*(.035+r()*.035);
   for(let edge=0;edge<2;edge++){
    const sign=edge===0?-1:1;
    const p=origin.clone()
     .addScaledVector(longDir,t*halfLength)
     .addScaledVector(side,sign*width)
     .addScaledVector(planeNormal,fold);
    positions.push(p.x,p.y,p.z);
    const u=mirror?(edge===0?1:0):(edge===0?0:1);
    uvs.push(u,1-step*.5);
    const out=p.clone().sub(center);
    if(out.lengthSq()<1e-5)out.copy(planeNormal);else out.normalize();
    const n=planeNormal.clone().lerp(out,.34).normalize();
    normals.push(n.x,n.y,n.z);
    const shade=(.84+r()*.20)*ao;
    colors.push(color[0]*shade,color[1]*shade,color[2]*shade);
   }
  }
  indices.push(base,base+2,base+1,base+1,base+2,base+3);
  indices.push(base+2,base+4,base+3,base+3,base+4,base+5);
 }
}

// Sturdy main branch bough with 6-sided cross section
function appendBranchCylinder(positions,uvs,colors,indices,start,end,radiusStart,radiusEnd,segments,color){
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
   // Cylindrical bark coordinates: repeat around the limb and along its length.
   // The 4K bark map can therefore carry the fine surface detail instead of a
   // smooth vertex-coloured tube advertising its procedural origin.
   uvs.push((i/segs)*1.35,t*len*2.15);
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
 const branches={positions:[],uvs:[],colors:[],indices:[]};
 const center=new T.Vector3(),radial=new T.Vector3(),axis=new T.Vector3(),side=new T.Vector3(),plane=new T.Vector3(),up=new T.Vector3(0,1,0);

 // Deep, authentic forest conifer greens matching the reference photo
 const greens=[
  [.50,.65,.43],
  [.42,.58,.36],
  [.57,.72,.49],
  [.36,.51,.32],
  [.61,.76,.52],
  [.47,.62,.40]
 ];
 // Cool weathered grey-brown bark for structural boughs matching trunk
 const wood=[[.46,.38,.31],[.39,.32,.27],[.50,.41,.33]];

 // Individual branchlet masses stay readable; density comes from overlapping
 // biological groups rather than one continuous opaque cloud.
 const puffSize=height*(distant?.052:.060);
 const maxCrownRadius=height*(distant?.20:.25);

 const addFoliageCluster=(clusterCenter,clusterRadial,intensity=1,ao=1.0)=>{
  const col=greens[Math.floor(r()*greens.length)];
  appendFoliagePuff(foliage.positions,foliage.uvs,foliage.normals,foliage.colors,foliage.indices,clusterCenter,puffSize*intensity,col,r,ao,clusterRadial,!distant);
  if(!distant){
   const twigDir=clusterRadial.clone();
   twigDir.y*=.22;
   if(twigDir.lengthSq()<1e-5)twigDir.set(1,0,0);
   twigDir.normalize();
   const twigLen=puffSize*intensity*(.42+r()*.16);
   const twigStart=clusterCenter.clone().addScaledVector(twigDir,-twigLen*.48);
   const twigEnd=clusterCenter.clone().addScaledVector(twigDir,twigLen*.52);
   twigEnd.y-=twigLen*(.02+r()*.04);
   const twigCol=[.30,.27,.22];
   appendBranchCylinder(branches.positions,branches.uvs,branches.colors,branches.indices,
    twigStart,twigEnd,puffSize*.0105,puffSize*.0048,4,twigCol);
  }
 };

 const crownBase=height*(distant?.38:crownBaseRatio),crownTop=height*.88;

 // â”€â”€ Weathered lower dead branch stubs below live crown (characteristic of mature pines) â”€â”€â”€â”€â”€
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
   appendBranchCylinder(branches.positions,branches.uvs,branches.colors,branches.indices,
    sStart,sEnd,stubRadius,stubRadius*.25,5,stubCol);
  }
 }

 // â”€â”€ Structural Boughs (rugged primary limbs radiating from trunk into foliage) â”€â”€â”€â”€â”€
 const whorls=distant?6:9,branchesPerWhorl=distant?4:6;
 for(let w=0;w<whorls;w++){
  const wt=w/(whorls-1);
  const branchY=crownBase+(crownTop-crownBase)*wt;
  const whorlRadius=height*(.10+(.22-wt*.16))*(distant?.72:1);
  // Rugged primary limbs reach 48-58% of crown radius, clearly visible from underneath
   const boughReach=whorlRadius*(.43+r()*.09);
   const branchRadius=height*(distant?.0028:.0046)*(1-wt*.42);
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
   appendBranchCylinder(branches.positions,branches.uvs,branches.colors,branches.indices,
    branchStart,midPoint,branchRadius,branchRadius*.72,6,woodCol);
   appendBranchCylinder(branches.positions,branches.uvs,branches.colors,branches.indices,
    midPoint,branchEnd,branchRadius*.72,branchRadius*.45,5,woodCol);

   // Readable branchlet groups along each bough.  Their deliberate gaps are as
   // important as the needles themselves for depth/parallax.
   const nClusters=distant?4:6;
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

    // Only some outer branchlets receive one lateral child.  The previous two
    // children on nearly every sample erased all negative space in the crown.
    if(!distant&&c>=3&&((w+b+c)&1)===0){
     const flankDist=puffSize*(.42+r()*.22);
     const sideSign=((w+b+c)&2)?1:-1;
     const flankPos=clusterPos.clone().add(new T.Vector3(-sinA*flankDist*sideSign,(r()-.5)*puffSize*.2,cosA*flankDist*sideSign));
     addFoliageCluster(flankPos,new T.Vector3(cosA,0,sinA),.78+r()*.28,ao);
    }
   }
  }
 }

 // â”€â”€ Dense Apical Crown Summit (closing the top against sky) â”€â”€â”€â”€â”€â”€â”€â”€â”€
 const apexClusters=distant?10:16;
 for(let a=0;a<apexClusters;a++){
  const u=a/(apexClusters-1);
  const apexY=height*(.80+u*.18);
  const apexRadius=height*(.07*(1-u*.65))*(.7+r()*.5);
  const ang=r()*TAU;
  const apexPos=new T.Vector3(Math.cos(ang)*apexRadius,apexY+(r()-.5)*height*.02,Math.sin(ang)*apexRadius);
  addFoliageCluster(apexPos,new T.Vector3(Math.cos(ang),.3,Math.sin(ang)).normalize(),.95+r()*.4,0.95);
 }

 // â”€â”€ Sparse source-informed outer shell â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 // Keep the authored irregular silhouette, but stop resolving hundreds of
 // independent micro-puffs at the exact same spatial frequency.
 const shellDensity=distant?Math.min(density,50):Math.min(density,110);
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

 // â”€â”€ Selective inner volume (near/mid only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 if(!distant){
  const rings=4,samples=8;
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
function pineVolumeMaterial(world,diffuseMap,solidGeometry=false){
 const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.85,metalness:0,side:T.DoubleSide,vertexColors:true,envMapIntensity:.52});
 if(!solidGeometry&&diffuseMap){m.map=diffuseMap;}
 if(!solidGeometry&&world?.foliageAlphaTextures?.['pine_tree_01']){
  const tile=pineNeedleTile(world.foliageAlphaTextures['pine_tree_01'],diffuseMap);
  m.map=tile.map;m.alphaMap=tile.alpha;
  m.alphaTest=.34;
  m.alphaToCoverage=true;
 }
 if(solidGeometry){
  m.map=null;m.alphaMap=null;m.alphaTest=0;m.alphaToCoverage=false;
  m.roughness=.91;m.envMapIntensity=.40;
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
function pineBranchMaterial(world){
 const bark=world?.pineBarkPbr;
 const m=new T.MeshStandardMaterial({color:'#ffffff',roughness:.96,metalness:0,side:T.FrontSide,vertexColors:true,envMapIntensity:.36});
 if(bark){
  m.map=bark.map;
  m.normalMap=bark.normalMap;
  m.roughnessMap=bark.roughnessMap;
  m.normalScale?.set(.82,.82);
 }
 return m;
}
function buildBroadLeafGeometry([u0,u1,v0,v1],width=.48,fold=.055,curl=.040,lowDetail=false){
 const geometry=new T.BufferGeometry(),positions=[],uvs=[],leafEdge=[],indices=[];
 // More outline samples keep solid-geometry leaves from reading as a seven-edge
 // paper cutout against the sky. The leaf stays opaque 3D geometry; only its
 // curved silhouette gets enough segments to resolve like a natural blade.
 const rows=lowDetail?[0,.10,.22,.40,.60,.78,.90,1.0]:[0,.10,.22,.38,.55,.70,.83,.93,1.0];
 const widths=lowDetail?[.035,.24,.43,.50,.46,.32,.16,.02]:[.035,.24,.42,.50,.49,.40,.28,.14,.02];
 for(let row=0;row<rows.length;row++){
  const t=rows[row],supportScale=lowDetail?1.075:1.045,supportT=(t-.5)*supportScale+.5,w=widths[row]*width*supportScale,ridge=Math.sin(Math.PI*t)*fold,edge=ridge-Math.sin(Math.PI*t)*curl;
  positions.push(-w,supportT,edge, 0,supportT,ridge, w,supportT,edge);
  // Distance to the geometric contour.  Side vertices are exactly on the
  // silhouette while the centre vertex is fully interior.  Fade the centre
  // again at the stem/tip so the shader can soften all parts of the outline,
  // not only the long lateral edges.  This is intentionally geometry-local:
  // shrub/fern alpha cards keep their already-approved rendering path.
  const endInterior=Math.min(1,t/.10,(1-t)/.10);
  leafEdge.push(0,endInterior,0);
  const v=lerp(v0,v1,t),um=(u0+u1)*.5;
  uvs.push(u0,v,um,v,u1,v);
  if(row===0)continue;
  const a=(row-1)*3,b=row*3;
  indices.push(a,b,a+1, a+1,b,b+1, a+1,b+1,a+2, a+2,b+1,b+2);
 }
 geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));
 geometry.setAttribute('leafEdge',new T.Float32BufferAttribute(leafEdge,1));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return geometry;
}

function broadleafLeafMaterial(source,world,distant=false,geometryEdge=false){
 // Foliage tuning continuation.
 const m=source.clone();m.side=T.DoubleSide;m.transparent=false;m.depthWrite=true;m.depthTest=true;m.alphaMap=null;m.alphaTest=0;m.alphaToCoverage=false;
 // The curved tree leaves sample photographed shrub_01 tissue, but use a
 // woodland-tuned copy of that scan so hundreds of backlit leaves do not turn
 // into the pale beige canopy wall seen in earlier passes.
 if(world.foliageDiffuseTextures?.shrub_01)m.map=world.foliageDiffuseTextures.shrub_01;
 m.color.setRGB(.58,.70,.43);m.roughness=.91;m.metalness=0;m.envMapIntensity=.18;m.normalScale?.set(.34,.34);
 if(m.map)m.map.anisotropy=16;if(m.normalMap)m.normalMap.anisotropy=16;if(m.roughnessMap)m.roughnessMap.anisotropy=16;
 world.addWind(m,distant?.0025:.0060);m.userData.foliageWind=distant?.0025:.0060;
 if(geometryEdge){
  // The tree leaves are real opaque curved geometry, not alpha cards.  MSAA
  // therefore only gave them a mathematically hard one-pixel silhouette, which
  // becomes the jagged/pixel-cut edge the user can see in mid/far crowns.  Feed
  // an interior-distance attribute into alpha-to-coverage so only the outer
  // ~1–2 screen pixels feather, matching the clean fern contour without making
  // the leaf body transparent or touching any approved shrub material.
  m.alphaTest=.035;m.alphaToCoverage=true;m.userData.geometryLeafEdge=true;
  const compile=m.onBeforeCompile,key=m.customProgramCacheKey();
  m.onBeforeCompile=function(shader,renderer){
   compile.call(this,shader,renderer);
   shader.vertexShader='attribute float leafEdge;\nvarying float vBroadLeafEdge;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n    vBroadLeafEdge = leafEdge;`);
   shader.fragmentShader='varying float vBroadLeafEdge;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`
    // fwidth can exceed the whole interpolation range once a leaf becomes
    // sub-pixel.  Cap the ramp so the centre of a distant leaf remains opaque
    // instead of the entire blade turning into partial coverage and vanishing.
    float broadLeafEdgeWidth = clamp(fwidth(vBroadLeafEdge) * 1.15, 0.0001, 0.38);
    diffuseColor.a *= smoothstep(0.0, broadLeafEdgeWidth, vBroadLeafEdge);
    #include <alphatest_fragment>
   `);
  };
  m.customProgramCacheKey=()=>`${key}:broadleaf-geometry-edge-v1`;
 }
 // Match the softer photographed-tissue response that already works on the
 // nearby ferns.  The previous very low sky transmission left backlit tree
 // leaves almost black, exaggerating every remaining one-pixel contour.
 return foliageRendering(m,.24,.34,1.0,geometryEdge?1.35:1.35);
}

function plantBroadleafTreeCrowns(world,leafModel,trees,distant=false){
 if(!leafModel||!trees.length)return;
 const sources=sourceMeshes(leafModel);if(!sources.length)return;
 const material=broadleafLeafMaterial(sources[0].material,world,distant,true);
 const scanMaterial=broadleafLeafMaterial(sources[0].material,world,distant,false);
 const scanBough=sources[0].geometry.clone();scanBough.computeBoundingBox();
 const scanBox=scanBough.boundingBox,scanCenter=scanBox.getCenter(new T.Vector3()),scanLength=Math.max(.1,scanBox.max.x-scanBox.min.x);
 scanBough.translate(-scanBox.max.x,-scanBox.min.y,-scanCenter.z);scanBough.computeBoundingBox();scanBough.computeBoundingSphere();
 const scanBoughPlacements=[],scanAxis=new T.Vector3(-1,0,0);
 const leafGeometries=[
  buildBroadLeafGeometry([.405,.600,.640,.965],.50,.060,.045,distant),
  buildBroadLeafGeometry([.220,.410,.205,.580],.46,.052,.040,distant),
  buildBroadLeafGeometry([.730,.910,.575,.900],.44,.050,.038,distant),
  buildBroadLeafGeometry([.720,.910,.185,.550],.48,.058,.043,distant)
 ];
 const leafSets=leafGeometries.map(()=>[]),r=random(distant?93417:93411),golden=2.399963229728653;
 const branchData={positions:[],uvs:[],colors:[],indices:[]},up=new T.Vector3(0,1,0),leafAxis=new T.Vector3(0,1,0);
 const wood=[[.43,.36,.28],[.38,.31,.25],[.48,.40,.31]];
 const addLobe=(treeIndex,lobeIndex,center,outward,tangent,lobeSize,scanDetail=false,archetype=0)=>{
  // Build a lobe as a handful of short woody sprays carrying paired leaves.
  // A spherical shell of giant leaves looked like confetti from below; explicit
  // twig -> pair -> tip structure gives the same crown volume a biological
  // reading while keeping individual leaf scale close to the photographed tree.
  // Mature broadleaf crowns were still reading as bare branch scaffolds with
  // isolated bouquets. Keep the same branch grammar, but make each living lobe
  // genuinely leafy instead of exposing most of the twig skeleton.
  const sprays=distant?5:(archetype===2?7:6),clusters=distant?8:(archetype===1?11:10);
  const warm=(treeIndex*7+lobeIndex*5)%17,woodColor=wood[(treeIndex+lobeIndex)%wood.length];
  for(let spray=0;spray<sprays;spray++){
   const fan=sprays===1?0:(spray/(sprays-1)-.5),sideSign=(spray&1)?1:-1,depthFan=((spray%3)-1)*.16+(r()-.5)*.14;
   const sprayDir=outward.clone().multiplyScalar(.54+r()*.20+depthFan)
    .addScaledVector(up,.18+r()*.22+Math.abs(fan)*.08)
    .addScaledVector(tangent,fan*(.72+r()*.20)+(r()-.5)*.18).normalize();
   const root=center.clone().addScaledVector(outward,-lobeSize*(.27+r()*.13)+(r()-.5)*lobeSize*.12)
    .addScaledVector(tangent,fan*lobeSize*.20).addScaledVector(up,(r()-.55)*lobeSize*.10);
   const tip=root.clone().addScaledVector(sprayDir,lobeSize*(1.02+r()*.24))
    .addScaledVector(tangent,sideSign*lobeSize*(.035+r()*.035));
   const twigMid=root.clone().lerp(tip,.52).addScaledVector(up,lobeSize*(.035+r()*.045)).addScaledVector(tangent,(r()-.5)*lobeSize*.07);
   const twigRadius=Math.max(.004,lobeSize*(distant?.006:.008));
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,root,twigMid,twigRadius,twigRadius*.62,4,woodColor);
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,twigMid,tip,twigRadius*.62,twigRadius*.16,4,woodColor);

   for(let cluster=0;cluster<clusters;cluster++){
    // Clusters progress outward but are deliberately jittered so the twig never
    // becomes a fern-like ladder of paired leaves.
    const t=Math.min(.92,.16+(cluster/(clusters-1))*.70+(r()-.5)*.09);
    const spine=root.clone().lerp(tip,t).addScaledVector(up,Math.sin(t*Math.PI)*lobeSize*.035)
     .addScaledVector(tangent,(r()-.5)*lobeSize*.11).addScaledVector(outward,(r()-.5)*lobeSize*.06);
    // The old lobe scattered every leaf independently around the spine. With
    // many trees that averaged into an even umbrella/sheet. Real crowns read as
    // branch-led *clumps*: several leaves share one local 3D centre, then the
    // next twig section can be comparatively empty. Skip a small deterministic
    // fraction of interior clumps and push alternating clumps in/out of the
    // crown so the same leaf budget creates depth and negative space instead of
    // another uniformly filled shell.
    const sparseInterior=!distant&&cluster>0&&cluster<clusters-1&&((cluster+spray*2+lobeIndex+archetype)%9===0);
    if(sparseInterior)continue;
    const clumpPhi=cluster*golden+spray*.83+r()*.65,depthSign=((cluster+spray+lobeIndex)&1)?1:-1;
    const clumpDir=tangent.clone().multiplyScalar(Math.cos(clumpPhi)*(.72+r()*.22))
     .addScaledVector(up,(r()-.5)*.92)
     .addScaledVector(outward,Math.sin(clumpPhi)*(.78+r()*.24)).normalize();
    const clumpCenter=spine.clone()
     .addScaledVector(clumpDir,lobeSize*(.085+r()*.115))
     .addScaledVector(outward,depthSign*lobeSize*(.14+r()*.20))
     .addScaledVector(tangent,(r()-.5)*lobeSize*.12);
    // Leaves on one real twig tend to share a local plane.  Independent full
    // 360-degree roll per leaf made dense crowns resolve as a field of random
    // edge-on slivers/pixel chips. Keep positional variation, but give each
    // clump a coherent base roll with only modest leaf-to-leaf deviation.
    const clumpRoll=clumpPhi*.47+(r()-.5)*.45;
    let clumpTint=(distant?.65:.68)+r()*.08,clumpGreen=.92+r()*.055,clumpBlue=.70+r()*.075;
    if(warm===0||warm===1){clumpTint=.70+r()*.07;clumpGreen=.79+r()*.055;clumpBlue=.43+r()*.075;}
    else if(warm===2){clumpTint=.68+r()*.07;clumpGreen=.86+r()*.05;clumpBlue=.56+r()*.07;}
    const leavesPerCluster=distant?8:(cluster===clusters-1?10:9);
    for(let leaf=0;leaf<leavesPerCluster;leaf++){
     const phi=leaf*golden+r()*.80,vertical=(r()-.5)*.95;
     const jitterDir=tangent.clone().multiplyScalar(Math.cos(phi))
      .addScaledVector(up,vertical)
      .addScaledVector(outward,Math.sin(phi)*1.02).normalize();
     const clusterDir=clumpDir.clone().multiplyScalar(.66+r()*.12).addScaledVector(jitterDir,.34+r()*.16).normalize();
     const leafDir=sprayDir.clone().multiplyScalar(.34+r()*.13)
      .addScaledVector(clusterDir,.58+r()*.20)
      .addScaledVector(up,.10+r()*.17).normalize();
     const q=new T.Quaternion().setFromUnitVectors(leafAxis,leafDir);
     // leafDir is in world space: rotate around it before the alignment.
     // Post-multiplication rotated around an unrelated local axis and turned
     // many leaves edge-on, opening artificial holes inside every spray.
     q.premultiply(new T.Quaternion().setFromAxisAngle(leafDir,clumpRoll+(r()-.5)*.55));
     const hierarchy=cluster===clusters-1?1.06:(cluster%3===0?.90:1.0);
     const size=((distant?.106:.088)+r()*(distant?.044:.074))*hierarchy,variant=(treeIndex*5+lobeIndex*3+spray+cluster+leaf)%leafGeometries.length;
     const pos=clumpCenter.clone().addScaledVector(jitterDir,lobeSize*(.024+r()*.066));
     const tint=clumpTint+(r()-.5)*.026,green=clumpGreen+(r()-.5)*.022,blue=clumpBlue+(r()-.5)*.028;
     leafSets[variant].push({x:pos.x,y:pos.y,z:pos.z,sx:size*(1.15+r()*.18),sy:size,sz:size,q:[q.x,q.y,q.z,q.w],tint,green,blue});
    }
   }

   // A small terminal rosette hides the bare end of the twig without turning
   // the whole lobe into a uniformly filled ball.
   const terminalTint=.69+r()*.065,terminalGreen=.92+r()*.045,terminalBlue=.70+r()*.065;
   for(let terminal=0;terminal<8;terminal++){
    const terminalCount=8,phi=terminal*TAU/terminalCount+r()*.25,leafDir=sprayDir.clone().addScaledVector(tangent,Math.cos(phi)*.38).addScaledVector(up,Math.sin(phi)*.32).normalize();
    const q=new T.Quaternion().setFromUnitVectors(leafAxis,leafDir);q.premultiply(new T.Quaternion().setFromAxisAngle(leafDir,phi));
    const size=(distant?.107:.090)+r()*(distant?.043:.060),variant=(treeIndex+lobeIndex+spray+terminal)%leafGeometries.length;
    leafSets[variant].push({x:tip.x,y:tip.y,z:tip.z,sx:size*.96,sy:size,sz:size,q:[q.x,q.y,q.z,q.w],tint:terminalTint+(r()-.5)*.024,green:terminalGreen+(r()-.5)*.020,blue:terminalBlue+(r()-.5)*.026});
   }
  }
  if(scanDetail){
   const dir=outward.clone().multiplyScalar(.48+r()*.14).addScaledVector(up,.34+r()*.22).addScaledVector(tangent,(r()-.5)*.30).normalize();
   const q=new T.Quaternion().setFromUnitVectors(scanAxis,dir);q.premultiply(new T.Quaternion().setFromAxisAngle(dir,(r()-.5)*.72));
   const s=lobeSize/scanLength*(.84+r()*.22),anchor=center.clone().addScaledVector(outward,-lobeSize*.23);
   scanBoughPlacements.push({x:anchor.x,y:anchor.y,z:anchor.z,sx:s,sy:s*(.92+r()*.14),sz:s*(.92+r()*.14),q:[q.x,q.y,q.z,q.w],tint:.62+r()*.13,green:.88+r()*.09,blue:.62+r()*.13});
   if(!distant||((treeIndex+lobeIndex)%2===0)){
    const sideDir=outward.clone().multiplyScalar(.30+r()*.12).addScaledVector(up,.24+r()*.18).addScaledVector(tangent,(r()>.5?1:-1)*(.58+r()*.16)).normalize();
    const q2=new T.Quaternion().setFromUnitVectors(scanAxis,sideDir);q2.premultiply(new T.Quaternion().setFromAxisAngle(sideDir,.72+(r()-.5)*.84));
    const s2=s*(.58+r()*.16),anchor2=center.clone().addScaledVector(tangent,(r()>.5?1:-1)*lobeSize*(.18+r()*.12)).addScaledVector(up,lobeSize*(.06+r()*.08)).addScaledVector(outward,-lobeSize*.08);
    scanBoughPlacements.push({x:anchor2.x,y:anchor2.y,z:anchor2.z,sx:s2,sy:s2*(.90+r()*.16),sz:s2*(.90+r()*.16),q:[q2.x,q2.y,q2.z,q2.w],tint:.60+r()*.13,green:.86+r()*.10,blue:.60+r()*.14});
   }
  }
 };

 const addFoliageCloud=(treeIndex,cloudIndex,center,outward,tangent,cloudSize,density=1)=>{
  // Branch wraps can be denser than envelope filler without adding another
  // canopy shell.  A density >1 is used only on real branch runs below; the
  // global volume/top clouds stay at 1 so sky windows and crown separation are
  // preserved.
  const clumps=Math.max(1,Math.round((distant?6:8)*density)),perClump=Math.max(1,Math.round((distant?7:9)*density));
  for(let c=0;c<clumps;c++){
   const phi=(cloudIndex+c)*golden+r()*.7;
   const clump=center.clone()
    .addScaledVector(tangent,Math.cos(phi)*cloudSize*(.20+r()*.30))
    .addScaledVector(outward,Math.sin(phi)*cloudSize*(.18+r()*.28))
    .addScaledVector(up,(r()-.5)*cloudSize*.42);
   const clumpRoll=phi*.43+(r()-.5)*.42;
   const clumpTint=.66+r()*.075,clumpGreen=.91+r()*.055,clumpBlue=.68+r()*.075;
   for(let leaf=0;leaf<perClump;leaf++){
    const a=leaf*golden+r()*.8;
    const dir=tangent.clone().multiplyScalar(Math.cos(a)).addScaledVector(outward,Math.sin(a)).addScaledVector(up,.25+(r()-.5)*.8).normalize();
    const q=new T.Quaternion().setFromUnitVectors(leafAxis,dir);q.premultiply(new T.Quaternion().setFromAxisAngle(dir,clumpRoll+(r()-.5)*.52));
    const size=(distant?.110:.08)+r()*(distant?.043:.055),variant=(treeIndex*13+cloudIndex*5+c*3+leaf)%leafGeometries.length;
    const pos=clump.clone().addScaledVector(dir,cloudSize*(r()-.5)*.08);
    leafSets[variant].push({x:pos.x,y:pos.y,z:pos.z,sx:size*(1.10+r()*.15),sy:size,sz:size,q:[q.x,q.y,q.z,q.w],tint:clumpTint+(r()-.5)*.026,green:clumpGreen+(r()-.5)*.022,blue:clumpBlue+(r()-.5)*.028});
   }
  }
 };

 trees.forEach((tree,treeIndex)=>{
  const h=tree.treeHeight??14;
  // Three deterministic crown grammars stop every trunk from wearing the same
  // procedural silhouette.  Roots and overall tree height stay untouched.
  const archetype=(Math.abs(Math.floor(tree.x*17+tree.z*23))+treeIndex)%3;
  const parentCount=distant?(archetype===2?6:5):([5,5,6][archetype]);
  // Bring only the lowest living structure down a small amount. The goal is a
  // fuller woodland crown, not a different tree silhouette or low orchard tree.
  const crownBase=[.26,.30,.33][archetype],verticalSpan=[.38,.35,.32][archetype];
  const reachScale=[1.12,.96,1.05][archetype],lobeScale=[1.04,.92,1.12][archetype];
  // Broadleaf trees used to keep the straight Scots-pine trunk instance and
  // merely graft a deciduous crown on top.  Build the trunk into the same
  // biological hierarchy instead: a gently bent, tapered bole whose crown
  // branches actually originate from its current centre line.  Root position,
  // total height and deterministic tree identity stay unchanged.
  const trunkPhase=(tree.rot??0)+archetype*.71,leanA=.010+archetype*.003,leanB=.006+(treeIndex%3)*.002;
  const trunkCenter=f=>new T.Vector3(
   tree.x+Math.cos(trunkPhase)*h*leanA*Math.pow(f,1.35)+Math.cos(trunkPhase+1.73)*h*leanB*Math.sin(f*Math.PI*.85),
   tree.y+h*f,
   tree.z+Math.sin(trunkPhase)*h*leanA*Math.pow(f,1.35)+Math.sin(trunkPhase+1.73)*h*leanB*Math.sin(f*Math.PI*.85)
  );
  const trunkFractions=[0,.18,.36,.54,.70,.80],trunkWood=wood[(treeIndex+archetype)%wood.length];
  for(let s=0;s<trunkFractions.length-1;s++){
   const f0=trunkFractions[s],f1=trunkFractions[s+1],r0=h*((distant?.017:.0195)*(1-f0*.72)),r1=h*((distant?.017:.0195)*(1-f1*.72));
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,trunkCenter(f0),trunkCenter(f1),r0,r1,distant?7:10,trunkWood);
  }
  const crownVoidAngle=(tree.rot??0)+.62+archetype*.47+(treeIndex%5)*.19;
  for(let p=0;p<parentCount;p++){
   const pf=(p+.45)/parentCount,angle=(tree.rot??0)+p*golden+(r()-.5)*.52,ca=Math.cos(angle),sa=Math.sin(angle),tangent=new T.Vector3(-sa,0,ca);
   const baseY=tree.y+h*(crownBase+pf*verticalSpan+(r()-.5)*.035),trunkR=h*.012*(1-pf*.22),parentReach=h*(.085+r()*.035)*reachScale;
   const baseFrac=Math.min(.79,Math.max(.16,(baseY-tree.y)/h)),trunkAtBase=trunkCenter(baseFrac);
   const start=new T.Vector3(trunkAtBase.x+ca*trunkR,trunkAtBase.y,trunkAtBase.z+sa*trunkR);
   const hub=new T.Vector3(tree.x+ca*parentReach,baseY+h*(.075+r()*.060),tree.z+sa*parentReach).addScaledVector(tangent,(r()-.5)*h*.026);
   const mid=start.clone().lerp(hub,.52).addScaledVector(tangent,(r()-.5)*h*.020).addScaledVector(up,h*(.018+r()*.018));
   const woodColor=wood[(treeIndex+p)%wood.length],parentRadius=h*(distant?.0021:.0044)*(1-pf*.25);
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,start,mid,parentRadius,parentRadius*.68,distant?4:6,woodColor);
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,mid,hub,parentRadius*.68,parentRadius*.38,distant?4:6,woodColor);

   // Add foliage directly around a subset of the existing main boughs. Earlier
   // passes concentrated almost everything on the child tips, leaving the inner
   // branch visible as a long bare stick. A compact shoulder cloud gives the
   // branch a living, volumetric wrap without filling the whole canopy envelope.
   {
    const parentOutward=new T.Vector3(ca,.10+pf*.12,sa).normalize();
    const shoulderCenter=start.clone().lerp(hub,.72).addScaledVector(tangent,(r()-.5)*h*.014).addScaledVector(up,h*(.010+r()*.010));
    addFoliageCloud(treeIndex,360+p,shoulderCenter,parentOutward,tangent,h*(distant?.043:.052)*(.92+r()*.18)*lobeScale,distant?1.18:1.12);
    if(distant||((p+treeIndex)%3)!==0){
     const innerShoulder=start.clone().lerp(hub,.43).addScaledVector(tangent,(r()-.5)*h*.010).addScaledVector(up,h*(.006+r()*.008));
     addFoliageCloud(treeIndex,460+p,innerShoulder,parentOutward,tangent,h*(distant?.038:.043)*(.92+r()*.16)*lobeScale,distant?1.18:1.10);
    }
   }

   const children=distant?2:(archetype===0?2:3);
   for(let c=0;c<children;c++){
    const side=c-(children-1)*.5,childAngle=angle+side*(.48+r()*.16)+(r()-.5)*.18,cca=Math.cos(childAngle),ssa=Math.sin(childAngle);
    // Every tree gets one irregularly sparse crown sector. Real woodland crowns
    // have holes where a branch died or lost light; keeping every radial child
    // made the canopy read as a uniformly filled procedural umbrella.
    const voidDelta=Math.abs(Math.atan2(Math.sin(childAngle-crownVoidAngle),Math.cos(childAngle-crownVoidAngle)));
    if(!distant&&voidDelta<.30&&((p+c+treeIndex)&1)===0)continue;
    const outward=new T.Vector3(cca,.10+pf*.18,ssa).normalize(),childTangent=new T.Vector3(-ssa,0,cca);
    const hFrac=Math.min(.92,Math.max(.44,crownBase+.17+pf*(verticalSpan+.05)+side*.035+(r()-.5)*.045));
    const crownProfile=.48+.52*Math.sin(Math.PI*Math.min(1,Math.max(0,(hFrac-.44)/.54)));
    const radialReach=h*(distant?.225:.295)*crownProfile*(.86+r()*.25)*reachScale;
    const center=new T.Vector3(tree.x+cca*radialReach,tree.y+h*hFrac,tree.z+ssa*radialReach)
     .addScaledVector(childTangent,(r()-.5)*h*.035).addScaledVector(outward,(r()-.5)*h*.018);
    const childMid=hub.clone().lerp(center,.56).addScaledVector(childTangent,(r()-.5)*h*.022).addScaledVector(up,h*(.018+r()*.022));
    appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,hub,childMid,parentRadius*.34,parentRadius*.18,distant?4:5,woodColor);
    appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,childMid,center,parentRadius*.18,parentRadius*.055,distant?4:5,woodColor);
    const massCode=(treeIndex*11+p*5+c*3)%7,massScale=massCode===0?1.14:(massCode===1?.92:1),lobeSize=h*(distant?.060:.082)*(.72+r()*.46)*lobeScale*massScale,lobeIndex=p*6+c*2;
    // One compact mass grows from the middle/outer branch and a larger mass
    // closes the branch tip.  This removes the bare-stick-to-bouquet silhouette
    // without returning to a uniformly filled spherical crown.
    const innerCenter=hub.clone().lerp(center,.43).addScaledVector(up,h*(.006+r()*.010)).addScaledVector(childTangent,(r()-.5)*h*.010);
    addLobe(treeIndex,lobeIndex,innerCenter,outward,childTangent,lobeSize*.80,!distant?((treeIndex+lobeIndex)%3===0):((treeIndex+lobeIndex)%4===0),archetype);
    addFoliageCloud(treeIndex,220+lobeIndex,innerCenter,outward,childTangent,lobeSize*.78,distant?1.16:1.10);
    // Overlap the leaves along the living branch; do not enlarge the entire
    // crown or move its root to conceal a bare middle section.
    const middleCenter=hub.clone().lerp(center,.76).addScaledVector(childTangent,h*.009*(c%2?1:-1));
    if(((treeIndex+p+c)%5)!==0){
     addLobe(treeIndex,80+lobeIndex,middleCenter,outward,childTangent,lobeSize*.94,false,archetype);
     addFoliageCloud(treeIndex,260+lobeIndex,middleCenter,outward,childTangent,lobeSize*.86,distant?1.14:1.08);
    }else{
     // Preserve the irregular branch gap, but avoid a visibly naked stick: a
     // small leaf-only wrap is enough here and is much cheaper than another full
     // twig/lobe hierarchy.
     addFoliageCloud(treeIndex,340+lobeIndex,middleCenter,outward,childTangent,lobeSize*(distant?.66:.62),distant?1.16:1.08);
    }
    // The photographed shrub_01 branch is now used as real micro-branch detail
    // on every resolvable outer crown lobe.  It sits inside the procedural lobe,
    // so it adds believable leaf grouping without defining the whole silhouette.
    // Keep the unfeathered photogrammetry branch detail inside distant crowns.
    // On the outer silhouette its exact mesh contour reintroduced the hard cut
    // we just removed from the procedural leaves. Near trees can still use it
    // because the mesh is large enough to resolve as genuine scan detail.
    addLobe(treeIndex,lobeIndex+1,center,outward,childTangent,lobeSize,!distant,archetype);
    addFoliageCloud(treeIndex,300+lobeIndex,center,outward,childTangent,lobeSize*.94,distant?1.10:1.06);
   }
  }
  const lowerSideCount=distant?3:(tree.distance>18?2:0);
  for(let lower=0;lower<lowerSideCount;lower++){
   const angle=(tree.rot??0)+(lower+.72)*golden+(treeIndex%4)*.21+(r()-.5)*.30,ca=Math.cos(angle),sa=Math.sin(angle),tangent=new T.Vector3(-sa,0,ca);
   const yFrac=.47+lower*.055+(r()-.5)*.025,outward=new T.Vector3(ca,.13+lower*.055,sa).normalize();
   const radial=h*(distant?.105:.125)*(.88+r()*.24),center=new T.Vector3(tree.x+ca*radial,tree.y+h*yFrac,tree.z+sa*radial).addScaledVector(tangent,(r()-.5)*h*.024);
   const start=trunkCenter(yFrac-.13);
   const mid=start.clone().lerp(center,.58).addScaledVector(up,h*(.012+r()*.012));
   const woodColor=wood[(treeIndex+lower+2)%wood.length],radius=h*(distant?.0018:.0028);
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,start,mid,radius,radius*.56,distant?4:5,woodColor);
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,mid,center,radius*.56,radius*.10,distant?4:5,woodColor);
   const innerLower=start.clone().lerp(center,.40).addScaledVector(up,h*.005).addScaledVector(tangent,(r()-.5)*h*.009);
   addFoliageCloud(treeIndex,500+lower,innerLower,outward,tangent,h*(distant?.034:.040)*lobeScale,distant?1.18:1.10);
   const shoulder=start.clone().lerp(center,.68).addScaledVector(up,h*.008);
   addFoliageCloud(treeIndex,520+lower,shoulder,outward,tangent,h*(distant?.044:.052)*lobeScale,distant?1.18:1.10);
   addLobe(treeIndex,540+lower,center,outward,tangent,h*(distant?.060:.070)*(.90+r()*.20)*lobeScale,false,archetype);
   addFoliageCloud(treeIndex,560+lower,center,outward,tangent,h*(distant?.054:.064)*lobeScale,distant?1.10:1.06);
  }

  // Dense core masses overlap the leader so mature trees never terminate in an
  // exposed cut-off pole when viewed from below.
  const coreCount=3;
  for(let core=0;core<coreCount;core++){
   const angle=(tree.rot??0)+(core+.18)*golden+(r()-.5)*.55,ca=Math.cos(angle),sa=Math.sin(angle),outward=new T.Vector3(ca,.36,sa).normalize(),tangent=new T.Vector3(-sa,0,ca);
   const center=new T.Vector3(tree.x+ca*h*(.025+r()*.035),tree.y+h*(.70+core*.065+(r()-.5)*.025),tree.z+sa*h*(.025+r()*.035));
   addLobe(treeIndex,40+core,center,outward,tangent,h*(distant?.058:.074)*(.96+r()*.22)*lobeScale,!distant?core===1:((treeIndex+core)%3===0),archetype);
  }

  // Pass-13: fill the crown envelope, not just the branch tips. The previous
  // tree still had large sky holes between otherwise good individual leaves.
  // These smaller leaf-only volumes overlap the living branches in depth and
  // turn the canopy into a coherent 3D mass while preserving irregular gaps.
  const volumeCount=distant?(archetype===2?7:6):(archetype===2?8:7);
  for(let v=0;v<volumeCount;v++){
   const vf=(v+.35)/volumeCount,angle=(tree.rot??0)+v*golden+(r()-.5)*.72,ca=Math.cos(angle),sa=Math.sin(angle);
   const voidDelta=Math.abs(Math.atan2(Math.sin(angle-crownVoidAngle),Math.cos(angle-crownVoidAngle)));
   if(voidDelta<.22&&v%3===0)continue;
   const yFrac=.48+vf*.43+(r()-.5)*.055,profile=.42+.58*Math.sin(Math.PI*Math.min(1,Math.max(0,(yFrac-.43)/.54)));
   const radial=h*(distant?.150:.215)*profile*(.34+r()*.62),outward=new T.Vector3(ca,.08+(yFrac-.48)*.38,sa).normalize(),tangent=new T.Vector3(-sa,0,ca);
   const center=new T.Vector3(tree.x+ca*radial,tree.y+h*yFrac,tree.z+sa*radial).addScaledVector(tangent,(r()-.5)*h*.040);
   addFoliageCloud(treeIndex,100+v,center,outward,tangent,h*(distant?.052:.064)*(.86+r()*.28)*lobeScale);
  }

  const topCount=distant?(archetype===0?6:5):(archetype===2?7:6);
  for(let a=0;a<topCount;a++){
   const angle=(tree.rot??0)+(a+.35)*golden+(r()-.5)*.40,ca=Math.cos(angle),sa=Math.sin(angle),outward=new T.Vector3(ca,.52,sa).normalize(),tangent=new T.Vector3(-sa,0,ca);
   const startFrac=.69+a*.035,start=trunkCenter(Math.min(.80,startFrac)),centerBase=trunkCenter(.80),center=new T.Vector3(centerBase.x+ca*h*(.045+r()*.035),tree.y+h*(.86+a*.045+r()*.025),centerBase.z+sa*h*(.045+r()*.035));
   const woodColor=wood[(treeIndex+a+1)%wood.length],radius=h*(distant?.0015:.0027),mid=start.clone().lerp(center,.55).addScaledVector(tangent,(r()-.5)*h*.018);
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,start,mid,radius,radius*.48,distant?4:5,woodColor);
   appendBranchCylinder(branchData.positions,branchData.uvs,branchData.colors,branchData.indices,mid,center,radius*.48,radius*.08,distant?4:5,woodColor);
   // The highest visible twigs were still reading as a bare line followed by a
   // tip bouquet. Wrap alternating upper branch runs with a small local cloud so
   // the crown remains airy between branches, but each living branch itself is
   // convincingly leaf-covered in 01/02/07.
   {
    const upperShoulder=start.clone().lerp(center,.62).addScaledVector(tangent,(r()-.5)*h*.012).addScaledVector(up,h*(.006+r()*.010));
    addFoliageCloud(treeIndex,420+a,upperShoulder,outward,tangent,h*.046*(.92+r()*.18)*lobeScale,distant?1.18:1.10);
   }
   addLobe(treeIndex,50+a,center,outward,tangent,h*(distant?.060:.075)*(.92+r()*.22)*lobeScale,!distant&&(a<2&&treeIndex%2===0),archetype);
   addFoliageCloud(treeIndex,180+a,center,outward,tangent,h*(distant?.052:.072)*(.94+r()*.22)*lobeScale,distant?1.10:1.06);
  }
 });

 if(branchData.indices.length){
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(branchData.positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(branchData.uvs,2));g.setAttribute('color',new T.Float32BufferAttribute(branchData.colors,3));g.setIndex(branchData.indices);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  const branchMesh=addMesh(world,g,pineBranchMaterial(world),`${distant?'Distant':'Mature'} broadleaf structural boughs`);branchMesh.castShadow=!distant;
 }
 if(scanBoughPlacements.length)instances(world,scanBough,scanMaterial,scanBoughPlacements,`${distant?'Distant':'Mature'} scanned broadleaf crown lobes`,!distant);
 leafGeometries.forEach((geometry,i)=>{if(leafSets[i].length)instances(world,geometry,material,leafSets[i],`${distant?'Distant':'Mature'} curved broadleaf leaves v${i+1}`,!distant);});
}

export function plantPines(world,model,distant=false,leafModel=null){
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
   const baseProps={x,z,y:forestHeight(x,z)-embed,sy:s,rot:r()*TAU,rx:(r()-.5)*.03,rz:(r()-.5)*.035,tint,distance:Math.hypot(x,z-2.65),treeHeight:h};
   canopyPlacements.push({...baseProps,sx:width,sz:width});
   const trunkTint=distant?.90+r()*.14:.96+r()*.14;
   trunkPlacements.push({...baseProps,sx:trunkSx,sz:trunkSz,tint:trunkTint});
  }
  const isBroadleafIndex=i=>leafModel?(distant?i%16!==5:i%20!==7):false;
  const broadleafCanopy=leafModel?canopyPlacements.filter((_,i)=>isBroadleafIndex(i)):[];
  const coniferCanopy=leafModel?canopyPlacements.filter((_,i)=>!isBroadleafIndex(i)):canopyPlacements;
  // Trunk placement order exactly matches canopy placement order. Broadleaf
  // trees now receive their own bent/forking bole inside plantBroadleafTreeCrowns;
  // keep the old clean pine trunk only on the true conifer minority.
  const coniferTrunks=leafModel?trunkPlacements.filter((_,i)=>!isBroadleafIndex(i)):trunkPlacements;
  plantBroadleafTreeCrowns(world,leafModel,broadleafCanopy,distant);
  for(const src of sources){
   const isDeadBranch=src.material.name.includes('dead_branches');
   const isCrownBark=src.material.name.includes('pine_tree_01_bark');
   const isTrunk=src.material.name.includes('trunk');
   const isTwig=src.material.name.includes('twig'),label=distant?'Distant pine ':'Mature pine ';
    if(isTwig){
       // FOREST-TEXTURE-02: stop replacing the photogrammetry crown with a
       // procedural ribbon/puff reconstruction.  The source pine already has a
       // dense scanned twig/needle mesh with authored UV islands and natural
       // branchlet breakup.  Reusing that real topology fixes the thin repeated
       // "feather" look while preserving every existing tree root/scale/rotation.
       const twigGeometry=src.geometry.clone();
       twigGeometry.translate(0,-box.min.y,0);
       twigGeometry.computeBoundingBox();twigGeometry.computeBoundingSphere();
       const twigMat=scanMaterial(src.material,world,distant?.006:.011);
       // Keep the authored needle body but reject the tiny dark fringe texels
       // that turn into black pepper against bright sky. Density comes from the
       // overlapping real crown layers below, not from near-zero alpha noise.
       twigMat.color.setRGB(.70,.80,.62);twigMat.roughness=.92;twigMat.alphaTest=distant?.28:.24;twigMat.alphaToCoverage=true;
       instances(world,twigGeometry,twigMat,coniferCanopy,`${label}scanned needle crown`,!distant);
       if(!distant){
        // The photographed source tree is naturally open-crowned.  One exact
        // copy leaves mature gameplay trees looking half-dead when repeated.
        // Interleave a second, slightly smaller rotated crown on two thirds of
        // the EXISTING trunks.  This supplies branchlet depth/needle mass while
        // keeping trunk positions and overall crown envelope unchanged.
        const lushPlacements=coniferCanopy;
        if(lushPlacements.length){
         const innerCrown=twigGeometry.clone();
         innerCrown.rotateY(.67);innerCrown.scale(.91,.965,.91);
         innerCrown.computeBoundingBox();innerCrown.computeBoundingSphere();
         instances(world,innerCrown,twigMat,lushPlacements,`${label}scanned inner needle crown`,true);
        }
        const densePlacements=coniferCanopy.filter((_,i)=>i%2===0);
        if(densePlacements.length){
         const coreCrown=twigGeometry.clone();
         coreCrown.rotateY(-.49);coreCrown.scale(.78,.84,.78);
         // Compress + lift the third crown so its branchlet mass fills the
         // naturally sparse upper leader instead of merely thickening the same
         // lower bough silhouette again.
         coreCrown.translate(0,height*.12,0);
         coreCrown.computeBoundingBox();coreCrown.computeBoundingSphere();
         instances(world,coreCrown,twigMat,densePlacements,`${label}scanned dense needle core`,true);
        }
       }
       continue;
    }
    const g=isTrunk?cleanPineTrunkGeometry(src.geometry):src.geometry.clone();
    if(!isTrunk)g.translate(0,-box.min.y,0);
    const m=scanMaterial(src.material,world,0);
    m.vertexColors=false;
   if(isCrownBark){
     // The full scanned crown contains real structural limbs that correspond to
     // the twig mesh above. Keep them at crown scale rather than squeezing them
     // through the trunk-only instance scale.
     // Pine crown scaffolding is species-specific.  Keep it on the conifer
     // minority; broadleaf trunks get their crown volume from leaf clumps and
     // should not expose a halo of long bare pine limbs through the canopy.
     instances(world,g,m,coniferCanopy,label+src.material.name,!distant);
    }else if(isDeadBranch){
     // Dead lower limbs are biologically useful but should not clone onto every
     // tree. Reuse the authored geometry on a deterministic minority only.
     const deadPlacements=coniferCanopy.filter((_,i)=>i%3===0);
     if(deadPlacements.length)instances(world,g,m,deadPlacements,label+src.material.name,!distant);
    }else{
     instances(world,g,m,coniferTrunks,label+src.material.name,!distant);
    }
  }
  world.environmentCounts??={};world.environmentCounts[distant?'Distant pines':'Mature pines']=canopyPlacements.length;
 }

export async function loadForestDetails(world,gl,texture){
  const floor=async()=>{const [map,normalMap,roughnessMap,displacementMap]=await Promise.all([texture('forrest_ground_01/diff.jpg',true,1),texture('forrest_ground_01/nor_gl.jpg',false,1),texture('forrest_ground_01/rough.jpg',false,1),texture('forrest_ground_01/disp.jpg',false,1)]);Object.assign(world.groundMat,{map,normalMap,roughnessMap,displacementMap,displacementScale:.014,displacementBias:-.007});world.groundMat.normalScale.set(.6,.6);world.groundMat.needsUpdate=true;};
  const bed=async()=>{const [map,normalMap,roughnessMap]=await Promise.all([texture('sandy_gravel/diff.jpg',true,1),texture('sandy_gravel/nor_gl.jpg',false,1),texture('sandy_gravel/rough.jpg',false,1)]);world.creekTextures.creekMap.value=map;world.creekTextures.creekNormal.value=normalMap;world.creekTextures.creekRoughness.value=roughnessMap;world.groundMat.needsUpdate=true;applyStreambedTextures(world,{diffMap:map,normalMap,roughMap:roughnessMap});};
  const plant=async(id,options)=>{
   const visualSpecs=options.visualIds??[];
   const [model,lod,...visualAssets]=await Promise.all([
    gl.loadAsync(`./assets/${id}/${id}.gltf`),
    gl.loadAsync(`./assets/${id}_lod.glb`),
    ...visualSpecs.flatMap(spec=>[
     gl.loadAsync(`./assets/${spec.id}/${spec.id}.gltf`),
     gl.loadAsync(`./assets/${spec.id}_lod.glb`)
    ])
   ]);
   const visualFamilies=visualSpecs.map((spec,i)=>({
    model:visualAssets[i*2].scene,
    lodModel:visualAssets[i*2+1].scene,
    weight:spec.weight,
    lodDistance:spec.lodDistance??options.lodDistance,
   label:spec.label??spec.id,
   widthScale:spec.widthScale??1,
    heightScale:spec.heightScale??1,
    tiltScale:spec.tiltScale??1,
    layered:spec.layered??true
   }));
   const cleanOptions={...options};delete cleanOptions.visualIds;
   plantModel(world,model.scene,{lodDistance:options.lodDistance||2.5,...cleanOptions,lodModel:lod.scene,visualFamilies});
  };
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
   plant('shrub_02',{name:'Mixed tall woodland saplings',seed:31351,count:210,radius:34,height:[.52,1.22],cluster:2.4,near:2.0,wind:.016,lodDistance:7.5,primaryWeight:.05,visualIds:[{id:'shrub_03',weight:.95,lodDistance:8.5,label:'broadleaf',widthScale:.96,heightScale:.94,tiltScale:1.20}],layered:true,layerScale:.70,layerYScale:.90,layerMaxDistance:8.5,scatterChance:.22}),
   plant('shrub_02',{name:'Midground mixed saplings',seed:41921,count:80,minRadius:2.4,radius:12.5,midground:true,height:[.58,1.30],cluster:1.9,near:2.0,wind:.015,lodDistance:8.5,primaryWeight:0,visualIds:[{id:'shrub_03',weight:1,lodDistance:9.0,label:'broadleaf',widthScale:.96,heightScale:.92,tiltScale:1.22}],layered:true,layerScale:.68,layerYScale:.88,layerMaxDistance:7.0,scatterChance:.18,shadow:false}),
   plant('shrub_03',{name:'Paired-leaf understory',seed:78011,count:220,radius:34,height:[.22,.68],cluster:1.9,near:1.6,wind:.018,lodDistance:6.5,layered:true,layerScale:.82,layerYScale:.90,layerMaxDistance:6.5,scatterChance:.18,shadow:false}),
   plant('shrub_03',{name:'Midground paired understory',seed:89123,count:90,minRadius:2.0,radius:12.0,midground:true,height:[.26,.72],cluster:1.8,near:1.6,wind:.018,lodDistance:8.5,layered:true,layerScale:.80,layerYScale:.90,layerMaxDistance:8.0,scatterChance:.16,shadow:false}),
   (async()=>{const [full,medium,far,broad03,broad03Lod,broad04,broad04Lod,solidBroadleaf]=await Promise.all([
    gl.loadAsync('./assets/fir_sapling/fir_sapling.gltf'),gl.loadAsync('./assets/fir_sapling_lod.glb'),gl.loadAsync('./assets/fir_far_lod.glb'),
    gl.loadAsync('./assets/shrub_03/shrub_03.gltf'),gl.loadAsync('./assets/shrub_03_lod.glb'),
    gl.loadAsync('./assets/shrub_04/shrub_04.gltf'),gl.loadAsync('./assets/shrub_04_lod.glb'),world.treeLeafReady
   ]);
    const lowBroadleafFamilies=(w3,w4,wSolid,lodDistance,cardHeightScale=1,cardWidthScale=1,solidHeightScale=.72,solidWidthScale=.18)=>[
     {model:broad03.scene,lodModel:broad03Lod.scene,weight:w3,lodDistance,label:'paired broadleaf',heightScale:cardHeightScale,widthScale:cardWidthScale,tiltScale:1.22},
     {model:broad04.scene,lodModel:broad04Lod.scene,weight:w4,lodDistance,label:'woody broadleaf',heightScale:cardHeightScale*.92,widthScale:cardWidthScale*1.02,tiltScale:1.28},
     {model:solidBroadleaf.scene,lodModel:null,weight:wSolid,lodDistance,label:'solid branch mass',heightScale:solidHeightScale,widthScale:solidWidthScale*.48,tiltScale:1.35,layered:false}
    ];
    // The old runtime called the 7.5%-triangle mesh its "near" fir.  Keep the
    // original photographed/modelled branchlet topology where a player can
    // actually resolve it, then step down to the old medium asset outside that
    // band.  Larger/background firs use medium -> far to keep cost controlled.
    // These scanned fir meshes are excellent up close but become a field of
    // subpixel black needles once several hundred overlap.  Preserve every root
    // and scale, but transition to the authored coarser meshes as soon as the
    // player can no longer resolve individual needles.
    plantModel(world,full.scene,{name:'Conifer seedlings',seed:14502,count:110,radius:30,height:[.45,1.15],cluster:2.0,near:2.0,wind:.012,lodModel:medium.scene,lodDistance:3.2,primaryWeight:.08,visualFamilies:lowBroadleafFamilies(.24,.14,.54,6.0,.66,.66,.72,.16),scatterChance:.20,shadow:false});
    plantModel(world,full.scene,{name:'Conifer saplings',seed:28901,count:120,radius:32,height:[1.00,1.90],cluster:2.1,near:2.4,wind:.010,lodModel:medium.scene,lodDistance:4.0,primaryWeight:.08,visualFamilies:lowBroadleafFamilies(.22,.14,.56,7.5,.62,.62,.68,.15),scatterChance:.20,shadow:false});
    plantModel(world,full.scene,{name:'Midground conifer saplings',seed:33412,count:60,minRadius:2.6,radius:12.5,midground:true,height:[.95,1.85],cluster:1.9,near:2.2,wind:.010,lodModel:medium.scene,lodDistance:4.5,primaryWeight:.06,visualFamilies:lowBroadleafFamilies(.22,.14,.58,9.0,.62,.62,.68,.15),scatterChance:.16,shadow:false});
    plantModel(world,medium.scene,{name:'Young firs',seed:22281,count:130,radius:34,height:[2.10,4.20],cluster:2.2,near:2.8,wind:.009,lodModel:far.scene,lodDistance:11.5,primaryWeight:.06,visualFamilies:lowBroadleafFamilies(.14,.12,.68,10.5,.56,.50,.42,.105),scatterChance:.17});
    plantModel(world,medium.scene,{name:'Midground young firs',seed:44198,count:45,minRadius:3.0,radius:13.5,midground:true,height:[1.80,3.90],cluster:2.0,near:2.6,wind:.009,lodModel:far.scene,lodDistance:11.0,primaryWeight:.04,visualFamilies:lowBroadleafFamilies(.14,.12,.70,10.0,.56,.50,.42,.105),scatterChance:.15});
    plantModel(world,medium.scene,{name:'Wooded slope firs',seed:67812,count:105,radius:42,height:[3.60,7.20],cluster:2.4,near:3.5,belt:true,wind:.006,lodModel:far.scene,lodDistance:12.0,primaryWeight:.04,visualFamilies:lowBroadleafFamilies(.12,.10,.72,11.0,.46,.38,.36,.09),scatterChance:.14,shadow:false});
   })(),
   (async()=>{const [model,leafAsset]=await Promise.all([gl.loadAsync('./assets/pine_distant.glb'),world.treeLeafReady,world.pineBarkReady,...world.foliageAlphaReady]);plantPines(world,model.scene,true,leafAsset?.scene??null);})()
  ]);
 }

export function updateEnvironment(world,dt,sim,settings){
  const storm=settings.weather==='rain',mist=settings.weather==='mist',morning=sim.upgraded;
  if(world.daylightDay!==sim.day){world.daylightDay=sim.day;world.sun.position.set(morning?12:-12,morning?18:26,morning?-7:-9);world.sun.color.set(morning?'#f4ecd9':'#ffe8bc');world.stream.material.uniforms.sunDirection.value.copy(world.sun.position).normalize();}
  world.scene.fog.color.set(storm?'#536052':mist?'#889784':morning?'#5b6f60':'#536657');
  world.forestSky.material.uniforms.horizon.value.copy(world.scene.fog.color);
  world.forestSky.material.uniforms.zenith.value.set(storm?'#687977':mist?'#a4b1a9':morning?'#a0bed2':'#8da8bc');
  world.scene.fog.near=storm?10:mist?5:20;world.scene.fog.far=storm?46:mist?36:64;
 world.sun.intensity=storm?.65:mist?1.05:morning?2.8:5.8;
 world.renderer.toneMappingExposure=storm?.87:.94;
 if(world.forestHemisphere)world.forestHemisphere.intensity=storm?.95:mist?1.4:morning?1.05:.85;
 if(world.rain)world.rain.visible=storm;
 // Keep the established water appearance and slow only its animation clock.
 // Geometry and normal-map wavelengths/amplitudes stay unchanged.
 world.stream.material.uniforms.time.value+=dt*.42;
 world.stream.material.uniforms.distortionScale.value=0.05+settings.wind*0.03;
}
