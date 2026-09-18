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
import {createBudGeometry,createBudMaterial,renderBudSpriteDataUrl} from './bud.js';
import {createWeedBag} from './weed-bag.js';
import {buildForestFloor,forestHeight,forestBase,creekX,creekWidth,creekBankMeander,plantFerns,plantShrubs,plantGrass,plantPines,loadForestDetails,updateEnvironment} from './environment.js';
import {upgradeStreambedGeometries} from './streambed.js';
import {prepareInteractionFrame} from './interaction-view.js';
import {resolveLogicalHit,visibleSurface} from './picking.js';
import {FinalEdgePass} from './final-edge-pass.js';
import {Atmosphere} from './atmosphere.js';

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
  this.finalEdges=new FinalEdgePass();
  this.scene=new T.Scene();this.scene.background=new T.Color('#1a241b');this.scene.fog=new T.Fog('#1a241b',24.0,85.0);
  this.camera=new T.PerspectiveCamera(53,innerWidth/innerHeight,.025,150);this.camera.position.set(0,.98,2.65);this.camera.lookAt(0,.32,.3);
  this.baseCam=this.camera.position.clone();this.yaw=0;this.pitch=-.265;this.wind=0.5;this.weather='clear';this.time=0;this.windMats=[];this.sway=[];this.items={};this.interactive=[];this.pointer=new T.Vector2();this.raycaster=new T.Raycaster();this.target=V();this.projected={};
  this.sun=new T.DirectionalLight('#fff2d8',1.5);this.sun.position.set(16,36,-18);this.sun.castShadow=true;this.sun.shadow.mapSize.set(4096,4096);Object.assign(this.sun.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:1,far:140});this.sun.shadow.normalBias=.025;this.sun.shadow.bias=-.0001;this.scene.add(this.sun);this.scene.add(this.sun.target);
  this.scene.add(new T.HemisphereLight('#8ea89a','#242c1c',0.85));
  this.atmosphere=new Atmosphere(this);
  this.makeGround();this.makeObjects();this.makeParticles();
  this.ready=this.loadAssets(onProgress);
 }
 groundBase(x,z){return forestBase(x,z);}
 ground(x,z){return forestHeight(x,z);}
 async loadAssets(onProgress){
  const manager=new T.LoadingManager();manager.onProgress=(_,n,total)=>onProgress?.(n/total);const tl=new T.TextureLoader(manager);const gl=new GLTFLoader(manager);
  const texture=async(path,srgb=false,repeat=1)=>{const t=await tl.loadAsync(`./assets/${path}`);t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;return t;};
  this.pineBarkReady=(async()=>{
   const [map,normalMap,roughnessMap]=await Promise.all([
    texture('pine_bark_4k/pine_bark_diff_4k.jpg',true,1),
    texture('pine_bark_4k/pine_bark_nor_gl_4k.jpg',false,1),
    texture('pine_bark_4k/pine_bark_rough_4k.jpg',false,1)
   ]);
   map.wrapS=map.wrapT=T.RepeatWrapping;
   normalMap.wrapS=normalMap.wrapT=T.RepeatWrapping;
   roughnessMap.wrapS=roughnessMap.wrapT=T.RepeatWrapping;
   map.repeat.set(1.0,1.0);
   normalMap.repeat.set(1.0,1.0);
   roughnessMap.repeat.set(1.0,1.0);
   map.anisotropy=16;normalMap.anisotropy=16;roughnessMap.anisotropy=16;
   this.pineBarkPbr={map,normalMap,roughnessMap};
   return this.pineBarkPbr;
  })();
  this.treeLeafReady=gl.loadAsync('./assets/shrub_01/shrub_01.gltf');
  const tasks=[loadForestDetails(this,gl,texture),
   (async()=>{const model=await gl.loadAsync('./assets/clipper.glb');this.upgradeLighter(model.scene);})(),
   (async()=>{const model=await gl.loadAsync('./assets/bottle.glb');this.upgradeBottle(model.scene);})(),
   (async()=>{const model=await gl.loadAsync('./assets/pipe.glb');this.upgradePipe(model.scene);})(),
   (async()=>{try{const[bH,pH,scH,bgH,pcH,cavH,contract]=await Promise.all([gl.loadAsync('./assets/props-hero/bottle_hero.glb'),gl.loadAsync('./assets/props-hero/pipe_hero.glb'),gl.loadAsync('./assets/props-hero/cap_spare.glb'),gl.loadAsync('./assets/props-hero/bag_hero.glb'),gl.loadAsync('./assets/props-hero/packed_charge.glb'),gl.loadAsync('./assets/props-hero/bottle_cavity.glb'),fetch('./assets/props-hero/prop_contract.json').then(r=>r.json()).catch(()=>null)]);this.heroModels={bottle:bH.scene,pipe:pH.scene,spareCap:scH.scene,bag:bgH.scene,packedCharge:pcH.scene,bottleCavity:cavH.scene};this.heroContract=contract;if(contract?.samples&&this.liquid?.setSamples)this.liquid.setSamples(contract.samples);}catch(e){console.warn('Hero props GLB load failed:',e.message);}})(),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/rock_moss_set_01/rock_moss_set_01.gltf'),gl.loadAsync('./assets/creek_rocks_lod.glb')]);this.upgradeRocks(model.scene,lod.scene);})(),
   (async()=>{const env=await new RGBELoader(manager).loadAsync('./assets/forest.hdr');env.mapping=T.EquirectangularReflectionMapping;this.env=env;this.scene.environment=env;this.scene.background=null;this.scene.environmentIntensity=.62;this.scene.backgroundIntensity=.62;this.scene.backgroundRotation.y=1.7;this.scene.environmentRotation.y=1.7;this.scene.backgroundBlurriness=0;})(),
   (async()=>{const [map,normalMap]=await Promise.all([texture('rock_boulder_dry/diff.jpg',true,2.5),texture('rock_boulder_dry/nor_gl.jpg',false,2.5)]);Object.assign(this.rockMat,{map,normalMap});this.rockMat.normalScale.set(.75,.75);this.rockMat.needsUpdate=true;})(),
   (async()=>{const [map,normalMap]=await Promise.all([texture('bark_brown_02/diff.jpg',true,3),texture('bark_brown_02/nor_gl.jpg',false,3)]);Object.assign(this.barkMat,{map,normalMap});this.barkMat.needsUpdate=true;})(),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/fern_02/fern_02.gltf'),gl.loadAsync('./assets/fern_02_lod.glb')]);plantFerns(this,model.scene,lod.scene);})(),
   (async()=>{const [model,lod,broadleaf,broadleafLod,solidBroadleaf,shrub02,shrub02Lod]=await Promise.all([gl.loadAsync('./assets/shrub_04/shrub_04.gltf'),gl.loadAsync('./assets/shrub_04_lod.glb'),gl.loadAsync('./assets/shrub_03/shrub_03.gltf'),gl.loadAsync('./assets/shrub_03_lod.glb'),this.treeLeafReady,gl.loadAsync('./assets/shrub_02/shrub_02.gltf'),gl.loadAsync('./assets/shrub_02_lod.glb')]);this.makeShrubs(model.scene,lod.scene,broadleaf.scene,broadleafLod.scene,solidBroadleaf.scene,shrub02.scene,shrub02Lod.scene);})(),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/grass_clumps_lod.glb'),gl.loadAsync('./assets/grass_far_lod.glb')]);plantGrass(this,model.scene,lod.scene);})(),
   (async()=>{try{const [model,leafAsset]=await Promise.all([gl.loadAsync('./assets/pine.glb'),this.treeLeafReady,this.pineBarkReady,...this.foliageAlphaReady]);this.makePines(model.scene,leafAsset.scene);}catch(e){console.warn('Pine LOD unavailable',e.message);}})()
  ];const result=await Promise.allSettled(tasks);this.assetErrors=result.filter(r=>r.status==='rejected').map(r=>String(r.reason));if(this.assetErrors.length)console.error(this.assetErrors);upgradeHeroProps(this);this.renderer.compile(this.scene,this.camera);this._shadowState=null;this.renderer.shadowMap.needsUpdate=true;return this;
 }
 makeGround(){buildForestFloor(this);}
 streamX(z){return creekX(z);}
 streamWidth(z){return creekWidth(z);}
 addWind(material,amp=.025){material.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};shader.uniforms.uWind={value:this.wind};shader.vertexShader='uniform float uTime; uniform float uWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n float sway = sin(uTime*1.3+position.x*1.8+position.z*.9)*${amp.toFixed(4)}*uWind; transformed.x += sway*max(0.,position.y); transformed.z += sway*.4*max(0.,position.y);`);this.windMats.push(shader);};material.customProgramCacheKey=()=>`wind${amp}`;}
  makeFerns(model){plantFerns(this,model);}
 makePines(model,leafModel=null){plantPines(this,model,false,leafModel);}
  makeShrubs(model,lodModel,broadleafModel=null,broadleafLod=null,solidBroadleafModel=null,shrub02Model=null,shrub02Lod=null){plantShrubs(this,model,lodModel,broadleafModel,broadleafLod,solidBroadleafModel,shrub02Model,shrub02Lod);}
  makeGroundCover(model){plantGrass(this,model);}
  upgradeRocks(model,lodModel){
   const sources=[];model.traverse(o=>{if(o.isMesh)sources.push(o);});
   const lods=new Map();lodModel?.traverse(o=>{if(o.isMesh)lods.set(o.name,o);});
   const src=sources[0];if(!src)return;const g=src.geometry.clone();g.computeBoundingBox();const bounds=g.boundingBox,size=bounds.getSize(V()),center=bounds.getCenter(V());g.translate(-center.x,-bounds.min.y,-center.z);
    const m=src.material.clone();
    m.roughness=.88;m.metalness=0.0;m.normalScale=new T.Vector2(1.15,1.15);m.color.set('#d5d4c8');m.aoMapIntensity=1.0;
    const tl=new T.TextureLoader();
    const loadMap=(path,srgb=false)=>{
      const t=tl.load(path,tex=>{
        tex.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;
        tex.flipY=false;tex.anisotropy=16;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;
        m.needsUpdate=true;
      });
      t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.flipY=false;t.anisotropy=16;
      return t;
    };
    m.map=loadMap('./assets/rock_moss_set_01/textures/diff_4k.jpg',true);
    m.normalMap=loadMap('./assets/rock_moss_set_01/textures/nor_gl_4k.jpg',false);
    m.roughnessMap=loadMap('./assets/rock_moss_set_01/textures/rough_4k.jpg',false);
    m.aoMap=loadMap('./assets/rock_moss_set_01/textures/ao_4k.jpg',false);

    const loadDetail=(path,srgb=false)=>{
      const t=tl.load(path,tex=>{
        tex.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;
        tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=16;tex.minFilter=T.LinearMipmapLinearFilter;tex.generateMipmaps=true;
        m.needsUpdate=true;
      });
      t.colorSpace=srgb?T.SRGBColorSpace:T.NoColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=16;
      return t;
    };
    const uMicroDiff={value:loadDetail('./assets/rock_boulder_dry/diff_4k.jpg',true)};
    const uMicroNormal={value:loadDetail('./assets/rock_boulder_dry/nor_gl_4k.jpg',false)};
    const uMicroRough={value:loadDetail('./assets/rock_boulder_dry/rough_4k.jpg',false)};
    const uMicroAO={value:loadDetail('./assets/rock_boulder_dry/ao_4k.jpg',false)};
    const uViewRotation={value:new T.Matrix3()};

    m.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{uMicroDiff,uMicroNormal,uMicroRough,uMicroAO,uViewRotation});
      shader.vertexShader=shader.vertexShader.replace('#include <common>',
        '#include <common>\nvarying vec3 vStoneWorldPos;\nvarying vec3 vStoneWorldNorm;\nvarying vec3 vStreamMaskPos;'
      ).replace('#include <begin_vertex>',
        `#include <begin_vertex>
         #ifdef USE_INSTANCING
          mat4 instModel=modelMatrix*instanceMatrix;
          vStoneWorldPos=(instModel*vec4(transformed,1.0)).xyz;
          vStreamMaskPos=vStoneWorldPos;
          vec3 scaleSq=vec3(dot(instModel[0].xyz,instModel[0].xyz),dot(instModel[1].xyz,instModel[1].xyz),dot(instModel[2].xyz,instModel[2].xyz));
          vec3 invScaleSq=1.0/max(vec3(0.0001),scaleSq);
          vStoneWorldNorm=normalize(mat3(instModel)*(normal*invScaleSq));
         #else
          vStoneWorldPos=(modelMatrix*vec4(transformed,1.0)).xyz;
          vStreamMaskPos=vStoneWorldPos;
          vec3 scaleSq=vec3(dot(modelMatrix[0].xyz,modelMatrix[0].xyz),dot(modelMatrix[1].xyz,modelMatrix[1].xyz),dot(modelMatrix[2].xyz,modelMatrix[2].xyz));
          vec3 invScaleSq=1.0/max(vec3(0.0001),scaleSq);
          vStoneWorldNorm=normalize(mat3(modelMatrix)*(normal*invScaleSq));
         #endif`
      );

      shader.fragmentShader=
        'varying vec3 vStoneWorldPos;\n'+
        'varying vec3 vStoneWorldNorm;\n'+
        'varying vec3 vStreamMaskPos;\n'+
        'uniform sampler2D uMicroDiff;\n'+
        'uniform sampler2D uMicroNormal;\n'+
        'uniform sampler2D uMicroRough;\n'+
        'uniform sampler2D uMicroAO;\n'+
        'uniform mat3 uViewRotation;\n'+
        shader.fragmentShader;

      const triChunk=`
        vec3 sNorm=normalize(vStoneWorldNorm);
        if(!gl_FrontFacing)sNorm=-sNorm;
        vec3 sWeights=pow(abs(sNorm),vec3(4.0));
        sWeights/=max(0.0001,sWeights.x+sWeights.y+sWeights.z);
        float slope=1.0-abs(sNorm.y);
        float sFreq=14.0;
        vec2 sUvY=vStoneWorldPos.xz*sFreq;
        vec2 sUvX=vStoneWorldPos.zy*sFreq;
        vec2 sUvZ=vStoneWorldPos.xy*sFreq;
        vec3 mDiff=texture2D(uMicroDiff,sUvX).rgb*sWeights.x+texture2D(uMicroDiff,sUvY).rgb*sWeights.y+texture2D(uMicroDiff,sUvZ).rgb*sWeights.z;
      `;

      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
        triChunk+
        T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',
          `diffuseColor *= sampledDiffuseColor;
           vec3 grain=mDiff/vec3(0.658,0.609,0.550);
           diffuseColor.rgb*=mix(vec3(1.0),grain,0.48);
           float antiStretch=smoothstep(0.20,0.50,slope);
           vec3 slopeDetail=diffuseColor.rgb*mix(vec3(1.0),grain,0.50);
           diffuseColor.rgb=mix(diffuseColor.rgb,slopeDetail,antiStretch*0.75);

           // GH-36: only the stream-adjacent, air-side face of an authored
           // field stone gets this correction. The slab and ordinary clearing
           // stones remain unchanged; submerged streambed stones use their
           // own untouched material path.
           float streamCenter=-1.65+sin(vStreamMaskPos.z*0.18)*0.50;
           float streamNear=1.0-smoothstep(0.66,1.22,abs(vStreamMaskPos.x-streamCenter));
           float airFace=smoothstep(-0.080,0.010,vStreamMaskPos.y);
           float streamAir=streamNear*airFace;
           float paleAir=smoothstep(0.30,0.70,dot(diffuseColor.rgb,vec3(0.299,0.587,0.114)));
           vec3 weatheredAir=mix(diffuseColor.rgb*vec3(0.90,0.88,0.84),grain*vec3(0.88,0.86,0.82),0.24);
           diffuseColor.rgb=mix(diffuseColor.rgb,weatheredAir,streamAir*paleAir*0.12);`
        )
      );

      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
        T.ShaderChunk.normal_fragment_maps+`
         vec3 mNY=texture2D(uMicroNormal,sUvY).xyz*2.0-1.0;
         vec3 mNX=texture2D(uMicroNormal,sUvX).xyz*2.0-1.0;
         vec3 mNZ=texture2D(uMicroNormal,sUvZ).xyz*2.0-1.0;
         vec3 dNw=vec3(0.0,mNX.y,mNX.x)*sWeights.x+vec3(mNY.x,0.0,mNY.y)*sWeights.y+vec3(mNZ.x,mNZ.y,0.0)*sWeights.z;
         float nStr=mix(0.55,1.15,smoothstep(0.18,0.48,slope));
         normal=normalize(normal+(uViewRotation*dNw)*nStr);
        `
      );

      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',
        T.ShaderChunk.roughnessmap_fragment+`
         float mRough=texture2D(uMicroRough,sUvX).g*sWeights.x+texture2D(uMicroRough,sUvY).g*sWeights.y+texture2D(uMicroRough,sUvZ).g*sWeights.z;
         float rMod=mix(mRough,mRough*1.15,smoothstep(0.18,0.48,slope));
         roughnessFactor=clamp(roughnessFactor*mix(0.80,1.25,rMod),0.18,0.96);
        `
      );

      shader.fragmentShader=shader.fragmentShader.replace('#include <aomap_fragment>',
        T.ShaderChunk.aomap_fragment+`
         float mAO=texture2D(uMicroAO,sUvX).r*sWeights.x+texture2D(uMicroAO,sUvY).r*sWeights.y+texture2D(uMicroAO,sUvZ).r*sWeights.z;
         reflectedLight.indirectDiffuse*=mix(1.0,mAO,0.40);
        `
      );

      shader.fragmentShader=shader.fragmentShader.replace('#include <output_fragment>',`
         float streamAirOutput=streamNear*airFace;
         float paleOutput=smoothstep(0.34,0.70,dot(outgoingLight,vec3(0.299,0.587,0.114)));
         vec3 weatheredOutput=mix(outgoingLight*vec3(0.94,0.92,0.88),outgoingLight*vec3(0.98,0.96,0.92),0.32);
         outgoingLight=mix(outgoingLight,weatheredOutput,streamAirOutput*paleOutput*0.08);
         #include <output_fragment>`);
    };
    m.customProgramCacheKey=()=>'slab-detail-pbr-2';
   this.slab.geometry=g;this.slab.material=m;this.slab.scale.set(1.62/size.x,.50/size.y,1.28/size.z);this.slab.position.set(0,-.165,.83);this.slab.rotation.set(0,0,0);
   this.slab.onBeforeRender=(_renderer,_scene,camera)=>{uViewRotation.value.setFromMatrix4(camera.matrixWorldInverse);};
   this.slab.updateMatrixWorld(true);const down=new T.Raycaster();const bagRestQ=new T.Quaternion().setFromEuler(new T.Euler(-1.453,-.0931,.9055));for(const [id,home]of Object.entries(this.home)){if(id==='bag'){let seat=null;for(const bx of[-.04,0,.04])for(const by of[.01,.05,.09,.12]){const lp=V(bx,by,-.017).applyQuaternion(bagRestQ);down.set(V(home.x+lp.x,2,home.z+lp.z),V(0,-1,0));const bhit=down.intersectObject(this.slab)[0];if(bhit)seat=Math.max(seat??-Infinity,bhit.point.y-lp.y);}if(seat!==null)home.y=seat-.004;continue;}down.set(V(home.x,2,home.z),V(0,-1,0));const hit=down.intersectObject(this.slab)[0];if(hit)home.y=hit.point.y+(id==='pipe'?.019:id==='lighter'?.016:id==='bottle'?.020:.001);}
    const authoredRocks=[
     // Zone 1: Foreground / ground close-up (nestled in loam between player and slab)
     [0.32,1.95,0.13,true],[-0.42,2.15,0.12,true],[0.68,2.25,0.15,true],
     [-0.25,1.62,0.11,true],[0.45,1.55,0.14,true],[-0.58,1.88,0.16,true],
     [0.12,2.28,0.10,true],[-0.15,2.45,0.09,true],
     // Zone 2: Clearing perimeter & slab collar
     [-0.55,0.68,0.22,false],[0.62,0.74,0.24,false],[-0.42,1.06,0.20,false],
     [0.52,1.14,0.22,false],[0.0,1.22,0.18,false],[0.72,0.52,0.20,false],
      [-0.92,0.92,0.16,false],[0.28,1.35,0.16,false],[0.95,0.55,0.25,false],
     [1.35,1.15,0.28,false],[1.45,1.85,0.26,false],[0.82,1.28,0.22,false],
      [-0.62,0.45,0.20,false],[-0.68,1.45,0.22,false],[1.65,2.15,0.25,false],
      [-0.95,2.05,0.21,false],
     // Zone 4: Midground knolls, nurse logs & slopes
     [2.1,3.2,0.42,false],[3.4,1.5,0.45,false],[1.6,-1.4,0.38,false],
     [-3.6,2.2,0.44,false],[-1.5,4.2,0.40,false],[2.8,-0.6,0.46,false],
     [3.6,2.8,0.48,false],[2.4,4.2,0.38,false],[-4.1,1.2,0.42,false],
     [-3.8,3.4,0.45,false]
    ];
    upgradeStreambedGeometries(this, sources, lods);

    // GH-36: only field-stone instances that physically cross the creek lip
    // receive the full-resolution source mesh. The matrices are built once
    // below and copied unchanged into the two batches, so this split changes
    // topology/texture fidelity without moving, resizing, or reshaping any
    // existing stone. Land-only stones retain their lighter LOD path.
    const crossesCreekLip=(x,z,targetSize)=>{
     const center=creekX(z)+creekBankMeander(z);
     const half=creekWidth(z)*.5;
     return Math.abs(x-center)<=half+Math.max(.18,targetSize*.72)&&this.ground(x,z)<.06;
    };

    sources.forEach((s,index)=>{
     const d=new T.Object3D();let count=0;
     const streamMatrices=[],landMatrices=[],refillBankHeroAMatrices=[],refillBankHeroBMatrices=[];
     const lodReference=(lods.get(s.name)??s).geometry;
     lodReference.computeBoundingBox();
     const lodReferenceSize=lodReference.boundingBox.getSize(V());
     const lodReferenceMax=Math.max(lodReferenceSize.x,lodReferenceSize.z);

      // Distribute authored field stones across the 6 rock variants
      for(let k=0;k<authoredRocks.length;k++){
       if(k%sources.length!==index)continue;
       const [x,z,targetSize,isCloseUp]=authoredRocks[k];
       const sz=lodReferenceSize,maxSz=lodReferenceMax;
       const scale=targetSize/maxSz;
       const eps=0.15;
       const slopeX=(this.ground(x+eps,z)-this.ground(x-eps,z))/(2*eps);
       const slopeZ=(this.ground(x,z+eps)-this.ground(x,z-eps))/(2*eps);
       const rxJitter=rand(-0.06,0.06);
       const yaw=rand(0,Math.PI*2);
       const rzJitter=rand(-0.06,0.06);
       const aspect=rand(0.92,1.18);
       const yAspect=rand(0.88,1.12);

       const norm=new T.Vector3(-slopeX,1.0,-slopeZ).normalize();
       const qYaw=new T.Quaternion().setFromAxisAngle(V(0,1,0),yaw);
       const qAlign=new T.Quaternion().setFromUnitVectors(V(0,1,0),norm);
       const qWobble=new T.Quaternion().setFromEuler(new T.Euler(rxJitter,0,rzJitter));
       d.quaternion.copy(qAlign).multiply(qYaw).multiply(qWobble);

       const gy=this.ground(x,z)-scale*sz.y*(isCloseUp?0.48:0.54);
       d.position.set(x,gy,z);
       d.scale.set(scale*aspect,scale*yAspect,scale/aspect);
       d.updateMatrix();
       // STREAM-BED-01: these are the two refill-visible source-2 bank rocks
       // that read as pale/smooth in the current top-down and refill views.
       // Keep their authored transforms exactly, but route them to a dedicated
       // high-detail batch below instead of the ordinary clearing LOD batch.
       if(k===8)refillBankHeroAMatrices.push(d.matrix.clone());
       else if(k===20)refillBankHeroBMatrices.push(d.matrix.clone());
       else (crossesCreekLip(x,z,targetSize)?streamMatrices:landMatrices).push(d.matrix.clone());
      }
     const makeBatch=(matrices,useLod,label,sourceOverride=null,creekPbr=false,heroBank=false,heroColor='#73716a')=>{
      if(!matrices.length)return;
      const sourceMesh=sourceOverride??((useLod?lods.get(s.name):null)??s);
      const geometry=sourceMesh.geometry.clone();geometry.computeBoundingBox();
      const rawSize=geometry.boundingBox.getSize(V());
      // Every creek-facing high-detail rock preserves the source scan's true
      // geological aspect ratio. Fit its horizontal maximum to the old authored
      // footprint, while leaving the full-resolution silhouette unwarped.
      if(creekPbr){
       const rawMax=Math.max(rawSize.x,rawSize.z);
       const uniformFit=lodReferenceMax/Math.max(.0001,rawMax);
       geometry.scale(uniformFit,uniformFit,uniformFit);
      }else{
       // Preserve established dimensions for all unrelated authored rocks.
       geometry.scale(lodReferenceSize.x/rawSize.x,lodReferenceSize.y/rawSize.y,lodReferenceSize.z/rawSize.z);
      }
      geometry.computeBoundingBox();const bb=geometry.boundingBox,c=bb.getCenter(V());geometry.translate(-c.x,-bb.min.y,-c.z);
      // Both batches share the same 4K photogrammetry material family as the
      // ritual slab; only the creek-crossing batch gets the full mesh source.
      const material=m.clone();material.roughness=.88;
      if(creekPbr){
       if(heroBank)material.color.set(heroColor);
       material.normalScale.set(heroBank?1.82:1.58,heroBank?1.82:1.58);
       material.roughness=heroBank ? .84 : .86;
       material.envMapIntensity=heroBank ? .84 : .86;
       const baseCompile=material.onBeforeCompile;
       material.onBeforeCompile=shader=>{
        baseCompile(shader);
        // The old stream-air correction collapsed bright full-resolution scans
        // into a nearly uniform beige cap. Creek PBR batches retain the scan's
        // actual albedo/micro-normal contrast on dry facets; only a very small
        // weathering restraint remains to avoid chalk-white clipping.
        shader.fragmentShader=shader.fragmentShader
         .replace('streamAir*paleAir*0.94','streamAir*paleAir*0.10')
         .replace('streamAirOutput*paleOutput*0.64','streamAirOutput*paleOutput*0.08');
        // Smooth roughness and color continuously through the waterline. The
        // dry side is left on the same 4K scan + triplanar micro-detail path as
        // the ritual slab rather than being replaced with a synthetic dry cap.
        shader.fragmentShader=shader.fragmentShader.replace(
         'roughnessFactor=clamp(roughnessFactor*mix(0.80,1.25,rMod),0.18,0.96);',
         `roughnessFactor=clamp(roughnessFactor*mix(0.80,1.25,rMod),0.18,0.96);
          float creekRoughWet=smoothstep(-0.018,0.026,-0.065-vStoneWorldPos.y);
          roughnessFactor=mix(roughnessFactor,0.34,creekRoughWet*0.72);`
        );
        shader.fragmentShader=shader.fragmentShader.replace('#include <output_fragment>',`
         float bankDepth=-0.065-vStoneWorldPos.y;
         float bankWet=smoothstep(-0.018,0.024,bankDepth);
         float bankLuma=dot(outgoingLight,vec3(0.299,0.587,0.114));
         vec3 bankWetColor=mix(vec3(bankLuma),outgoingLight*vec3(0.80,0.85,0.76),1.10);
         bankWetColor*=vec3(0.94,0.96,0.91);
         outgoingLight=mix(outgoingLight,bankWetColor,bankWet*0.58);
         // Full-resolution authored creek rocks use the same photographed scan
         // as the ritual slab. Preserve that texture in canopy shadow rather
         // than allowing the entire rock to collapse into a black silhouette.
         float creekScanLuma=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114));
         vec3 creekMicroFallback=min(vec3(0.86),mDiff*vec3(1.03,0.96,0.86)*1.55);
         float creekAtlasFallback=1.0-smoothstep(0.055,0.16,creekScanLuma);
         vec3 creekReadableScan=mix(diffuseColor.rgb,creekMicroFallback,creekAtlasFallback*0.94);
         float creekReadableLuma=max(0.025,dot(creekReadableScan,vec3(0.299,0.587,0.114)));
         float creekTargetLuma=mix(0.25,0.17,bankWet);
         vec3 creekScanFloor=min(vec3(0.80),creekReadableScan*max(1.0,creekTargetLuma/creekReadableLuma));
         outgoingLight=max(outgoingLight,creekScanFloor);
         #include <output_fragment>`);
       };
       material.customProgramCacheKey=()=>`${m.customProgramCacheKey?.()??'slab-detail-pbr-2'}-${heroBank?'refill-bank':'creek'}-scan-pbr`;
      }
      const inst=new T.InstancedMesh(geometry,material,matrices.length);inst.name=label;
      inst.onBeforeRender=(_renderer,_scene,camera)=>{uViewRotation.value.setFromMatrix4(camera.matrixWorldInverse);};
      matrices.forEach((matrix,i)=>inst.setMatrixAt(i,matrix));
      inst.instanceMatrix.needsUpdate=true;inst.castShadow=true;inst.receiveShadow=true;this.scene.add(inst);
     };
     makeBatch(streamMatrices,false,'Scanned creek-crossing stones • full-resolution scan PBR',null,true,false);
     makeBatch(landMatrices,true,'Scanned clearing stones');
     makeBatch(refillBankHeroAMatrices,false,'Scanned refill-bank stone A • full-resolution scan PBR',sources[0]??s,true,true,'#a7a397');
     makeBatch(refillBankHeroBMatrices,false,'Scanned refill-bank stone B • full-resolution scan PBR',sources[1]??sources[0]??s,true,true,'#9d8f7d');
    });
  }
 // --- HERO PROPS INTERMEDIATE GLB IMPORT ---
 // NOTE (GH-43 ARCHITECTURAL AUDIT):
 // upgradeBottle() and upgradePipe() import legacy GLB assets ('bottle.glb' and 'pipe.glb').
 // These imported models are COMPLETELY SUPERSEDED and stripped out when upgradeHeroProps(this)
 // runs at the end of loadAssets(), replacing them with the authoritative procedural meshes in props.js.
 // upgradeLighter() imports 'clipper.glb', from which only the lower chassis is retained by props.js:correctLighter().
 upgradeBottle(model){
  // [SUPERSEDED AT RUNTIME by props.js:rebuildBottle()]
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
  // [SUPERSEDED AT RUNTIME by props.js:rebuildPipe()]
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
  // [HYBRID AT RUNTIME: Lower chassis retained from clipper.glb; head assembly replaced by props.js:correctLighter()]
   const keep=new Set([this.flame,this.flameCore,this.flameLight]);for(const child of [...this.items.lighter.children])if(!keep.has(child)){this.items.lighter.remove(child);child.traverse(o=>{const i=this.interactive.indexOf(o);if(i>=0)this.interactive.splice(i,1);});}
   this.items.lighter.add(model);
   model.rotation.y = Math.PI;
   model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.item='lighter';this.interactive.push(o);if(o.name==='Label'){o.visible=false;}if(o.name==='Striker_wheel'||o.name==='Striker wheel')this.wheel=o;}});
   const sticker=mesh(new T.CylinderGeometry(.00828,.00828,.054,64,1,true,0,Math.PI*2),mat('#ffffff',.38,{map:this.lighterDesign,side:T.DoubleSide}),model,V(0,.031,0));sticker.userData.item='lighter';this.interactive.push(sticker);
   this.flame.position.set(-.003,.076,.002);this.flameCore.position.set(-.003,.072,.002);this.flameLight.position.set(-.003,.087,.002);this.flameAnchor=V(-.003,.092,.002);
   this.nozzle=V(-.003,.072,.002);this.flame.geometry=new T.PlaneGeometry(.016,.036);this.flame.geometry.translate(0,.018,0);this.flame.material=flameMaterial();this.flame.scale.setScalar(1);this.flameShader=true;
 }
  makeObjects(){
   // NOTE (GH-43 ARCHITECTURAL AUDIT):
   // makeObjects() creates synchronous startup fallback representations so items.bottle,
   // items.pipe, and items.lighter exist with valid groups/anchors before asynchronous asset
   // loading finishes. These fallback meshes are [SUPERSEDED AT RUNTIME] when loadAssets()
   // and props.js:upgradeHeroProps() complete.
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
   this.budMat=createBudMaterial();this.bowlBud=mesh(createBudGeometry({seed:101,scale:0.68}),this.budMat,cap,V(0,.040,0));this.bagBudMat=createBudMaterial();
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
   const weedBag=createWeedBag(this.bagBudMat);bag.add(weedBag.group);this.bagFilm=weedBag.film;this.bagNugs=weedBag.contents;this.bagGeos=weedBag.geometries;
   const outlet=mesh(new T.CircleGeometry(.0025,16),mat('#161b12',.8,{side:T.DoubleSide}),bottle,V(.0326,.032,0));outlet.rotation.y=Math.PI*.43;this.outlet=outlet;
    const jetMat=new T.MeshPhysicalMaterial({color:'#e7fff9',roughness:.035,metalness:0,transmission:.55,thickness:.01,ior:1.333,transparent:true,opacity:.94,depthWrite:false,side:T.DoubleSide,envMapIntensity:1.2,clearcoat:.8,clearcoatRoughness:.025});
    jetMat.onBeforeCompile=shader=>{shader.uniforms.uTime={value:0};this.jetShader=shader;shader.vertexShader='uniform float uTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\n float swirl = sin(position.y * 180.0 - uTime * 35.0) * 0.00028;\n transformed.x += swirl;\n transformed.z += cos(position.y * 180.0 - uTime * 35.0) * 0.00028;`);};
    this.jet=mesh(new T.CylinderGeometry(.0014,.0021,1,8),jetMat,this.scene);this.jet.castShadow=false;this.jet.renderOrder=3;
    const splashMat=new T.MeshBasicMaterial({color:'#d9fff6',transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
    this.splashRing=mesh(new T.RingGeometry(.003,.036,32),splashMat,this.scene);this.splashRing.rotation.x=-Math.PI/2;this.splashRing.renderOrder=3;this.splashRing.visible=false;
    const dropGeo=new T.SphereGeometry(.0012,8,6);this.jetDrops=[];for(let i=0;i<6;i++){const d=mesh(dropGeo,jetMat,this.scene);d.castShadow=false;d.visible=false;this.jetDrops.push(d);}
   this.home={bottle:V(-.2272,.293,.7578),pipe:V(-.201,.323,.986),lighter:V(-.10,.31,.92),bag:V(.287,.32,1.084)};
   for(const [id,g]of Object.entries(this.items)){g.userData.item=id;g.position.copy(this.home[id]);g.traverse(o=>{o.userData.item=id;if(o.isMesh)this.interactive.push(o);});}this.items.bottle.rotation.set(-1.7768,.1651,.7989);this.items.bag.rotation.set(-1.453,-.0931,.9055);this.items.lighter.rotation.set(1.5708,0,0);
  }
  makeParticles(){
   // Retain the original 180 * 3 RNG draws so rain and every later
   // deterministic placement retain their established seeds. Atmosphere owns
   // the per-particle motion and light-aware dust shader.
   const count=180,arr=new Float32Array(count*3);for(let i=0;i<count;i++)arr.set([rand(-7,7),rand(.15,3),rand(-7,4)],i*3);
   this.pollen=this.atmosphere.createPollen(arr);
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
   this._shadowState=null;
   this.renderer.setSize(innerWidth,innerHeight);
   this.atmosphere?.setQuality(value);
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.atmosphere?.resize();}
  look(dx,dy){this.yaw-=dx*.003;this.pitch=T.MathUtils.clamp(this.pitch-dy*.003,-1.15,.8);}
  screen(point){const v=point.clone().project(this.camera);return{x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,visible:v.z>=-1&&v.z<=1};}
  hitTest(x,y,sim){
   this.scene.updateMatrixWorld(true);this.camera.updateMatrixWorld(true);
   this.raycaster.setFromCamera(new T.Vector2(x/innerWidth*2-1,1-y/innerHeight*2),this.camera);
   const physical=[];const excluded=new Set([this.liquid.volume,this.bottleSmoke,this.hotTip,this.flame,this.flameCore,this.bowlBud]);
   for(const root of Object.values(this.items))root.traverse(o=>{if(o.isMesh&&!excluded.has(o)&&visibleSurface(o))physical.push(o);});
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
    if(this.pipeMat&&!this.heroProps){
     const r=sim.residue;
     this.pipeMat.color.setRGB(1-r*.04,1-r*.06,1-r*.09);
     this.pipeMat.roughness=.05+r*.025;
    }

   this.heroProps?.update(sim);
   const lighterAlone=sim.held==='lighter'&&!sim.supporting;
   const flameOn=input.fire&&(lighterAlone||['heat','hole','ignite'].includes(sim.mode));this.flame.visible=this.flameCore.visible=flameOn&&sim.angle<85&&sim.angle>-75;
   const flicker=.93+Math.sin(this.time*52)*.045+Math.sin(this.time*83)*.03;this.flameLight.intensity=flameOn?.018*flicker:0;this.emberLight.intensity=sim.embers*.008;if(flameOn&&!this.wasFlame)this.wheel.rotation.x+=1.4;this.wasFlame=flameOn;if(this.flameShader){this.flame.material.uniforms.time.value=this.time;this.flameCore.visible=false;this.flame.scale.set(1,flicker,1);}else this.flame.scale.y=(.007+.012*(sim.flameQuality||.3))*flicker;
   this.items.bag.visible=true;for(let i=0;i<this.bagNugs.length;i++)this.bagNugs[i].visible=i<sim.stock*3.5;
   this.jet.visible=sim.flow>0&&['free','inhale'].includes(sim.phase)&&sim.mode!=='fill';
   if(this.jetShader)this.jetShader.uniforms.uTime.value=this.time;
   if(this.jet.visible){
    const start=this.outlet.getWorldPosition(V()),direction=V(1,0,0).applyQuaternion(bottle.getWorldQuaternion(new T.Quaternion())).normalize();
    const head=Math.max(0,this.liquid.level-start.y),speed=Math.sqrt(2*9.81*head)*.75;
    const fall=Math.max(.035,start.y-this.ground(start.x,start.z)),duration=Math.sqrt(2*fall/9.81);
    const points=[];const steps=14;let impactPoint=null;
    for(let i=0;i<=steps;i++){
     const t=duration*(i/steps);const pt=start.clone().addScaledVector(direction,speed*t).add(V(0,-4.905*t*t,0));
     const groundY=this.ground(pt.x,pt.z);
     if(pt.y<=groundY&&i>0){pt.y=groundY+.001;points.push(pt);impactPoint=pt;break;}
     points.push(pt);if(i===steps)impactPoint=pt;
    }
    if(points.length>=2){
     this.jet.geometry.dispose();this.jet.geometry=new T.TubeGeometry(new T.CatmullRomCurve3(points),16,.003,8,false);this.jet.position.set(0,0,0);this.jet.scale.setScalar(1);this.jet.quaternion.identity();
    }
    if(impactPoint&&this.splashRing){
     this.splashRing.visible=true;this.splashRing.position.copy(impactPoint).add(V(0,.001,0));
     const splashPhase=(this.time*9.0)%1.0;this.splashRing.scale.setScalar(.6+splashPhase*1.2);this.splashRing.material.opacity=(1.0-splashPhase)*.68*Math.min(1.0,speed*2.0);
    }
    if(this.jetDrops&&points.length>=4){
     const tailIdx=Math.floor(points.length*.7);
     for(let i=0;i<this.jetDrops.length;i++){
      const drop=this.jetDrops[i];drop.visible=true;const frac=(i+(this.time*8.0)%1.0)/this.jetDrops.length;
      drop.position.copy(points[tailIdx]).lerp(points[points.length-1],frac);
      drop.position.x+=Math.sin(this.time*30.0+i*2.1)*.0012;drop.position.z+=Math.cos(this.time*35.0+i*2.7)*.0012;
     }
    }
   }else{
    if(this.splashRing)this.splashRing.visible=false;
    if(this.jetDrops)for(const d of this.jetDrops)d.visible=false;
   }
   for(const shader of this.windMats){shader.uniforms.uTime.value=this.time;shader.uniforms.uWind.value=settings.wind;}
   updateEnvironment(this,dt,sim,settings);
   for(const r of this.ripples){const t=(this.time*.36+r.userData.phase)%1;r.scale.setScalar(1+t*5);r.material.opacity=(1-t)*.11;r.position.z+=dt*.09;if(r.position.z>4)r.position.z=-6;r.position.x=this.streamX(r.position.z)+Math.sin(r.userData.phase*35)*.25;}
   this.atmosphere?.update(dt,settings);
   const storm=settings.weather==='rain';
   if(storm){const pos=this.rain.geometry.attributes.position;for(let i=0;i<pos.count;i++){let y=pos.getY(i)-dt*3.7;if(y<0)y=7;pos.setY(i,y);}pos.needsUpdate=true;}

   this.scene.updateMatrixWorld(true);

  }
  checkShadowUpdate(){
   const sm=this.renderer.shadowMap;
   if(!sm.enabled||sm.autoUpdate)return;
   if(sm.needsUpdate)return;
   const sun=this.sun;
   const items=[this.items?.lighter,this.wheel,this.items?.bottle,this.items?.pipe,this.items?.bag].filter(Boolean);
   let dirty=!this._shadowState;
   if(!dirty){
    const s=this._shadowState;
    if(s.sx!==sun.position.x||s.sy!==sun.position.y||s.sz!==sun.position.z||s.si!==sun.intensity||s.sc!==sun.color.getHex()){
     dirty=true;
    }else{
     for(let i=0;i<items.length;i++){
      const item=items[i],cached=s.items[i];
      if(!cached||cached.v!==item.visible){dirty=true;break;}
      const m=item.matrixWorld.elements,cm=cached.m;
      for(let j=0;j<16;j++){
       if(Math.abs(m[j]-cm[j])>1e-5){dirty=true;break;}
      }
      if(dirty)break;
     }
    }
   }
   if(dirty){
    sm.needsUpdate=true;
    if(!this._shadowState){
     this._shadowState={
      sx:sun.position.x,sy:sun.position.y,sz:sun.position.z,si:sun.intensity,sc:sun.color.getHex(),
      items:items.map(it=>({v:it.visible,m:new Float32Array(it.matrixWorld.elements)}))
     };
    }else{
     const s=this._shadowState;
     s.sx=sun.position.x;s.sy=sun.position.y;s.sz=sun.position.z;s.si=sun.intensity;s.sc=sun.color.getHex();
     if(s.items.length!==items.length){
      s.items=items.map(it=>({v:it.visible,m:new Float32Array(it.matrixWorld.elements)}));
     }else{
      for(let i=0;i<items.length;i++){
       s.items[i].v=items[i].visible;
       s.items[i].m.set(items[i].matrixWorld.elements);
      }
     }
    }
   }
  }
  render(){this.checkShadowUpdate();this.stream.userData.renderScene(this.renderer,this.scene,this.camera);this.finalEdges.render(this.renderer);}
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
