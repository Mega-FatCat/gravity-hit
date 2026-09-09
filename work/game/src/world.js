import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {RGBELoader} from 'three/addons/loaders/RGBELoader.js';
import {Water} from 'three/addons/objects/Water.js';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {GenerateMeshBVHWorker} from 'three-mesh-bvh/src/workers/GenerateMeshBVHWorker.js';
import {smokeVolume} from './smoke.js';
import {Liquid} from './liquid.js';
import {flameMaterial} from './flame.js';
import {upgradeHeroProps} from './props.js';
import {buildForestFloor,forestHeight,forestBase,creekX,creekWidth,plantFerns,plantShrubs,plantGrass,plantPines,loadForestDetails,updateEnvironment} from './environment.js';
import {prepareInteractionFrame} from './interaction-view.js';
import {resolveLogicalHit,visibleSurface} from './picking.js';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const mat=(color,roughness=.7,extra={})=>new T.MeshStandardMaterial({color,roughness,...extra});
const rng=(seed=>()=>{seed=(Math.imul(1664525,seed)+1013904223)|0;return(seed>>>0)/4294967296})(9147);
const rand=(a,b)=>a+(b-a)*rng();
function mesh(g,m,parent,pos){const o=new T.Mesh(g,m);o.castShadow=true;o.receiveShadow=true;if(parent)parent.add(o);if(pos)o.position.copy(pos);return o;}
function lathe(points,segments=64){return new T.LatheGeometry(points.map(p=>new T.Vector2(...p)),segments);}
function canvasTexture(draw,w=512,h=512){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
const leafTex=canvasTexture((c,w,h)=>{c.clearRect(0,0,w,h);for(let j=0;j<18;j++){const y=h*.94-j*h*.045;const len=(1-j/20)*w*.46;c.fillStyle=`hsl(${83+j},${33+j%3*5}%,${20+j%5*3}%)`;for(const s of [-1,1]){c.beginPath();c.moveTo(w/2,y);c.quadraticCurveTo(w/2+s*len,y-h*.19,w/2+s*len*.9,y-h*.21);c.quadraticCurveTo(w/2+s*len*.72,y-h*.04,w/2,y);c.fill();}}c.strokeStyle='#7c9149';c.lineWidth=3;c.beginPath();c.moveTo(w*.5,h);c.lineTo(w*.5,0);c.stroke();},256,512);

const bottleLabelTexture=canvasTexture((c,w,h)=>{
 c.clearRect(0,0,w,h);
 c.fillStyle='rgba(235,248,242,0.85)';c.fillRect(0,0,w,h);
 c.fillStyle='#1c3d28';c.fillRect(0,0,w,14);c.fillRect(0,h-14,w,14);
 const grad=c.createLinearGradient(0,20,0,h-20);
 grad.addColorStop(0,'rgba(165,215,205,0.45)');grad.addColorStop(0.5,'rgba(215,240,235,0.15)');grad.addColorStop(1,'rgba(150,195,185,0.50)');
 c.fillStyle=grad;c.fillRect(0,14,w,h-28);
 for(const offset of [w*.25,w*.75]){
  c.fillStyle='#1d422a';c.beginPath();c.moveTo(offset-90,180);c.lineTo(offset-40,95);c.lineTo(offset-10,145);c.lineTo(offset+30,75);c.lineTo(offset+85,180);c.closePath();c.fill();
  c.fillStyle='#ffffff';c.beginPath();c.moveTo(offset-40,95);c.lineTo(offset-25,120);c.lineTo(offset-40,115);c.lineTo(offset-55,125);c.closePath();c.fill();
  c.beginPath();c.moveTo(offset+30,75);c.lineTo(offset+48,110);c.lineTo(offset+30,102);c.lineTo(offset+12,112);c.closePath();c.fill();
  c.fillStyle='#0f2918';c.font='bold 52px "Arial Black", Arial, sans-serif';c.textAlign='center';c.fillText('STILLWATER',offset,245);
  c.fillStyle='#2d5e3c';c.font='bold 19px Arial, sans-serif';c.fillText('NATURAL MOUNTAIN SPRING WATER',offset,278);
  c.fillStyle='#112217';c.font='bold 24px Arial, sans-serif';c.fillText('500 mL  ·  16.9 FL OZ',offset,315);
  c.fillStyle='#3a6848';c.font='15px Arial, sans-serif';c.fillText('ALPINE SOURCE  ·  pH 7.4 BALANCED  ·  100% RECYCLED PET',offset,345);
  c.fillStyle='#1c2820';for(let b=0;b<32;b++){const bw=(b%3===0?4:b%2===0?2:1);c.fillRect(offset-70+b*4.5,375,bw,40);}
  c.font='12px monospace';c.fillText('0 74892 10943 2',offset+35,400);
 }
},1024,512);
bottleLabelTexture.wrapS=T.RepeatWrapping;bottleLabelTexture.repeat.x=-1;

const inPropClearance=(x,z,isLarge=false,sx=null,sw=null)=>{
 const distToCam=Math.hypot(x,z-2.65);
 if(distToCam<(isLarge?3.4:2.2))return true;
 const distToSlab=Math.hypot(x,z-.83);
 if(distToSlab<(isLarge?2.2:1.65))return true;
 if(Math.abs(x)<1.2&&z>.4&&z<2.8)return true;
 if(x>-1.8&&x<-.3&&z>.1&&z<1.9)return true;
 if(sx!==null&&sw!==null){
  const streamDist=Math.abs(x-sx);
  if(streamDist<sw*.5+(isLarge?0.75:0.35))return true;
 }
 return false;
};

export class World {
 constructor(canvas,onProgress){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));this.renderer.setSize(innerWidth,innerHeight);
  this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.renderer.localClippingEnabled=true;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.90;
  this.scene=new T.Scene();this.scene.background=new T.Color('#1a241b');this.scene.fog=new T.Fog('#1a241b',24.0,85.0);
  this.camera=new T.PerspectiveCamera(53,innerWidth/innerHeight,.025,150);this.camera.position.set(0,.98,2.65);this.camera.lookAt(0,.32,.3);
  this.baseCam=this.camera.position.clone();this.yaw=0;this.pitch=-.265;this.wind=0.5;this.weather='clear';this.time=0;this.windMats=[];this.sway=[];this.items={};this.interactive=[];this.pointer=new T.Vector2();this.raycaster=new T.Raycaster();this.target=V();this.projected={};
  this.sun=new T.DirectionalLight('#fff2d8',1.5);this.sun.position.set(16,36,-18);this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);Object.assign(this.sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:140});this.sun.shadow.normalBias=.025;this.sun.shadow.bias=-.0001;this.scene.add(this.sun);this.scene.add(this.sun.target);
  this.scene.add(new T.HemisphereLight('#8ea89a','#242c1c',0.85));
  this.makeGround();this.makeObjects();this.makeParticles();
  this.ready=this.loadAssets(onProgress);
 }
 groundBase(x,z){return forestBase(x,z);}
 ground(x,z){return forestHeight(x,z);}
 async loadAssets(onProgress){
  const manager=new T.LoadingManager();manager.onProgress=(_,n,total)=>onProgress?.(n/total);const tl=new T.TextureLoader(manager);const gl=new GLTFLoader(manager);
  const texture=async(path,srgb=false,repeat=1)=>{const t=await tl.loadAsync(`./assets/${path}`);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t;};
  const tasks=[loadForestDetails(this,gl,texture),
   (async()=>{const model=await gl.loadAsync('./assets/clipper.glb');this.upgradeLighter(model.scene);})(),
   (async()=>{const model=await gl.loadAsync('./assets/bottle.glb');this.upgradeBottle(model.scene);})(),
   (async()=>{const model=await gl.loadAsync('./assets/pipe.glb');this.upgradePipe(model.scene);})(),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/rock_moss_set_01/rock_moss_set_01.gltf'),gl.loadAsync('./assets/creek_rocks_lod.glb')]);this.upgradeRocks(model.scene,lod.scene);})(),
   (async()=>{const env=await new RGBELoader(manager).loadAsync('./assets/forest.hdr');env.mapping=T.EquirectangularReflectionMapping;this.env=env;this.scene.environment=env;this.scene.background=null;this.scene.environmentIntensity=.62;this.scene.backgroundIntensity=.62;this.scene.backgroundRotation.y=1.7;this.scene.environmentRotation.y=1.7;this.scene.backgroundBlurriness=0;})(),
   (async()=>{const [map,normalMap]=await Promise.all([texture('rock_boulder_dry/diff.jpg',true,2.5),texture('rock_boulder_dry/nor_gl.jpg',false,2.5)]);Object.assign(this.rockMat,{map,normalMap});this.rockMat.normalScale.set(.75,.75);this.rockMat.needsUpdate=true;})(),
   (async()=>{const [map,normalMap]=await Promise.all([texture('bark_brown_02/diff.jpg',true,3),texture('bark_brown_02/nor_gl.jpg',false,3)]);Object.assign(this.barkMat,{map,normalMap});this.barkMat.needsUpdate=true;})(),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/fern_02/fern_02.gltf'),gl.loadAsync('./assets/fern_02_lod.glb')]);plantFerns(this,model.scene,lod.scene);})(),
   (async()=>{const model=await gl.loadAsync('./assets/shrub_04_lod.glb');this.makeShrubs(model.scene);})(),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/grass_clumps_lod.glb'),gl.loadAsync('./assets/grass_far_lod.glb')]);plantGrass(this,model.scene,lod.scene);})(),
   (async()=>{try{const model=await gl.loadAsync('./assets/pine.glb');this.makePines(model.scene);}catch(e){console.warn('Pine LOD unavailable',e.message);}})()
  ];const result=await Promise.allSettled(tasks);this.assetErrors=result.filter(r=>r.status==='rejected').map(r=>String(r.reason));if(this.assetErrors.length)console.error(this.assetErrors);upgradeHeroProps(this);this.renderer.compile(this.scene,this.camera);return this;
 }
 makeGround(){buildForestFloor(this);}
 streamX(z){return creekX(z);}
 streamWidth(z){return creekWidth(z);}
 addWind(material,amp=.025){material.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};shader.uniforms.uWind={value:this.wind};shader.vertexShader='uniform float uTime; uniform float uWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n float sway = sin(uTime*1.3+position.x*1.8+position.z*.9)*${amp.toFixed(4)}*uWind; transformed.x += sway*max(0.,position.y); transformed.z += sway*.4*max(0.,position.y);`);this.windMats.push(shader);};material.customProgramCacheKey=()=>`wind${amp}`;}
  makeFerns(model){plantFerns(this,model);}
  makePines(model){plantPines(this,model);}
  makeShrubs(model){plantShrubs(this,model);}
  makeGroundCover(model){plantGrass(this,model);}
  upgradeRocks(model,lodModel){
   const sources=[];model.traverse(o=>{if(o.isMesh)sources.push(o);});
   const lods=new Map();lodModel?.traverse(o=>{if(o.isMesh)lods.set(o.name,o);});
   const src=sources[0];if(!src)return;const g=src.geometry.clone();g.computeBoundingBox();const bounds=g.boundingBox,size=bounds.getSize(V()),center=bounds.getCenter(V());g.translate(-center.x,-bounds.min.y,-center.z);
   const m=src.material.clone();m.roughness=.91;m.normalScale?.set(.9,.9);m.color.set('#c2c5b1');new T.TextureLoader().load('./assets/stone-detail.jpg',t=>{t.colorSpace=T.SRGBColorSpace;t.flipY=false;t.anisotropy=16;m.map=t;m.needsUpdate=true;});
   this.slab.geometry=g;this.slab.material=m;this.slab.scale.set(1.62/size.x,.50/size.y,1.28/size.z);this.slab.position.set(0,-.165,.83);this.slab.rotation.set(0,0,0);
   this.slab.updateMatrixWorld(true);const down=new T.Raycaster();for(const [id,home]of Object.entries(this.home)){down.set(V(home.x,2,home.z),V(0,-1,0));const hit=down.intersectObject(this.slab)[0];if(hit)home.y=hit.point.y+(id==='pipe'?.032:id==='bag'?.02:.004);}
   sources.forEach((s,index)=>{
    const geometry=(lods.get(s.name)??s).geometry.clone();geometry.computeBoundingBox();const bb=geometry.boundingBox,sz=bb.getSize(V()),c=bb.getCenter(V());geometry.translate(-c.x,-bb.min.y,-c.z);
    const material=s.material.clone();material.roughness=.87;
    const inst=new T.InstancedMesh(geometry,material,42);inst.name='Scanned creek stones';
    const d=new T.Object3D();let count=0;
    if(index===0){
     const edgeCoords=[[-.55,.68],[.62,.74],[-.42,1.06],[.52,1.14],[0,1.20]];
     for(const [ex,ez] of edgeCoords){
      const gy=this.ground(ex,ez)-.04;
      d.position.set(ex,gy,ez);
      d.rotation.set(rand(-.1,.1),rand(0,6.28),0);
      d.scale.setScalar(rand(.18,.32)/Math.max(sz.x,sz.z));
      d.updateMatrix();
      inst.setMatrixAt(count++,d.matrix);
     }
    }
    for(let i=count;i<42;i++){
     const z=rand(-18,14);const hw=this.streamWidth(z)*.5;const side=i%2?1:-1;
     const x=this.streamX(z)+side*rand(hw*.85,hw*1.8);
     const scale=rand(.14,.45)/Math.max(sz.x,sz.z);
     if(inPropClearance(x,z,false,this.streamX(z),this.streamWidth(z)))continue;
     const gy=this.ground(x,z)-scale*.25;
     d.position.set(x,gy,z);d.rotation.set(0,rand(0,6.3),rand(-.1,.1));d.scale.setScalar(scale);d.updateMatrix();
     inst.setMatrixAt(count++,d.matrix);
    }
    inst.count=count;inst.castShadow=true;inst.receiveShadow=true;this.scene.add(inst);
   });
  }
 upgradeBottle(model){
  const keep=new Set([this.liquid.volume,this.bottleSmoke,this.spareCap,this.outlet]);
  for(const child of [...this.items.bottle.children])if(!keep.has(child)){
   this.items.bottle.remove(child);
   child.traverse(o=>{const i=this.interactive.indexOf(o);if(i>=0)this.interactive.splice(i,1);});
  }
  this.items.bottle.add(model);
  this.items.bottle.scale.set(1,1,1);
  model.traverse(o=>{
   if(o.isMesh){
    o.castShadow=false;o.receiveShadow=true;o.userData.item='bottle';
    this.interactive.push(o);
    if(o.name==='BottleShell'){
     o.material=new T.MeshPhysicalMaterial({color:'#f8fcfa',roughness:.17,transmission:.94,thickness:.0003,ior:1.51,transparent:true,opacity:.93,envMapIntensity:.82,side:T.DoubleSide,depthWrite:false});
     o.renderOrder=3;
    }else if(o.name==='BottleLabel'){
     o.material=new T.MeshStandardMaterial({map:bottleLabelTexture,roughness:.32,transparent:true,opacity:.92,side:T.DoubleSide});
     o.renderOrder=4;
    }else if(o.name==='PlasticCap'){
     o.visible=false;
    }else if(o.name==='OutletMeltRim'){
     this.meltRim=o;
     o.material=new T.MeshStandardMaterial({color:'#2b2318',roughness:.65,transparent:true,opacity:.75});
     o.visible=false;
    }
   }
  });
  this.outlet.position.set(.0326,.032,0);
 }
 upgradePipe(model){
  if(this.pipeGlass){
   this.items.pipe.remove(this.pipeGlass);
   const idx=this.interactive.indexOf(this.pipeGlass);if(idx>=0)this.interactive.splice(idx,1);
  }
  this.items.pipe.add(model);
  this.pipeMat=new T.MeshPhysicalMaterial({color:'#f6fff9',roughness:.05,transmission:.98,thickness:.0025,ior:1.474,transparent:true,opacity:.98,envMapIntensity:1.25,side:T.DoubleSide,depthWrite:false});
  model.traverse(o=>{
   if(o.isMesh){
    o.castShadow=false;o.receiveShadow=true;o.userData.item='pipe';
    this.interactive.push(o);
    if(o.name==='PipeGlass'){
     o.material=this.pipeMat;o.renderOrder=4;
     this.pipeGlass=o;
    }else if(o.name==='RubberGrommet'){
     o.material=new T.MeshStandardMaterial({color:'#1a1d1e',roughness:.65,metalness:0});
    }
   }
  });
  this.bowlBud.position.set(0,.068,0);
  this.emberLight.position.set(0,.074,0);
  this.hotTip.position.set(0,-.015,0);
 }
 upgradeLighter(model){
   const keep=new Set([this.flame,this.flameCore,this.flameLight]);for(const child of [...this.items.lighter.children])if(!keep.has(child)){this.items.lighter.remove(child);child.traverse(o=>{const i=this.interactive.indexOf(o);if(i>=0)this.interactive.splice(i,1);});}
   this.items.lighter.add(model);
   model.rotation.y = Math.PI;
   model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.item='lighter';this.interactive.push(o);if(o.name==='Label'){o.visible=false;}if(o.name==='Striker_wheel'||o.name==='Striker wheel')this.wheel=o;}});
   const sticker=mesh(new T.CylinderGeometry(.00828,.00828,.054,64,1,true,0,Math.PI*2),mat('#ffffff',.38,{map:this.lighterDesign,side:T.DoubleSide}),model,V(0,.031,0));sticker.userData.item='lighter';this.interactive.push(sticker);
   this.flame.position.set(-.003,.076,.002);this.flameCore.position.set(-.003,.072,.002);this.flameLight.position.set(-.003,.087,.002);this.flameAnchor=V(-.003,.092,.002);
   this.nozzle=V(-.003,.072,.002);this.flame.geometry=new T.PlaneGeometry(.016,.036);this.flame.geometry.translate(0,.018,0);this.flame.material=flameMaterial();this.flame.scale.setScalar(1);this.flameShader=true;
 }
  makeObjects(){
   const petMat=new T.MeshPhysicalMaterial({color:'#f8fcfa',roughness:.17,transmission:.94,thickness:.0003,ior:1.51,transparent:true,opacity:.93,envMapIntensity:.82,side:T.DoubleSide,depthWrite:false});this.petMat=petMat;
   const bottle=new T.Group();this.scene.add(bottle);bottle.name='bottle';bottle.position.set(-.02,.294,.78);bottle.scale.set(1,1,1);this.items.bottle=bottle;
   const profile=[[0,.003],[.022,.003],[.032,.016],[.0325,.032],[.0325,.050],[.0312,.053],[.0325,.056],[.0322,.060],[.0322,.126],[.0310,.129],[.0325,.132],[.0310,.136],[.0325,.139],[.0322,.148],[.0305,.162],[.0265,.178],[.0205,.192],[.0145,.202],[.0135,.206],[.0152,.207],[.0152,.209],[.0135,.210],[.0132,.214],[.0142,.216],[.0132,.218],[.0142,.220],[.0132,.222],[.0130,.226],[.0118,.226],[0,.226]];
   const shell=mesh(lathe(profile),petMat,bottle);shell.castShadow=false;shell.renderOrder=3;
   const labelGeo=new T.CylinderGeometry(.0326,.0326,.066,48,1,true);
   const labelMesh=mesh(labelGeo,new T.MeshStandardMaterial({map:bottleLabelTexture,roughness:.32,transparent:true,opacity:.92,side:T.DoubleSide}),bottle,V(0,.093,0));labelMesh.renderOrder=4;
   this.bottleWater=mesh(new T.CylinderGeometry(.031,.031,1,48,1),new T.MeshPhysicalMaterial({color:'#c4e5d5',roughness:.12,transmission:.9,thickness:.11,ior:1.333,transparent:true,opacity:.8,side:T.FrontSide,depthWrite:false}),bottle);this.bottleWater.castShadow=false;this.bottleWater.renderOrder=1;
   this.meniscus=mesh(new T.CircleGeometry(.031,48),new T.MeshPhysicalMaterial({color:'#dae9de',roughness:.13,metalness:.3,transparent:true,opacity:.42,side:T.DoubleSide}),bottle);this.meniscus.rotation.x=-Math.PI/2;this.meniscus.castShadow=false;
   bottle.remove(this.bottleWater,this.meniscus);this.liquid=new Liquid(bottle,this.scene);
   this.bottleSmoke=mesh(new T.BoxGeometry(.066,.22,.066).translate(0,.11,0),smokeVolume(),bottle);this.bottleSmoke.castShadow=false;this.bottleSmoke.renderOrder=1;
   const cap=new T.Group();this.scene.add(cap);this.items.pipe=cap;
   const capGreen=mat('#2a5e36',.38);const capmesh=mesh(new T.CylinderGeometry(.0154,.0154,.016,48),capGreen,cap);for(let i=0;i<32;i++){const a=i/32*Math.PI*2;mesh(new T.CylinderGeometry(.0006,.0006,.014,4),capGreen,cap,V(Math.sin(a)*.0154,0,Math.cos(a)*.0154));}
   this.spareCap=mesh(new T.CylinderGeometry(.0154,.0154,.016,48),capGreen,bottle,V(0,.226,0));this.spareCap.renderOrder=4;
   capmesh.name='cap';this.capmesh=capmesh;capmesh.renderOrder=4;
   const pipeProfile=[[.0052,-.018],[.0052,.052],[.0056,.058],[.0072,.070],[.0073,.076],[.0068,.0775],[.0053,.076],[.0045,.068],[.0016,.058],[.0036,.052],[.0036,-.016]];
   this.pipeMat=new T.MeshPhysicalMaterial({color:'#f6fff9',roughness:.05,transmission:.98,thickness:.0025,ior:1.474,transparent:true,opacity:.98,envMapIntensity:1.25,side:T.DoubleSide,depthWrite:false});
   this.pipeGlass=mesh(lathe(pipeProfile,48),this.pipeMat,cap,V(0,0,0));this.pipeGlass.castShadow=false;
   mesh(new T.CylinderGeometry(.0074,.0074,.006,24),mat('#1a1d1e',.65),cap,V(0,.023,0));
   this.hotTip=mesh(new T.CylinderGeometry(.0055,.0055,.012,24),new T.MeshBasicMaterial({color:'#f24f20',transparent:true,opacity:0,depthWrite:false}),cap,V(0,-.015,0));this.hotTip.castShadow=false;
   this.budMat=mat('#627344',.95);this.bowlBud=mesh(new T.IcosahedronGeometry(.0045,2),this.budMat,cap,V(0,.068,0));
   this.emberLight=new T.PointLight('#ff752e',0,.25,2);cap.add(this.emberLight);this.emberLight.position.set(0,.074,0);
   const lighter=new T.Group();this.scene.add(lighter);this.items.lighter=lighter;const lighterBody=mat('#111413',.31);
   mesh(new T.CylinderGeometry(.015,.015,.073,40),lighterBody,lighter,V(0,.038,0));
   const silver=new T.MeshStandardMaterial({color:'#a8adae',roughness:.23,metalness:.96});mesh(new T.CylinderGeometry(.0155,.0155,.021,32,1,true),silver,lighter,V(0,.083,0));
   const wheel=mesh(new T.CylinderGeometry(.008,.008,.010,24),mat('#555958',.65,{metalness:.85}),lighter,V(-.005,.097,0));wheel.rotation.x=Math.PI/2;this.wheel=wheel;
   mesh(new T.BoxGeometry(.012,.008,.015),lighterBody,lighter,V(.008,.086,0));
   const design=canvasTexture((c,w,h)=>{
    c.fillStyle='#101411';c.fillRect(0,0,w,h);
    c.fillStyle='#f1f2e8';c.textAlign='center';
    for(const offset of [w*.25,w*.75]){
     c.font='bold 56px Arial';
     c.fillText('HIGH',offset,175);
     c.fillText('AS',offset,245);
     c.fillText('FUCK',offset,315);
     c.font='bold 22px Arial';
     c.fillText('CLIPPER',offset,64);
     c.fillStyle='#9bb769';c.font='46px serif';
     c.fillText('✦',offset,116);
     c.fillStyle='#f1f2e8';
    }
   },512,512);
   this.lighterDesign=design;this.flameAnchor=V(.005,.12,0);
   const wrap=mesh(new T.CylinderGeometry(.0152,.0152,.062,40,1,true,0,Math.PI*2),mat('#ffffff',.39,{map:design}),lighter,V(0,.037,0));
   this.flame=mesh(new T.SphereGeometry(1,16,16),new T.MeshBasicMaterial({color:'#ffd36c',transparent:true,opacity:.85,depthWrite:false}),lighter,V(.005,.111,0));this.flame.scale.set(.0032,.014,.0032);this.flame.castShadow=false;
   this.flameCore=mesh(new T.SphereGeometry(1,12,12),new T.MeshBasicMaterial({color:'#b6e3ff',transparent:true,opacity:.8}),lighter,V(.005,.102,0));this.flameCore.scale.set(.002,.005,.002);this.flameCore.castShadow=false;
   this.flameLight=new T.PointLight('#ffb35a',0,.65,2);lighter.add(this.flameLight);this.flameLight.position.set(0,.11,0);
   const bag=new T.Group();this.scene.add(bag);this.items.bag=bag;
   const bagMat=new T.MeshPhysicalMaterial({color:'#e5eee2',roughness:.22,transmission:.82,thickness:.0012,transparent:true,opacity:.48,side:T.DoubleSide,depthWrite:false,envMapIntensity:.85});
   const bagGeo=new T.BoxGeometry(.12,.14,.014,12,12,1);const bp=bagGeo.attributes.position;for(let i=0;i<bp.count;i++){let x=bp.getX(i),y=bp.getY(i);bp.setZ(i,bp.getZ(i)+Math.sin(x*140+y*80)*.0028+Math.cos(x*60-y*110)*.0015);};bagGeo.computeVertexNormals();mesh(bagGeo,bagMat,bag,V(0,.07,0));mesh(new T.BoxGeometry(.12,.0035,.018),mat('#5d8c6b',.42),bag,V(0,.125,0));
   this.bagNugs=[];const nugGeo=mergeVertices(new T.IcosahedronGeometry(.008,3)),np=nugGeo.attributes.position,nc=[];for(let i=0;i<np.count;i++){const x=np.getX(i),y=np.getY(i),z=np.getZ(i),detail=Math.sin(x*3900+y*1830)*Math.cos(z*2870+y*2950),f=.84+detail*.16;np.setXYZ(i,x*f,y*f,z*f);const c=new T.Color().setHSL(detail>.72?.09:.24,.38+detail*.15,.16+(detail+1)*.09);nc.push(c.r,c.g,c.b);}nugGeo.setAttribute('color',new T.Float32BufferAttribute(nc,3));nugGeo.computeVertexNormals();for(let i=0;i<35;i++){const nug=mesh(nugGeo,mat('#ffffff',.92,{vertexColors:true}),bag,V(rand(-.046,.046),rand(.018,.09),rand(-.004,.003)));nug.scale.set(rand(.7,1.3),rand(.9,1.7),rand(.6,.9));this.bagNugs.push(nug);}
   this.trash=new T.Group();this.scene.add(this.trash);this.trash.position.set(.7,.0,.45);const sack=mesh(new T.SphereGeometry(.24,32,24),mat('#192321',.36),this.trash,V(0,.17,0));sack.scale.set(1,.9,.85);const top=mesh(new T.TorusGeometry(.12,.045,12,32),mat('#29322c',.4),this.trash,V(0,.32,0));top.rotation.x=Math.PI/2;for(let i=0;i<36;i++){const n=mesh(nugGeo,this.budMat,this.trash,V(rand(-.095,.095),.30+rand(0,.06),rand(-.07,.07)));n.scale.setScalar(2.4);}this.trash.visible=false;
   const outlet=mesh(new T.CircleGeometry(.0025,16),mat('#161b12',.8,{side:T.DoubleSide}),bottle,V(.0326,.032,0));outlet.rotation.y=Math.PI*.43;this.outlet=outlet;
   this.jet=mesh(new T.CylinderGeometry(.0014,.0021,1,8),new T.MeshPhysicalMaterial({color:'#d9f3ea',transparent:true,opacity:.55,roughness:.15,metalness:.25}),this.scene);this.jet.castShadow=false;
   this.home={bottle:V(-.04,.293,.84),pipe:V(-.31,.323,.87),lighter:V(.28,.31,.79),bag:V(.41,.32,1.05)};
   for(const [id,g]of Object.entries(this.items)){g.userData.item=id;g.position.copy(this.home[id]);g.traverse(o=>{o.userData.item=id;if(o.isMesh)this.interactive.push(o);});}this.items.bag.rotation.set(-1.25,0,-.2);this.items.lighter.rotation.z=-.25;
   this.trash.traverse(o=>{o.userData.item='bag';if(o.isMesh)this.interactive.push(o);});
  }
  makeParticles(){
   const count=180,arr=new Float32Array(count*3);for(let i=0;i<count;i++)arr.set([rand(-7,7),rand(.15,3),rand(-7,4)],i*3);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(arr,3));
   const dot=canvasTexture((c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);g.addColorStop(0,'rgba(255,255,220,1)');g.addColorStop(1,'rgba(255,255,220,0)');c.fillStyle=g;c.fillRect(0,0,w,h);},32,32);
   this.pollen=new T.Points(geo,new T.PointsMaterial({color:'#f1ead0',size:.018,map:dot,transparent:true,opacity:.46,depthWrite:false}));this.scene.add(this.pollen);
   const rainGeo=new T.BufferGeometry(),rp=new Float32Array(600*3);for(let i=0;i<600;i++)rp.set([rand(-8,8),rand(0,7),rand(-8,5)],i*3);rainGeo.setAttribute('position',new T.BufferAttribute(rp,3));this.rain=new T.Points(rainGeo,new T.PointsMaterial({color:'#c0d2d1',size:.023,transparent:true,opacity:.42}));this.scene.add(this.rain);this.rain.visible=false;
  }
  setQuality(value){
   this.quality=value;
   const dpr=Math.min(window.devicePixelRatio||1,2.0);
   const pixel=value==='low'?Math.min(dpr,1.0):value==='medium'?Math.min(dpr,1.5):dpr;
   this.renderer.setPixelRatio(pixel);
   this.renderer.shadowMap.enabled=value!=='low';
   this.renderer.shadowMap.autoUpdate=value==='high';
   this.renderer.shadowMap.needsUpdate=true;
   this.renderer.setSize(innerWidth,innerHeight);
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);}
  look(dx,dy){this.yaw-=dx*.003;this.pitch=T.MathUtils.clamp(this.pitch-dy*.003,-1.15,.8);}
  screen(point){const v=point.clone().project(this.camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,visible:v.z>=-1&&v.z<=1};}
  hitTest(x,y,sim){
   this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
   this.raycaster.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),this.camera);
   const physical=[];const excluded=new Set([this.liquid.volume,this.bottleSmoke,this.hotTip,this.flame,this.flameCore,this.bowlBud]);
   for(const root of [...Object.values(this.items),this.trash])root.traverse(o=>{if(o.isMesh&&!excluded.has(o)&&visibleSurface(o))physical.push(o);});
   physical.push(this.stream);
   const blockers=[this.slab,this.groundMesh].filter(Boolean);
   const blockedAt=this.raycaster.intersectObjects(blockers,false)[0]?.distance??Infinity;
   return resolveLogicalHit(this.raycaster.intersectObjects([...new Set(physical)],false),o=>{
    if(o===this.stream)return 'stream';
    let id;for(let parent=o;parent&&!id;parent=parent.parent)id=parent.userData.item;
    if(id==='pipe'&&sim?.cap&&sim.prep>0)return 'bottle';
    return id;
   },blockedAt);
  }

  toWorld(x,y,z){return this.camera.localToWorld(V(x,y,z));}
  targetPoint(sim){
   let p;
   if(sim.mode==='heat')p=this.items.pipe.localToWorld(this.heroAnchors?.pipeTip?.clone()||V(0,-.015,0));
   else if(sim.phase==='hole'||sim.mode==='hole')p=this.outlet.getWorldPosition(V());
   else if(sim.mode==='press')p=this.items.bottle.localToWorld(V(0,.226,0));
   else if(sim.mode==='fill')p=this.items.bottle.localToWorld(V(0,.226,0));
   else if(['ignite','auto','pack'].includes(sim.mode))p=this.items.pipe.localToWorld(this.heroAnchors?.bowl?.clone()||V(0,.060,0));
   else p=this.items.bottle.localToWorld(V(0,.12,0));
   return p;
  }
  interactionAim(sim,input){
   if(['heat','hole','ignite'].includes(sim.mode)){
    const contact=this.items.lighter.localToWorld(this.nozzle.clone()).add(V(0,.021,0));
    return T.MathUtils.clamp(1-contact.distanceTo(this.target)/.035,0,1);
   }
   const p=this.aimScreen;return p?T.MathUtils.clamp(1-Math.hypot(input.x-p.x,input.y-p.y)/(sim.mode==='fill'?100:55),0,1):0;
  }
  prepareFrame(dt,sim,input,settings){prepareInteractionFrame(this,dt,sim,input,settings);}
  update(dt,sim,input,settings,prepared=false){
   this.time+=dt;this.wind=settings.wind;this.weather=settings.weather;
   if(!prepared)this.prepareFrame(dt,sim,input,settings);
   const bottle=this.items.bottle,pipe=this.items.pipe,lighter=this.items.lighter;
   const waterHeight=Math.max(.001,sim.water*.19);this.liquid.update(sim.water,this.time);
   this.bottleSmoke.visible=sim.smoke>.002;
   const smoke=this.bottleSmoke.material.uniforms;smoke.uTime.value=this.time;smoke.uDensity.value=sim.smokeDensity;smoke.uWater.value=.012+waterHeight;smoke.uCam.value.copy(bottle.worldToLocal(this.camera.position.clone()));
   this.outlet.visible=sim.outlet;this.bowlBud.visible=sim.bud>.01;this.budMat.emissive.setRGB(sim.embers*.7,sim.embers*.11,0);this.hotTip.material.opacity=sim.phase==='heat'?sim.heat*.45:0;
   if(this.pipeMat){
    const r=sim.residue;
    this.pipeMat.color.setRGB(1-r*.62,1-r*.74,1-r*.88);
    this.pipeMat.roughness=.05+r*.25;
   }

   this.heroProps?.update(sim);
   const flameOn=(input.fire&&['heat','hole','ignite'].includes(sim.mode))||sim.mode==='auto';this.flame.visible=this.flameCore.visible=flameOn&&sim.angle<85&&sim.angle>-75;
   const flicker=.93+Math.sin(this.time*52)*.045+Math.sin(this.time*83)*.03;this.flameLight.intensity=flameOn?.018*flicker:0;this.emberLight.intensity=sim.embers*.008;if(flameOn&&!this.wasFlame)this.wheel.rotation.x+=1.4;this.wasFlame=flameOn;if(this.flameShader){this.flame.material.uniforms.time.value=this.time;this.flameCore.visible=false;this.flame.scale.set(1,flicker,1);}else this.flame.scale.y=(.007+.012*(sim.flameQuality||.3))*flicker;
   this.items.bag.visible=!sim.upgraded;this.trash.visible=sim.upgraded;for(let i=0;i<this.bagNugs.length;i++)this.bagNugs[i].visible=i<sim.stock*3.5;
   this.jet.visible=sim.flow>0&&['free','inhale'].includes(sim.phase)&&sim.mode!=='fill';
   if(this.jet.visible){
    const start=this.outlet.getWorldPosition(V()),direction=V(1,0,0).applyQuaternion(bottle.getWorldQuaternion(new T.Quaternion()));
    const head=Math.max(0,this.liquid.level-start.y),speed=Math.sqrt(2*9.81*head)*.6,fall=Math.max(.035,start.y-this.ground(start.x,start.z)),duration=Math.sqrt(2*fall/9.81);
    const points=[];for(let i=0;i<12;i++){const t=duration*i/11;points.push(start.clone().addScaledVector(direction,speed*t).add(V(0,-4.905*t*t,0)));}
    this.jet.geometry.dispose();this.jet.geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points),16,.0014,5,false);this.jet.position.set(0,0,0);this.jet.scale.setScalar(1);this.jet.quaternion.identity();
   }
   for(const shader of this.windMats){shader.uniforms.uTime.value=this.time;shader.uniforms.uWind.value=settings.wind;}
   updateEnvironment(this,dt,sim,settings);
   for(const r of this.ripples){const t=(this.time*.36+r.userData.phase)%1;r.scale.setScalar(1+t*5);r.material.opacity=(1-t)*.11;r.position.z+=dt*.09;if(r.position.z>4)r.position.z=-6;r.position.x=this.streamX(r.position.z)+Math.sin(r.userData.phase*35)*.25;}
   const storm=settings.weather==='rain';
   this.pollen.rotation.y=Math.sin(this.time*.02)*.08;this.pollen.position.x=Math.sin(this.time*.1)*.06*settings.wind;
   if(storm){const pos=this.rain.geometry.attributes.position;for(let i=0;i<pos.count;i++){let y=pos.getY(i)-dt*3.7;if(y<0)y=7;pos.setY(i,y);}pos.needsUpdate=true;}

   this.scene.updateMatrixWorld(true);

  }
 render(){this.renderer.shadowMap.needsUpdate=true;this.renderer.render(this.scene,this.camera);}
 async enablePathTracing(){
  if(this.pathTracer)return;
  const {WebGLPathTracer}=await import('three-gpu-pathtracer');
  const scene=new T.Scene();scene.background=this.forestSky.material.uniforms.horizon.value.clone();scene.environment=this.env;scene.environmentIntensity=.62;scene.backgroundIntensity=.62;scene.backgroundRotation.copy(this.scene.backgroundRotation);scene.environmentRotation.copy(this.scene.environmentRotation);
  this.scene.updateMatrixWorld(true);
  this.scene.traverse(o=>{
   if(o.isLight){scene.add(o.clone());return;}
   if(!o.isMesh||!o.visible||o===this.stream||o===this.liquid.surface)return;let parent=o.parent;while(parent){if(!parent.visible)return;parent=parent.parent;}
   if(!o.material?.isMeshStandardMaterial&&!o.material?.isMeshPhysicalMaterial)return;
   if(o.isInstancedMesh){const m=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);const copy=new T.Mesh(o.geometry,o.material);copy.matrixAutoUpdate=false;copy.matrix.multiplyMatrices(o.matrixWorld,m);scene.add(copy);}}
   else{let geometry=o.geometry;if(o===this.liquid.volume){const y=Math.max(.026,Math.min(.29,this.liquid.level-this.items.bottle.position.y));geometry=lathe([[0,.024],[.052,.024],[.059,.035],[.059,Math.min(.245,y)],[y>.245?.052:.059,y],[0,y]]);}const copy=new T.Mesh(geometry,o.material);copy.matrixAutoUpdate=false;copy.matrix.copy(o.matrixWorld);scene.add(copy);}
  });
  const stream=mesh(this.stream.geometry,new T.MeshPhysicalMaterial({color:'#768d7f',roughness:.15,metalness:.15,transmission:.72,thickness:.3,ior:1.333}),scene);stream.matrixAutoUpdate=false;stream.matrix.copy(this.stream.matrixWorld);
  this.pathTracer=new WebGLPathTracer(this.renderer);this.bvhWorker=new GenerateMeshBVHWorker();this.pathTracer.setBVHWorker(this.bvhWorker);this.pathTracer.bounces=5;this.pathTracer.filterGlossyFactor=.5;this.pathTracer.renderScale=.7;this.pathTracer.tiles.set(3,3);this.pathTracer.minSamples=2;this.pathTracer.textureSize.set(1024,1024);await this.pathTracer.setSceneAsync(scene,this.camera);this.ptScene=scene;
 }
 disablePathTracing(){this.pathTracer?.dispose();this.bvhWorker?.dispose();this.pathTracer=null;this.ptScene=null;}
}
