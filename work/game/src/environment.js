import * as T from 'three';
import {Water} from 'three/addons/objects/Water.js';

// Metres throughout: the near field gets real relief and the same creek profile
// drives the bed, wet margin, water outline, plant placement and collision height.
const W=-.065,TAU=Math.PI*2;
const smooth=T.MathUtils.smoothstep,lerp=T.MathUtils.lerp;
function random(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return(seed>>>0)/4294967296;};}
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967295;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),a=x-ix,b=y-iy,u=a*a*(3-2*a),v=b*b*(3-2*b);return lerp(lerp(hash(ix,iy),hash(ix+1,iy),u),lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
const gaussian=(x,z,cx,cz,r)=>Math.exp(-((x-cx)**2+(z-cz)**2)/(r*r));
export function creekX(z){return -1.65+Math.sin(z*.18)*.50+(noise(z*.31+4,8)-.5)*.31;}
export function creekWidth(z){return 1.23+(noise(z*.45+15,3)-.5)*.57+Math.sin(z*.28)*.20;}
export function forestBase(x,z){
 const r=Math.hypot(x,z-.8);
 // Uneven wooded slopes replace the circular ramp that made a ruler-straight
 // perimeter against the environment photograph. Keep the working area intact.
 const ridge=smooth(r,10,32)*(.22+noise(x*.048+23,z*.048-4)*.85);
 const grade=Math.pow(Math.max(0,r-6)*.075,1.40)*.38+ridge;
 const macro=(noise(x*.17+17,z*.17+6)-.5)*.46+(noise(x*.43-2,z*.43+3)-.5)*.17;
 const meso=(noise(x*1.65+12,z*1.65-7)-.5)*.087+(noise(x*4.8,z*4.8)-.5)*.034;
 const hummocks=gaussian(x,z,1.4,-1.0,1.15)*.18+gaussian(x,z,2.3,3.2,1.2)*.22+gaussian(x,z,-3.3,1.8,1.5)*.16;
 const clearing=1-smooth(r,1.1,3.0);
 return lerp(.04+macro+meso+grade+hummocks,.037+meso*.5,clearing*.65);
}
export function forestHeight(x,z){
 const half=creekWidth(z)*.5,d=Math.abs(x-creekX(z)),base=forestBase(x,z);
 const pebbles=(noise(x*15+8,z*15)-.5)*.018;
 if(d<half){const side=(x-creekX(z))/half,thalweg=(noise(z*.36+7,11)-.5)*.36,t=Math.abs((side-thalweg)/(side<thalweg?1+thalweg:1-thalweg)),depth=.12+noise(z*.63+20,4)*.10;
  // Alternating shallow gravel bars leave a deeper, wandering flow channel.
  const bar=gaussian(side,z*.32,Math.sin(z*.39)*.65,Math.round(z*.32/2.4)*2.4,.48)*.035;
  return W-depth*(1-t*t)+.012*Math.pow(Math.abs(side),8)+pebbles*(1-smooth(Math.abs(side),.7,1))+bar*(1-Math.abs(side));}
 const bank=1.05+noise(z*.6,14)*.6,t=smooth(d,half,half+bank);
 const eroded=(noise(x*5.2,z*5.2)-.5)*.045;
 return lerp(W+.012,Math.max(.018,base),t)+eroded*(1-t)*t*3;
}
function addMesh(world,geometry,material,name){const m=new T.Mesh(geometry,material);m.name=name;m.receiveShadow=true;world.scene.add(m);return m;}
function placeAllowed(x,z,height=.3,margin=.1){
 if(Math.abs(x-creekX(z))<creekWidth(z)*.5+margin)return false;
 if(Math.hypot(x,z-.83)<.95+Math.min(height,.9)*.42)return false;
 // A narrow view corridor preserves the work, while low growth stays close
 // beside the player's knees. The old 3.4 m sterile circle is gone.
 if(Math.abs(x)<.67+height*.20&&z>.05&&z<3.2)return false;
 if(Math.hypot(x,z-2.65)<.62+Math.min(height,.9)*.30)return false;
 return true;
}
function instances(world,geometry,material,placements,name,shadow=true){
 const batches=new Map(),d=new T.Object3D(),color=new T.Color();
 for(const p of placements){const key=`${Math.floor(p.x/8)},${Math.floor(p.z/8)}`;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(p);}
 for(const [key,list]of batches){const m=new T.InstancedMesh(geometry,material,list.length);m.name=`${name}:${key}`;m.castShadow=shadow&&list.some(p=>Math.hypot(p.x,p.z-.8)<20);m.receiveShadow=true;
  list.forEach((p,i)=>{d.position.set(p.x,p.y??forestHeight(p.x,p.z),p.z);d.rotation.set(p.rx||0,p.rot||0,p.rz||0);d.scale.set(p.sx??p.s??1,p.sy??p.s??1,p.sz??p.s??1);d.updateMatrix();m.setMatrixAt(i,d.matrix);const light=p.tint??1;color.setRGB(light,light*(p.green??1),light*(p.blue??1));m.setColorAt(i,color);});
  m.computeBoundingSphere();m.computeBoundingBox();world.scene.add(m);
 }
}
function scanMaterial(source,world,wind=0){const m=source.clone();m.color.setRGB(.92,.92,.92);m.roughness=.94;m.metalness=0;m.side=T.DoubleSide;m.transparent=false;m.depthWrite=true;m.envMapIntensity=.65;
 const isBark=/trunk|bark|stump|branches/.test(source.name);
 if(isBark){
  m.roughness=.96;m.metalness=0;m.envMapIntensity=1.15;m.normalScale?.set(1.4,1.4);
 }else{
  m.normalScale?.set(.55,.55);
 }
 const alphaKey=source.name.includes('pine_tree_01_twig')?'pine_tree_01':source.name.includes('fir_sapling_twigs')?'fir_sapling':source.name;
 // Fir needles are modeled opaque geometry, not cutout cards. Applying the
 // optional atlas mask to them removed most of the surviving LOD needles.
 if(alphaKey==='fir_sapling'){m.alphaMap=null;m.alphaTest=0;}
  else if(world.foliageAlphaTextures?.[alphaKey]){m.alphaMap=world.foliageAlphaTextures[alphaKey];m.alphaTest=.34;m.alphaToCoverage=true;}else if(m.alphaTest)m.alphaTest=.30;
 if(m.map)m.map.anisotropy=4;if(wind)world.addWind(m,wind);
 if(isBark){
  const compile=m.onBeforeCompile,cache=m.customProgramCacheKey();m.onBeforeCompile=shader=>{compile.call(m,shader);
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
    diffuseColor.rgb = pow(diffuseColor.rgb, vec3(0.86)) * vec3(1.22, 1.18, 1.12);
   `).replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    #if NUM_DIR_LIGHTS > 0
     vec3 sunDir = -directionalLights[0].direction;
     vec3 sunCol = directionalLights[0].color;
     float NdotL = dot(normal, sunDir);
     float barkWrap = smoothstep(-0.45, 0.45, NdotL);
     float normalUp = normal.y * 0.5 + 0.5;
     vec3 skyAmbient = vec3(0.20, 0.25, 0.22);
     vec3 groundBounce = vec3(0.22, 0.18, 0.13);
     vec3 forestAmbient = mix(groundBounce, skyAmbient, normalUp);
     float edgeCatch = pow(1.0 - max(dot(normal, geometryViewDir), 0.0), 3.0);
     float backScatter = pow(max(dot(geometryViewDir, sunDir), 0.0), 2.0);
     vec3 rimLight = vec3(0.14, 0.18, 0.16) * (edgeCatch * (0.3 + 0.7 * backScatter));
     reflectedLight.indirectDiffuse += diffuseColor.rgb * (forestAmbient * 0.48 + sunCol * (0.045 * barkWrap) + rimLight);
    #endif
   `);
  };m.customProgramCacheKey=()=>`${cache}:rough-bark-1`;
 }else if(m.alphaMap||alphaKey==='fir_sapling'){
  const compile=m.onBeforeCompile,cache=m.customProgramCacheKey();m.onBeforeCompile=shader=>{compile.call(m,shader);shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   #if NUM_DIR_LIGHTS > 0
    float leafForward = pow(max(dot(geometryViewDir, -directionalLights[0].direction), 0.0), 4.0);
    reflectedLight.indirectDiffuse += diffuseColor.rgb * directionalLights[0].color * (.025 + .14 * leafForward);
   #endif
  `);};m.customProgramCacheKey=()=>`${cache}:thin-leaf-1`;
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
  parts.forEach(part=>{part.geometry.translate(-center.x,-bounds.min.y,-center.z);part.geometry.computeBoundingBox();});return{parts,height,name:root.name};
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
 world.creekTextures={creekMap:{value:null},creekNormal:{value:null},creekRoughness:{value:null}};
 world.groundMat.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,world.creekTextures);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 creekSurface;\nvarying vec2 vCreekSurface;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCreekSurface = creekSurface;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vCreekSurface;\nuniform sampler2D creekMap;\nuniform sampler2D creekNormal;\nuniform sampler2D creekRoughness;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;','sampledDiffuseColor = mix(sampledDiffuseColor, texture2D(creekMap, vMapUv * 1.7), vCreekSurface.x);\ndiffuseColor *= sampledDiffuseColor;'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',T.ShaderChunk.normal_fragment_maps.replace('mapN.xy *= normalScale;','mapN = mix(mapN, texture2D(creekNormal, vNormalMapUv * 1.7).xyz * 2.0 - 1.0, vCreekSurface.x);\nmapN.xy *= normalScale;'));
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',T.ShaderChunk.roughnessmap_fragment.replace('roughnessFactor *= texelRoughness.g;','roughnessFactor *= mix(texelRoughness.g, texture2D(creekRoughness, vRoughnessMapUv * 1.7).g, vCreekSurface.x);\nroughnessFactor = mix(roughnessFactor, .44, vCreekSurface.y * .65);'));
 };
 world.groundMat.customProgramCacheKey=()=> 'continuous-creek-loam-1';
 world.rockMat=new T.MeshStandardMaterial({color:'#b6b5a3',roughness:.91});
 world.barkMat=new T.MeshStandardMaterial({color:'#aaa28b',roughness:.96});
 const axis=[];for(let x=-80;x< -14;x+=2)axis.push(x);for(let x=-14;x< -9;x+=.4)axis.push(x);for(let i=0;i<=240;i++)axis.push(-9+i*.075);for(let x=9.4;x<=14;x+=.4)axis.push(x);for(let x=16;x<=80;x+=2)axis.push(x);
 const n=axis.length,positions=[],uvs=[],colors=[],creekSurface=[],indices=[];
 for(let zi=0;zi<n;zi++)for(let xi=0;xi<n;xi++){
  const x=axis[xi],z=axis[zi],y=forestHeight(x,z),half=creekWidth(z)*.5,d=Math.abs(x-creekX(z)),edge=noise(x*3.3+8,z*3.3)*.21+noise(x*8,z*8)*.06;
  const wet=1-smooth(y+edge*.12,W-.025,W+.065),gravel=1-smooth(d+edge,half-.13,half+.44);
  creekSurface.push(gravel,wet);
  positions.push(x,y,z);uvs.push(x*.5,z*.5);
  // Vertex values are linear multipliers, not a second black soil material.
  const dist=Math.hypot(x,z-.8),canopy=smooth(dist,2.5,13),v=(.56+noise(x*.6,z*.6)*.32)*(1-canopy*.40);
  const distantShade=1-smooth(dist,22,60)*.42;const vD=v*distantShade;
  colors.push(vD*(1-wet*.27),vD*(1-wet*.32),vD*(1-wet*.39));
 }
 for(let z=0;z<n-1;z++)for(let x=0;x<n-1;x++){const a=z*n+x,b=a+1,c=a+n,d=c+1;indices.push(a,c,b,b,c,d);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setAttribute('creekSurface',new T.Float32BufferAttribute(creekSurface,2));geo.setIndex(indices);geo.computeVertexNormals();
 world.groundMesh=addMesh(world,geo,world.groundMat,'Forest loam • 7.5 cm near-field relief');world.groundMesh.castShadow=false;
 const stone=new T.IcosahedronGeometry(1,2),p=stone.attributes.position;
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),f=.94+noise(x*4+11,z*4+y)*.15;p.setXYZ(i,x*f,y*f,z*f);}stone.computeVertexNormals();
 world.slab=addMesh(world,stone,world.rockMat,'Ritual stone');world.slab.position.set(0,.06,.8);world.slab.scale.set(.80,.23,.58);world.slab.castShadow=true;
 world.bedMat=world.groundMat;
 const randomBed=random(25013),gravel=[];
 for(let i=0;i<2500;i++){const z=-13+randomBed()*25,half=creekWidth(z)*.5,x=creekX(z)+(randomBed()*2-1)*(half+.35),deposit=noise(x*3.9+14,z*2.1),side=Math.abs(x-creekX(z))/half;
  // Gravel gathers in uneven bars; quiet silt pockets remain stone-free.
  if(randomBed()>.10+smooth(deposit,.36,.72)*.82||side<.42&&deposit<.64)continue;
  const r=randomBed(),s=r<.84?.009+randomBed()*.029:r<.992?.036+randomBed()*.049:.095+randomBed()*.07;
  gravel.push({x,z,y:forestHeight(x,z)-s*.14,sx:s*(1+randomBed()*.75),sy:s*(.42+randomBed()*.25),sz:s,rot:randomBed()*TAU,rx:randomBed()*.35,tint:.47+randomBed()*.42,green:.92+randomBed()*.1,blue:.79+randomBed()*.15});
 }
 instances(world,stone,world.rockMat,gravel,'Embedded stream gravel',false);
 const waterGeo=new T.PlaneGeometry(1,72,10,600),wp=waterGeo.attributes.position;
 for(let i=0;i<wp.count;i++){const z=-wp.getY(i),x=creekX(z)+wp.getX(i)*creekWidth(z)*1.12;wp.setX(i,x);}waterGeo.computeVertexNormals();
 const normalData=new Uint8Array(256*256*4);for(let y=0;y<256;y++)for(let x=0;x<256;x++){const i=(y*256+x)*4;normalData[i]=128+Math.sin(x*.19+y*.065)*10+Math.sin(x*.43+y*.07)*6;normalData[i+1]=128+Math.cos(y*.23-x*.12)*9+Math.sin(y*.51)*5;normalData[i+2]=254;normalData[i+3]=255;}
 const normalTex=new T.DataTexture(normalData,256,256,T.RGBAFormat);normalTex.wrapS=normalTex.wrapT=T.RepeatWrapping;normalTex.magFilter=T.LinearFilter;normalTex.minFilter=T.LinearMipmapLinearFilter;normalTex.generateMipmaps=true;normalTex.needsUpdate=true;
 // The 512px mirror produced visible square reflection blocks at 1080p. A
 // 1024px target keeps the stream's natural reflection detail without adding
 // another post-process or blurring the scene.
 world.stream=new Water(waterGeo,{textureWidth:1024,textureHeight:1024,waterNormals:normalTex,sunDirection:world.sun.position.clone().normalize(),sunColor:0xd9c8a9,waterColor:0x172c21,alpha:.13,distortionScale:.025,fog:true});
 world.stream.rotation.x=-Math.PI/2;world.stream.position.y=W;world.stream.renderOrder=2;world.stream.name='stream';world.stream.material.transparent=true;world.stream.material.depthWrite=false;
 world.stream.material.uniforms.size.value=60;
 // Straight-alpha compositing must apply Fresnel only once. Water's opaque
 // shader already mixes by Fresnel; simply lowering alpha suppresses that
 // reflection a second time and leaves the creek looking like dry gray mud.
 world.stream.material.fragmentShader=world.stream.material.fragmentShader.replace('float rf0 = 0.3;','float rf0 = 0.02;').replace('vec3 outgoingLight = albedo;',`
  float coverage = alpha + reflectance * (1.0 - alpha);
  vec3 reflected = reflectionSample * (vec3(1.0) + specularLight);
  vec3 transmitted = (sunColor * diffuseLight * 0.3 + scatter) * getShadowMask();
  vec3 outgoingLight = (transmitted * alpha * (1.0 - reflectance) + reflected * reflectance) / max(coverage, 0.001);
 `).replace('gl_FragColor = vec4( outgoingLight, alpha );','gl_FragColor = vec4( outgoingLight, coverage );');
 world.scene.add(world.stream);world.interactive.push(world.stream);world.ripples=[];
 // Small woody litter has dimensional edges and casts local contact shadows.
 const twigs=[],twigGeo=new T.CylinderGeometry(.005,.008,1,5,1),r=random(1782);
 for(let i=0;i<210;i++){const x=(r()-.5)*17,z=(r()-.5)*18;if(!placeAllowed(x,z,.02,-.15))continue;twigs.push({x,z,y:forestHeight(x,z)+.009,sx:.6+r(),sy:.08+r()*.35,sz:.6+r(),rx:Math.PI*.5,rot:r()*TAU,tint:.55+r()*.4});}
 instances(world,twigGeo,world.barkMat,twigs,'Pine twig litter',false);
 // Stable forest lighting: the weather updater uses these same values.
 const hemi=world.scene.children.find(o=>o.isHemisphereLight);if(hemi){hemi.color.set('#b8c8d2');hemi.groundColor.set('#71664b');hemi.intensity=1.1;world.forestHemisphere=hemi;}
 world.sun.position.set(-12,26,-9);world.sun.color.set('#ffe8bc');world.sun.intensity=1.7;
 world.sun.shadow.camera.left=-28;world.sun.shadow.camera.right=28;world.sun.shadow.camera.top=28;world.sun.shadow.camera.bottom=-28;world.sun.shadow.camera.far=90;world.sun.shadow.camera.updateProjectionMatrix();world.sun.shadow.normalBias=.008;world.sun.shadow.bias=-.00005;
}

function plantModel(world,model,{name,seed,count,radius=17,height=[.2,.5],wind=.025,near=.9,shadow=true,cluster=1.8,maxTriangles=Infinity,belt=false,variantPattern=null,nearPatches=false,lodModel=null,lodDistance=6}){
 const randomPlant=random(seed),variants=plantVariants(model).filter(v=>(!variantPattern||variantPattern.test(v.name))&&v.parts.reduce((n,p)=>n+(p.geometry.index?.count??p.geometry.attributes.position.count)/3,0)<=maxTriangles),sets=variants.map(()=>[]),centers=[];
 if(!variants.length)throw new Error(`No plant variants for ${name}`);
 for(let i=0;i<72;i++){const a=randomPlant()*TAU,r=nearPatches?1.7+randomPlant()*5.0:belt?7+Math.sqrt(randomPlant())*(radius-7):i<42?1.4+Math.sqrt(randomPlant())*Math.min(radius-2,10):8+Math.sqrt(randomPlant())*(radius-8);centers.push([Math.cos(a)*r,Math.sin(a)*r+.8]);}
 for(let i=0;i<count;i++){const c=centers[i%centers.length],a=randomPlant()*TAU,r=Math.sqrt(randomPlant())*cluster,x=c[0]+Math.cos(a)*r,z=c[1]+Math.sin(a)*r,h=lerp(height[0],height[1],randomPlant());if(!placeAllowed(x,z,h,.04)||Math.hypot(x,z-2.65)<near)continue;
  const index=i%variants.length,s=h/Math.max(.04,variants[index].height);
  sets[index].push({x,z,y:forestHeight(x,z)-.007,sx:s*(.8+randomPlant()*.45),sy:s,sz:s*(.8+randomPlant()*.45),rot:randomPlant()*TAU,rx:(randomPlant()-.5)*.1,rz:(randomPlant()-.5)*.08,tint:.78+randomPlant()*.22,green:1,blue:.90+randomPlant()*.08});
 }
 const lods=new Map(lodModel?plantVariants(lodModel).map(v=>[v.name,v]):[]);
 variants.forEach((variant,i)=>{if(!sets[i].length)return;const lod=lods.get(variant.name),close=lod?sets[i].filter(p=>Math.hypot(p.x,p.z-2.65)<lodDistance):sets[i],far=lod?sets[i].filter(p=>Math.hypot(p.x,p.z-2.65)>=lodDistance):[];
  variant.parts.forEach(part=>{const material=scanMaterial(part.material,world,wind),low=lod?.parts.find(p=>p.material.name===part.material.name);if(close.length)instances(world,part.geometry,material,close,`${name} variant ${i+1}`,shadow);if(far.length)instances(world,low?.geometry??part.geometry,material,far,`${name} variant ${i+1} distant`,shadow);});
 });
 world.environmentCounts??={};world.environmentCounts[name]=sets.reduce((n,p)=>n+p.length,0);
}
export function plantFerns(world,model,lodModel){plantModel(world,model,{name:'Fern rosettes',seed:3511,count:1400,radius:36,height:[.18,.58],cluster:2.6,wind:.020,lodModel,lodDistance:5});}
export function plantShrubs(world,model){plantModel(world,model,{name:'Low woody heath',seed:9901,count:46,radius:22,height:[.08,.18],cluster:2,wind:.012});}
export function plantGrass(world,model,lodModel){
 // Tiny shoots and tall seed stems must not be enlarged to the same height as
 // leafy clumps. That earlier distribution made the forest look dead/scrubby.
 plantModel(world,model,{name:'Low woodland grasses',seed:81351,count:2300,radius:38,height:[.045,.14],cluster:2.4,wind:.016,shadow:false,variantPattern:/small|mid/,lodModel,lodDistance:2.8});
 plantModel(world,model,{name:'Leafy grass tussocks',seed:15382,count:1100,radius:16,height:[.09,.23],cluster:1.3,wind:.021,shadow:false,variantPattern:/large/,nearPatches:true,lodModel,lodDistance:3.8});
 plantModel(world,model,{name:'Scattered grass seedheads',seed:86311,count:260,radius:32,height:[.20,.37],cluster:2.8,wind:.024,shadow:false,variantPattern:/tall/});
}
function appendPineCard(positions,uvs,indices,center,axis,side,length,width){
 const base=positions.length/3;
 for(const [along,lateral,u,v]of [[-.48,-.5,.028,.410],[-.48,.5,.200,.410],[.52,-.5,.028,.025],[.52,.5,.200,.025]]){
  const p=center.clone().addScaledVector(axis,along*length).addScaledVector(side,lateral*width);positions.push(p.x,p.y,p.z);uvs.push(u,v);
 }
 indices.push(base,base+1,base+2,base+1,base+3,base+2);
}
function appendPineNeedle(positions,colors,indices,base,tip,width,depth,color){
 const axis=tip.clone().sub(base).normalize(),up=new T.Vector3(0,1,0),side=new T.Vector3().crossVectors(axis,up);
 if(side.lengthSq()<.001)side.crossVectors(axis,new T.Vector3(1,0,0));
 side.normalize();const other=new T.Vector3().crossVectors(axis,side).normalize(),at=positions.length/3;
 for(const [point,sx,sy]of [[base,1,1],[base,-1,-1],[base,1,-1],[base,-1,1],[tip,0,0]]){
  const p=point.clone().addScaledVector(side,sx*width).addScaledVector(other,sy*depth);positions.push(p.x,p.y,p.z);colors.push(color[0],color[1],color[2]);
 }
 indices.push(at,at+1,at+4,at+1,at+2,at+4,at+2,at+3,at+4,at+3,at,at+4,at+3,at+2,at+1,at+3,at+1,at);
}
function appendPineBranch(positions,colors,indices,start,end,radius,color){
 const axis=end.clone().sub(start).normalize(),up=new T.Vector3(0,1,0),side=new T.Vector3().crossVectors(axis,up);
 if(side.lengthSq()<.001)side.crossVectors(axis,new T.Vector3(1,0,0));
 side.normalize();const other=new T.Vector3().crossVectors(axis,side).normalize(),at=positions.length/3;
 for(const [point,scale]of [[start,1],[end,.56]])for(let i=0;i<4;i++){
  const a=i*Math.PI*.5,p=point.clone().addScaledVector(side,Math.cos(a)*radius*scale).addScaledVector(other,Math.sin(a)*radius*scale);positions.push(p.x,p.y,p.z);colors.push(color[0],color[1],color[2]);
 }
 for(let i=0;i<4;i++){const n=(i+1)%4,a=at+i,b=at+n,c=at+4+i,d=at+4+n;indices.push(a,b,c,b,d,c);}
}
function buildPineCanopy(source,height,{seed=91053,density=640,needlesPerCluster=5,branchCount=130,cardPlanes=2,distant=false}={}){
 // The source's true branch distribution remains the placement guide. The
 // decimated asset no longer dictates the visible canopy volume.
 const p=source.geometry.attributes.position,r=random(seed),cards={positions:[],uvs:[],indices:[]},volume={positions:[],colors:[],indices:[]},branches={positions:[],colors:[],indices:[]};
 const center=new T.Vector3(),radial=new T.Vector3(),axis=new T.Vector3(),side=new T.Vector3(),other=new T.Vector3(),plane=new T.Vector3(),up=new T.Vector3(0,1,0),base=new T.Vector3(),tip=new T.Vector3();
 const green=[[.28,.43,.21],[.36,.54,.27],[.45,.63,.33],[.24,.39,.20]],wood=[[.40,.29,.17],[.52,.37,.22],[.32,.23,.14]];
 const addCluster=(clusterCenter,clusterRadial,intensity=1,withBranch=false)=>{
  axis.copy(clusterRadial).multiplyScalar(.88+r()*.18).addScaledVector(up,.14+(r()-.5)*.24).normalize();
  side.crossVectors(axis,up);if(side.lengthSq()<.001)side.crossVectors(axis,new T.Vector3(1,0,0));side.normalize();
  const cardLength=height*(distant?.021+r()*.013:(.022+r()*.018)*intensity),cardWidth=cardLength*(.30+r()*.15);
  for(let q=0;q<cardPlanes;q++){plane.copy(side).applyAxisAngle(axis,r()*Math.PI+q*Math.PI*.5);appendPineCard(cards.positions,cards.uvs,cards.indices,clusterCenter,axis,plane,cardLength,cardWidth);}
  const needleCount=Math.max(2,Math.round((needlesPerCluster+(r()<.34?1:0))*intensity));
  for(let n=0;n<needleCount;n++){
   const az=(n/needleCount)*Math.PI*2+(r()-.5)*.55,cone=.18+r()*.18;other.crossVectors(axis,side).normalize();const needleDir=axis.clone().multiplyScalar(.76+r()*.28).addScaledVector(side,Math.cos(az)*cone).addScaledVector(other,Math.sin(az)*cone).normalize();
   base.copy(clusterCenter).addScaledVector(side,(r()-.5)*height*.008).addScaledVector(up,(r()-.5)*height*.006);tip.copy(base).addScaledVector(needleDir,height*(distant?.012+r()*.008:(.014+r()*.012)*intensity));
   const length=tip.distanceTo(base),c=green[Math.floor(r()*green.length)],width=length*(distant?.070:.092),needleDepth=width*(.65+r()*.35);appendPineNeedle(volume.positions,volume.colors,volume.indices,base,tip,width,needleDepth,c);
  }
  if(withBranch){
   const branchLength=height*(distant?.021+r()*.015:.032+r()*.030),branchStart=clusterCenter.clone().addScaledVector(clusterRadial,-branchLength),branchEnd=clusterCenter.clone().addScaledVector(up,(r()-.5)*height*.012);
   branchStart.y+=height*(r()-.5)*.012;appendPineBranch(branches.positions,branches.colors,branches.indices,branchStart,branchEnd,height*(distant?.0010+r()*.0007:.0014+r()*.0012),wood[Math.floor(r()*wood.length)]);
  }
 };
 for(let i=0;i<density;i++){
  let j=0;for(let tries=0;tries<18;tries++){j=Math.floor(r()*p.count);if(p.getY(j)>height*(distant?.34:.27)&&Math.hypot(p.getX(j),p.getZ(j))>height*.022)break;}
  center.fromBufferAttribute(p,j);radial.set(center.x,0,center.z);if(radial.lengthSq()<.001)radial.set(1,0,0);radial.normalize();
  const depth=height*(distant?.004:.008),clusterCenter=center.clone().addScaledVector(radial,(r()-.5)*depth).addScaledVector(up,((i%3)-1)*depth*.58);addCluster(clusterCenter,radial,1,i<branchCount);
 }
 if(!distant){
  // Fill the decimated source's largest gaps with irregular inner whorls. They
  // are sparse enough to preserve sky holes, but add real depth between the
  // scanned outer branches instead of another flat billboard layer.
  const rings=8,samples=13;
  for(let ring=0;ring<rings;ring++)for(let i=0;i<samples;i++){
   const u=ring/(rings-1),a=(i/samples)*TAU+ring*.73+(r()-.5)*.28,radius=height*(.045+(.19*(1-u)))*(0.88+r()*.20);
   center.set(Math.cos(a)*radius,height*(.29+u*.62)+(r()-.5)*height*.026,Math.sin(a)*radius);radial.set(Math.cos(a),0,Math.sin(a));addCluster(center,radial,.74,(ring+i)%4===0);
  }
 }
 const make=(data,colors=false)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));if(data.uvs)g.setAttribute('uv',new T.Float32BufferAttribute(data.uvs,2));if(colors)g.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));g.setIndex(data.indices);g.computeVertexNormals();return g;};
 return{cards:make(cards),needles:make(volume,true),branches:make(branches,true)};
}
function pineVolumeMaterial(){return new T.MeshStandardMaterial({color:'#ffffff',roughness:.92,metalness:0,side:T.DoubleSide,vertexColors:true,envMapIntensity:.35});}
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
   const isTrunk=src.material.name.includes('trunk')||src.material.name.includes('dead_branches');
   const isTwig=src.material.name.includes('twig'),label=distant?'Distant pine ':'Mature pine ';
   if(isTwig){
     const twigMat=scanMaterial(src.material,world,0);twigMat.color.setRGB(1.12,1.22,1.02);twigMat.roughness=.96;twigMat.alphaTest=.30;
     const tiers=distant?[{placements:canopyPlacements,seed:91053,density:60,needles:2,branches:20,planes:2,distant:true,label:'distant'}]:[
      {placements:nearCanopy,seed:91053,density:680,needles:5,branches:150,planes:2,label:'near'},
      {placements:midCanopy,seed:91091,density:340,needles:4,branches:96,planes:2,label:'mid'}
    ];
    for(const tier of tiers){
     if(!tier.placements.length)continue;
     const canopy=buildPineCanopy(src,height,{seed:tier.seed,density:tier.density,needlesPerCluster:tier.needles,branchCount:tier.branches,cardPlanes:tier.planes,distant:tier.distant});
     instances(world,canopy.cards,twigMat,tier.placements,`${label}${src.material.name} ${tier.label} needle detail`,!distant);
      instances(world,canopy.needles,pineVolumeMaterial(),tier.placements,`${label}${tier.label} 3D needle volume`,!distant);
     instances(world,canopy.branches,pineVolumeMaterial(),tier.placements,`${label}${tier.label} 3D branchlets`,!distant);
    }
    continue;
   }
   const g=src.geometry.clone();g.translate(0,-box.min.y,0);
   const m=scanMaterial(src.material,world,0);m.color.setRGB(1,1,1);
   instances(world,g,m,isTrunk?trunkPlacements:canopyPlacements,label+src.material.name,!distant);
  }
  world.environmentCounts??={};world.environmentCounts[distant?'Distant pines':'Mature pines']=canopyPlacements.length;
 }

export async function loadForestDetails(world,gl,texture){
  const floor=async()=>{const [map,normalMap,roughnessMap,displacementMap]=await Promise.all([texture('forrest_ground_01/diff.jpg',true,1),texture('forrest_ground_01/nor_gl.jpg',false,1),texture('forrest_ground_01/rough.jpg',false,1),texture('forrest_ground_01/disp.jpg',false,1)]);Object.assign(world.groundMat,{map,normalMap,roughnessMap,displacementMap,displacementScale:.014,displacementBias:-.007});world.groundMat.normalScale.set(.6,.6);world.groundMat.needsUpdate=true;};
  const bed=async()=>{const [map,normalMap,roughnessMap]=await Promise.all([texture('sandy_gravel/diff.jpg',true,1),texture('sandy_gravel/nor_gl.jpg',false,1),texture('sandy_gravel/rough.jpg',false,1)]);world.creekTextures.creekMap.value=map;world.creekTextures.creekNormal.value=normalMap;world.creekTextures.creekRoughness.value=roughnessMap;world.groundMat.needsUpdate=true;};
  const plant=async(id,options)=>{const [model,lod]=await Promise.all([gl.loadAsync(`./assets/${id}/${id}.gltf`),gl.loadAsync(`./assets/${id}_lod.glb`)]);plantModel(world,model.scene,{...options,lodModel:lod.scene,lodDistance:5.5});};
  const wood=async()=>{
   for(const [id,positions]of [
    ['tree_stump_01',[[2.3,-1.5,.8],[-3.6,2.8,.7],[4.7,4.0,1.2],[-5.0,-5.4,.9],[1.6,-7.8,1.2]]],
    ['dead_tree_trunk',[[1.8,-.95,.65],[4.2,3.8,.8],[-4.7,-3.9,.5]]],
    ['dry_branches_medium_01',[[.92,1.55,.30],[-.65,2.3,.27],[1.8,-.2,.5],[-2.8,.3,.5],[3.8,-2.9,.7],[-3.9,4.2,.6],[.7,-3.8,.4]]]
   ]){const model=(await gl.loadAsync(id==='dead_tree_trunk'?'./assets/dead_tree_trunk_lod.glb':`./assets/${id}/${id}.gltf`)).scene,sources=sourceMeshes(model),r=random(id.length*232);
    sources.forEach((src,i)=>{const g=groundedGeometry(src),m=scanMaterial(src.material,world),sz=g.boundingBox.getSize(new T.Vector3()),max=Math.max(sz.x,sz.z);const p=positions.filter((_,j)=>j%sources.length===i).map(([x,z,s])=>({x,z,s:s/Math.max(.1,max),rot:r()*TAU,y:forestHeight(x,z)-.018,tint:.86+r()*.14}));instances(world,g,m,p,id,true);});
   }
  };
  await Promise.all([...world.foliageAlphaReady,floor(),bed(),wood(),plant('shrub_02',{name:'Lance-leaf saplings',seed:31351,count:340,radius:34,height:[.58,1.65],cluster:3.3,near:2.1}),plant('shrub_03',{name:'Paired-leaf understory',seed:78011,count:720,radius:28,height:[.18,.55],cluster:2.7,wind:.019}),
   (async()=>{const [model,lod]=await Promise.all([gl.loadAsync('./assets/fir_sapling_lod.glb'),gl.loadAsync('./assets/fir_far_lod.glb')]);
    plantModel(world,model.scene,{name:'Young firs',seed:22281,count:120,radius:28,height:[1.2,3.4],cluster:3.0,near:2.8,wind:.009,lodModel:lod.scene,lodDistance:6.5});
    plantModel(world,model.scene,{name:'Wooded slope firs',seed:67812,count:190,radius:44,height:[2.6,6.5],cluster:3.0,belt:true,wind:.006,lodModel:lod.scene,lodDistance:9.5});
   })(),
   (async()=>{const model=await gl.loadAsync('./assets/pine_distant.glb');plantPines(world,model.scene,true);})()
  ]);
 }

export function updateEnvironment(world,dt,sim,settings){
  const storm=settings.weather==='rain',mist=settings.weather==='mist',morning=sim.upgraded;
  if(world.daylightDay!==sim.day){world.daylightDay=sim.day;world.sun.position.set(morning?12:-12,morning?18:26,morning?-7:-9);world.sun.color.set(morning?'#f4ecd9':'#ffe8bc');world.stream.material.uniforms.sunDirection.value.copy(world.sun.position).normalize();}
  world.scene.fog.color.set(storm?'#536052':mist?'#889784':morning?'#5b6f60':'#536657');
  world.forestSky.material.uniforms.horizon.value.copy(world.scene.fog.color);
  world.forestSky.material.uniforms.zenith.value.set(storm?'#687977':mist?'#a4b1a9':morning?'#a0bed2':'#8da8bc');
  world.scene.fog.near=storm?10:mist?5:20;world.scene.fog.far=storm?46:mist?36:64;
 world.sun.intensity=storm?.65:mist?1.05:morning?1.8:2.05;
 world.renderer.toneMappingExposure=storm?.87:.94;
 if(world.forestHemisphere)world.forestHemisphere.intensity=storm?.95:1.4;
 if(world.rain)world.rain.visible=storm;
 world.stream.material.uniforms.time.value+=dt*.28;
 world.stream.material.uniforms.distortionScale.value=.018+settings.wind*.02;
}
