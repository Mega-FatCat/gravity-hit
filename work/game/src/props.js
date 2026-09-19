import * as T from 'three';
import {normalizeLatheNormals,specularAntialiasing} from './edge-quality.js';
import {createBagFilmMaterial} from './weed-bag.js';

// ============================================================================
// HERO-PROP RUNTIME SOURCE-OF-TRUTH (GH-43 ARCHITECTURAL AUDIT)
// ============================================================================
// This module owns the FINAL RUNTIME REPRESENTATION for all three hero props:
//
// 1. BOTTLE (100% Procedural in props.js):
//    - Rebuilt by rebuildBottle().
//    - Assets 'bottle.glb' (from work/build_bottle.py) and initial lathe in
//      world.js:makeObjects() are COMPLETELY SUPERSEDED and discarded at runtime.
//    - Real runtime meshes:
//      * Shell: 96-segment lathe with 5-petal base, parting seams, crinkles,
//        PBR thinShellResponse shader + createPetNormalTexture().
//      * Label: 96-segment cylinder with 2048x512 canvas texture + normal map.
//      * Neck thread: TubeGeometry helical CatmullRom spiral.
//      * Cap: 64-segment knurled 28mm cap (createCapGeometry(false)).
//      * Outlet: Melted TorusGeometry lip + CircleGeometry outlet aperture.
//
// 2. PIPE (100% Procedural in props.js):
//    - Rebuilt by rebuildPipe().
//    - Assets 'pipe.glb' (from work/build_pipe.py) and initial lathe in
//      world.js:makeObjects() are COMPLETELY SUPERSEDED and discarded at runtime.
//    - Real runtime meshes:
//      * Glass: 96-segment slim chillum lathe + borosilicateResponse shader.
//      * Cap: 64-segment knurled cap with aperture (createCapGeometry(true)).
//      * Grommet: Rubber seal collar lathe geometry.
//      * Residue: Inner bore lathe with dynamic 2D canvas texture updated
//        per hit in world.heroProps.update(sim).
//      * Tip / Ember / Bud: Positioned anchors and procedural weed bud.
//
// 3. LIGHTER (Hybrid: GLB Chassis + Procedural Head in props.js):
//    - Upgraded by correctLighter().
//    - 'clipper.glb' (from work/build_hero.py) supplies ONLY the lower chassis:
//      ['Body', 'Base mould seam', 'Refill valve', 'Refill valve recess', 'Upper collar'].
//    - All upper mechanism parts in 'clipper.glb' (wheel, flint, shield, lever,
//      nozzle) are STRIPPED OUT and replaced with high-precision procedural meshes:
//      * Windscreen: Stainless steel curved hood + rolled tube rim + vent slots.
//      * Burner nozzle: Machined brass valve collar + orifice tip + steel bore.
//      * Flint stanchion: Polymer column + brass bushing + axle brackets + flint stick.
//      * Striker wheel (world.wheel): Fluted dark steel body + 24 knurled teeth.
//      * Gas lever: Ergonomic thumb rest pad with 3 grip ridges + forward fork arms.
//      * Wrap: 1024x1024 high-res canvas sticker graphic.
// ============================================================================

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function lathe(profile,segments=96,smooth=false){
 const points=smooth?new T.CatmullRomCurve3(profile.map(([r,y])=>V(r,y,0)),false,'centripetal').getPoints(profile.length*5).map(p=>new T.Vector2(Math.max(.0001,p.x),p.y)):profile.map(p=>new T.Vector2(...p));
 const first=profile[0],last=profile[profile.length-1];
 return normalizeLatheNormals(new T.LatheGeometry(points,segments),first[0]===last[0]&&first[1]===last[1]);
}
function add(parent,name,geometry,material,position=V()){
 const mesh=new T.Mesh(geometry,material);mesh.name=name;mesh.position.copy(position);parent.add(mesh);
 mesh.castShadow=false;mesh.receiveShadow=true;return mesh;
}
function removeTree(world,parent,keep){
 for(const child of [...parent.children])if(!keep.has(child)){
  const removed=new Set();child.traverse(o=>removed.add(o));world.interactive=world.interactive.filter(o=>!removed.has(o));parent.remove(child);
 }
}
function mark(world,parent,id){parent.traverse(o=>{o.userData.item=id;if(o.isMesh&&!world.interactive.includes(o))world.interactive.push(o);});}
function canvasTexture(width,height,draw){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;draw(canvas.getContext('2d'),width,height);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;return texture;
}
function thinShellResponse(material,face,edge){
 // Authentic thin PET plastic response: retains crystal transparency while
 // enhancing dielectric grazing reflections, moulded rib catch-lights, and
 // subtle plastic surface sheen without the dark refractive opacity of glass.
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
float shellGrazing=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.2);
diffuseColor.a=mix(${face.toFixed(3)},${edge.toFixed(3)},shellGrazing);
vec3 plasticSheen=vec3(.16,.21,.18)*pow(shellGrazing,1.8)*.42;
outgoingLight+=plasticSheen;
#include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`thin-shell-pet-${face}-${edge}`;
 specularAntialiasing(material);
}
function borosilicateResponse(material){
 // Keep the broad face optically clear while giving the very thin wall a
 // restrained grazing-angle highlight and crisp fire-polished rim catch-lights.
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
float pipeGrazing=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),1.8);
float pipeLuma=dot(outgoingLight,vec3(.2126,.7152,.0722));
vec3 pipeEdgeTone=vec3(mix(.84,.30,smoothstep(.35,.65,pipeLuma)));
vec3 borosilicateTint=vec3(.94,.98,.96);
outgoingLight=mix(outgoingLight*borosilicateTint,pipeEdgeTone,pipeGrazing*.12);
outgoingLight+=vec3(.14,.18,.16)*pow(pipeGrazing,2.4)*.50;
#include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`borosilicate-edge-v6`;
 specularAntialiasing(material);
}

let lastDrawnResidue=-1;
function updatePipeResidueTexture(canvas,ctx,texture,residue){
 if(Math.abs(lastDrawnResidue-residue)<0.002)return;
 lastDrawnResidue=residue;
 const width=canvas.width,height=canvas.height;
 const imgData=ctx.createImageData(width,height);
 const data=imgData.data;

 let seed=4219;
 function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}

 const droplets=[];
 for(let i=0;i<80;i++){
  droplets.push({theta:rnd()*Math.PI*2,v:0.30+rnd()*0.65,radius:0.016+rnd()*0.038,strength:0.6+rnd()*0.4});
 }

 if(residue>0.003){
  for(let y=0;y<height;y++){
   const v=y/(height-1);
   let baseAffinity=0,sootBase=0;
   if(v<0.36){
    const rim=Math.max(0,1-v/0.07);
    baseAffinity=0.74+0.16*Math.sin(v*14.0)+rim*0.18;
    sootBase=0.65+0.35*Math.max(0,1-v/0.36)+rim*0.25;
   }else if(v<0.54){
    const pinchDist=Math.abs(v-0.46)/0.08;
    baseAffinity=0.88+0.12*Math.max(0,1-pinchDist);
    sootBase=0.45*Math.max(0,1-pinchDist);
   }else{
    const stemT=(v-0.54)/0.46;
    baseAffinity=0.68*Math.pow(Math.max(0,1-stemT*0.72),1.2)+0.12;
    sootBase=0.05*Math.max(0,1-stemT*3.0);
   }
   for(let x=0;x<width;x++){
    const u=x/width,theta=u*Math.PI*2;
    const c=Math.cos(theta),s=Math.sin(theta);
    const w1=Math.sin(theta*3.0+1.2+Math.sin(v*5.0)*0.5);
    const w2=Math.sin(theta*6.0-0.8+Math.cos(v*7.0)*0.6);
    const w3=Math.cos(theta*10.0+2.4+Math.sin(v*11.0)*0.4);
    const flowStreaks=0.5+0.25*w1+0.15*w2+0.10*w3;
    const fine1=Math.sin(theta*24.0+Math.sin(v*28.0)*0.7+c*2.0);
    const fine2=Math.cos(theta*36.0+Math.cos(v*40.0)*0.5+s*2.0);
    const fineStreaks=0.5+0.30*fine1+0.20*fine2;
    let dropAcc=0;
    for(let k=0;k<droplets.length;k++){
     const dp=droplets[k];
     let dTheta=Math.abs(theta-dp.theta);
     if(dTheta>Math.PI)dTheta=Math.PI*2-dTheta;
     const dv=(v-dp.v)*2.2;
     const d=Math.sqrt((dTheta*0.7)*(dTheta*0.7)+dv*dv)/dp.radius;
     if(d<1.0){const w=1.0-d*d;dropAcc+=w*w*dp.strength;}
    }
    dropAcc=Math.min(1.0,dropAcc);
    const ashGrain=(Math.sin(c*65.0+v*120.0)*Math.cos(s*75.0-v*95.0)+1.0)*0.5;
    const soot=Math.min(1.0,sootBase*(0.75+0.25*ashGrain));
    let affinity=baseAffinity*(0.58+0.42*flowStreaks);
    affinity=Math.min(1.0,affinity+dropAcc*0.38);
    const localAffinity=affinity*0.62+dropAcc*0.26+fineStreaks*0.12;
    const onset=(1.0-localAffinity)*0.40;
    const deposit=Math.min(1.0,Math.max(0,(residue-onset)/(1.0-onset*0.6)));
    const smoothDeposit=deposit*deposit*(3-2*deposit);
    const thickness=smoothDeposit*(localAffinity*0.60+0.40)*Math.min(1.0,Math.pow(residue,0.88)*1.15);
    if(thickness>0.004){
     let rCol,gCol,bCol;
     if(thickness<0.26){
      const t=thickness/0.26;
      rCol=192*(1-t)+156*t;gCol=128*(1-t)+88*t;bCol=46*(1-t)+24*t;
     }else if(thickness<0.60){
      const t=(thickness-0.26)/0.34;
      rCol=156*(1-t)+96*t;gCol=88*(1-t)+42*t;bCol=24*(1-t)+12*t;
     }else if(thickness<0.84){
      const t=(thickness-0.60)/0.24;
      rCol=96*(1-t)+42*t;gCol=42*(1-t)+18*t;bCol=12*(1-t)+8*t;
     }else{
      const t=Math.min(1.0,(thickness-0.84)/0.16);
      rCol=42*(1-t)+16*t;gCol=18*(1-t)+8*t;bCol=8*(1-t)+5*t;
     }
     const sootFactor=soot*Math.min(1.0,Math.max(0,(residue-0.30)/0.60))*Math.min(1.0,Math.max(0,(thickness-0.18)/0.52));
     rCol=rCol*(1-sootFactor*0.90)+8*(sootFactor*0.90);
     gCol=gCol*(1-sootFactor*0.90)+7*(sootFactor*0.90);
     bCol=bCol*(1-sootFactor*0.90)+6*(sootFactor*0.90);
     let a;
     if(thickness<0.20){
      a=thickness*1.35;
     }else if(thickness<0.60){
      a=0.27+(thickness-0.20)/0.40*(0.62-0.27);
     }else{
      a=0.62+(thickness-0.60)/0.40*(0.88-0.62);
     }
     a=Math.min(0.92,a+sootFactor*0.14);
     const idx=(y*width+x)*4;
     data[idx]=Math.round(rCol);
     data[idx+1]=Math.round(gCol);
     data[idx+2]=Math.round(bCol);
     data[idx+3]=Math.round(a*255);
    }
   }
  }
 }
 ctx.putImageData(imgData,0,0);
 texture.needsUpdate=true;
}

function createPipeResidueTexture(world){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=1024;
 const ctx=canvas.getContext('2d');
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
 world.pipeResidueCanvas=canvas;world.pipeResidueCtx=ctx;world.pipeResidueTexture=texture;
 updatePipeResidueTexture(canvas,ctx,texture,0);
 return texture;
}

function rebuildPipe(world){
 const pipe=world.items.pipe,capMaterial=world.capmesh.material;
 const keep=new Set([world.hotTip,world.bowlBud,world.emberLight]);
 for(const part of pipe.children)if(part.material===capMaterial)keep.add(part);
 removeTree(world,pipe,keep);

 if(world.heroModels?.pipe){
  const glass=new T.MeshPhysicalMaterial({color:'#f4fbf7',roughness:.035,metalness:0,transmission:1,thickness:.0012,ior:1.474,transparent:false,opacity:1,depthWrite:false,side:T.DoubleSide,envMapIntensity:2.2,clearcoat:.85,clearcoatRoughness:.03});
  borosilicateResponse(glass);
  world.pipeMat=glass;
  const pipeGlassOrig=world.heroModels.pipe.getObjectByName('PipeGlass');
  const pipeGlass=pipeGlassOrig.clone();
  pipeGlass.name='Slim borosilicate one-hitter';
  pipeGlass.material=glass;
  pipeGlass.renderOrder=5;
  pipeGlass.castShadow=false;
  pipeGlass.receiveShadow=true;
  pipeGlass.position.y+=0.016;
  pipe.add(pipeGlass);
  world.pipeGlass=pipeGlass;

  const capDrilled=world.heroModels.pipe.getObjectByName('Cap_Drilled');
  if(capDrilled){
   world.capmesh.geometry.dispose();
   world.capmesh.geometry=capDrilled.geometry.clone();
   capMaterial.color.set('#1e5236');capMaterial.roughness=.36;capMaterial.metalness=.01;
  }

  const capCollar=world.heroModels.pipe.getObjectByName('CapCollar');
  if(capCollar){
   world.pipeGrommet=add(pipe,'Cap aperture seal',capCollar.geometry.clone(),new T.MeshStandardMaterial({color:'#262b27',roughness:.7}));
  }

  const pipeResidueOrig=world.heroModels.pipe.getObjectByName('PipeResidue');
  const residueTexture=createPipeResidueTexture(world);
  const residueMaterial=new T.MeshStandardMaterial({map:residueTexture,roughness:.38,metalness:.02,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide});
  const residue=pipeResidueOrig?pipeResidueOrig.clone():add(pipe,'Inner amber residue',lathe([[.00456,.0465],[.00425,.0454],[.00395,.0432],[.00355,.0397],[.00311,.0357],[.00286,.0317],[.00267,.0287],[.00266,.0238],[.00264,.0168],[.00264,.0000],[.00264,-.0150],[.00264,-.0325],[.00266,-.0425],[.00290,-.0484]],64),residueMaterial);
  residue.name='Inner amber residue';
  residue.material=residueMaterial;
  residue.renderOrder=4;
  residue.userData.pickable=false;
  residue.position.y+=0.016;
  if(pipeResidueOrig)pipe.add(residue);
  world.pipeResidue=residue;

  if(world.heroModels?.packedCharge){
   const pc=world.heroModels.packedCharge.getObjectByName('PackedCharge');
   if(pc){
    if(pc.isMesh){
     world.bowlBud.geometry.dispose();
     world.bowlBud.geometry=pc.geometry.clone();
     world.bowlBud.material=world.budMat;
     if(pc.morphTargetDictionary){
      world.bowlBud.morphTargetDictionary={...pc.morphTargetDictionary};
      world.bowlBud.morphTargetInfluences=pc.morphTargetInfluences?[...pc.morphTargetInfluences]:[0,0];
     }
    }else{
     world.bowlBud.geometry.dispose();
     world.bowlBud.geometry=new T.BufferGeometry();
     while(world.bowlBud.children.length)world.bowlBud.remove(world.bowlBud.children[0]);
     const pcClone=pc.clone();
     pcClone.traverse(child=>{
      if(child.isMesh){
       child.material=world.budMat;
       child.castShadow=true;
       child.receiveShadow=true;
      }
     });
     world.bowlBud.add(pcClone);
     world.heroProps.packedCharge=pcClone;
    }
    world.bowlBud.scale.set(1.0,1.0,1.0);
   }
  }

  const scale=80.0/96.5;
  world.hotTip.geometry.dispose();
  world.hotTip.geometry=lathe([[.00315,-.004],[.00355,-.004],[.00355,.003],[.00315,.003]],48);
  world.hotTip.position.set(0,-0.049*scale+0.005+0.016,0);
  world.hotTip.userData.pickable=false;
  world.bowlBud.position.set(0,0.040*scale+0.016,0);
  world.bowlBud.userData.pickable=false;
  world.emberLight.position.set(0,0.042*scale+0.016,0);

  mark(world,pipe,'pipe');
  world.heroProps.pipe=world.pipeGlass;
  return;
 }

 // Slim straight one-hitter/downstem matching the supplied reference: the
 // narrow stem passes through the cap, the shallow flared bowl stays above it,
 // and the opposite end has only a small fire-polished mouthpiece lip. Keep
 // the profile explicit rather than relying on a scaled rod so the rim and
 // wall read correctly in close views.
 const profile=[
  // outer wall: short mouthpiece flare, straight narrow body, shallow bowl
  [.00345,-.0490],[.00388,-.0487],[.00405,-.0478],[.00405,-.0462],
  [.00366,-.0448],[.00334,-.0427],[.00334,-.0340],[.00335,-.0100],
  [.00336,.0150],[.00340,.0220],[.00356,.0250],[.00390,.0280],
  [.00435,.0320],[.00485,.0360],[.00525,.0400],[.00545,.0430],
  [.00546,.0450],[.00530,.0465],[.00505,.0475],
  // inner wall: visible rim, bowl cavity and continuous bore
  [.00466,.0470],[.00435,.0457],[.00405,.0435],[.00365,.0400],
  [.00320,.0360],[.00295,.0320],[.00275,.0290],[.00275,.0240],
  [.00272,.0170],[.00272,-.0100],[.00272,-.0330],[.00274,-.0430],
  [.00300,-.0490],[.00345,-.0490]
 ];
 const glass=new T.MeshPhysicalMaterial({color:'#f4fbf7',roughness:.035,metalness:0,transmission:1,thickness:.0012,ior:1.474,transparent:false,opacity:1,depthWrite:false,side:T.DoubleSide,envMapIntensity:2.2,clearcoat:.85,clearcoatRoughness:.03});
 borosilicateResponse(glass);
 world.pipeMat=glass;world.pipeGlass=add(pipe,'Slim borosilicate one-hitter',lathe(profile,96),glass);world.pipeGlass.position.y+=0.016;world.pipeGlass.renderOrder=5;
  // Authentic 28mm knurled water bottle cap geometry for pipe assembly
  world.capmesh.geometry.dispose();world.capmesh.geometry=createCapGeometry(true,64);
  capMaterial.color.set('#1e5236');capMaterial.roughness=.36;capMaterial.metalness=.01;
  world.pipeGrommet=add(pipe,'Cap aperture seal',lathe([[.00315,.005],[.00445,.005],[.00475,.006],[.00478,.007],[.00460,.008],[.00328,.008],[.00315,.005]],64,true),new T.MeshStandardMaterial({color:'#262b27',roughness:.7}));
  // Localized progressive residue along the entire interior bore (bowl rim to mouthpiece).
  const residueProfile=[
   [.00456,.0465],[.00425,.0454],[.00395,.0432],[.00355,.0397],
   [.00311,.0357],[.00286,.0317],[.00267,.0287],[.00266,.0238],
   [.00264,.0168],[.00264,.0000],[.00264,-.0150],[.00264,-.0325],
   [.00266,-.0425],[.00290,-.0484]
  ];
  const residueTexture=createPipeResidueTexture(world);
  const residueMaterial=new T.MeshStandardMaterial({map:residueTexture,roughness:.38,metalness:.02,transparent:true,opacity:1,depthWrite:false,side:T.DoubleSide});
  const residue=add(pipe,'Inner amber residue',lathe(residueProfile,64),residueMaterial);residue.position.y+=0.016;residue.renderOrder=4;residue.userData.pickable=false;
  world.pipeResidue=residue;
  world.hotTip.geometry.dispose();world.hotTip.geometry=lathe([[.00315,-.004],[.00355,-.004],[.00355,.003],[.00315,.003]],48);world.hotTip.position.set(0,-.044+0.016,0);world.hotTip.userData.pickable=false;
  world.bowlBud.position.set(0,.040+0.016,0);world.bowlBud.scale.set(1.0,1.0,1.0);world.bowlBud.userData.pickable=false;
  world.emberLight.position.set(0,.042+0.016,0);
  mark(world,pipe,'pipe');
  world.heroProps.pipe=world.pipeGlass;
 }

function createCapGeometry(hasAperture=false,segments=64){
 const profile=[
  hasAperture?[.00370,.0055]:[.0001,.0055],
  [.0028,.0057],
  [.0134,.0055],
  [.0152,.0042],
  [.01535,.0030],
  [.01535,-.0105], // knurled skirt down to tamper groove
  [.0146,-.0112],  // tamper break groove
  [.0150,-.0118],  // tamper band upper
  [.0150,-.0152],  // tamper band lower
  [.0142,-.0155],  // bottom lip turn
  [.0138,-.0135],  // inner tamper band wall
  [.0135,-.0090],  // inner skirt wall
  [.0135,.0035],   // inner ceiling corner
  hasAperture?[.00370,.0035]:[.0001,.0035]
 ];
 if(hasAperture)profile.splice(1,1);
 const geo=lathe(profile,segments);
 const pos=geo.attributes.position;
 for(let i=0;i<pos.count;i++){
  let x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
  const r=Math.hypot(x,z),a=Math.atan2(x,z);
  if(r>.0148&&y>-.0105&&y<.0038){
   const knurl=(Math.sin(a*48)>0?.00038:-.00014);
   const nr=r+knurl;x*=nr/r;z*=nr/r;
  }
  if(r>.0145&&y>-.0118&&y<-.0108){
   const bridge=Math.pow(Math.max(0,Math.cos(a*8)),12);
   const indent=(1-bridge)*-.00045;
   const nr=Math.max(.0140,r+indent);x*=nr/r;z*=nr/r;
  }
  pos.setXYZ(i,x,y,z);
 }
 geo.computeVertexNormals();
 return geo;
}

function createPetNormalTexture(){
 const w=1024,h=1024;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');
 const imgData=ctx.createImageData(w,h);
 const data=imgData.data;

 for(let y=0;y<h;y++){
  const v=y/(h-1);
  const drawLine=Math.sin(v*720.0)*0.035;
  const ribAccent=Math.sin(v*64.0)*0.030*(v>0.15&&v<0.70?1:0);

  for(let x=0;x<w;x++){
   const u=x/(w-1);
   let nx=0,ny=drawLine+ribAccent;

   // Parting lines at u = 0.25 and u = 0.75
   const du1=Math.abs(u-0.25),du2=Math.abs(u-0.75);
   const du=Math.min(du1,du2);
   if(du<0.0045){
    const sign=((u>0.25&&u<0.25+0.0045)||(u>0.75&&u<0.75+0.0045))?-1:1;
    nx+=Math.sin(du/0.0045*Math.PI)*sign*0.45;
   }

   // Thin membrane micro-crinkle waviness
   if(v>0.08&&v<0.88){
    const wave1=Math.sin(u*18.0+v*24.0);
    const wave2=Math.cos(u*32.0-v*38.0);
    const crinkle=(wave1*0.55+wave2*0.45)*0.045;
    nx+=crinkle;ny+=crinkle*0.6;
   }

   // Base mold gate ring (v < 0.05)
   if(v<0.05){
    const gateDist=Math.abs(v-0.025)/0.012;
    if(gateDist<1.0)ny+=Math.sin(gateDist*Math.PI)*0.25;
   }

   const nz=1.0;
   const len=Math.sqrt(nx*nx+ny*ny+nz*nz);
   const idx=(y*w+x)*4;
   data[idx]=Math.floor(((nx/len)*0.5+0.5)*255);
   data[idx+1]=Math.floor(((ny/len)*0.5+0.5)*255);
   data[idx+2]=Math.floor(((nz/len)*0.5+0.5)*255);
   data[idx+3]=255;
  }
 }
 ctx.putImageData(imgData,0,0);
 const texture=new T.CanvasTexture(canvas);
 texture.wrapS=T.RepeatWrapping;texture.wrapT=T.ClampToEdgeWrapping;
 texture.anisotropy=8;
 return texture;
}

function createLabelNormalTexture(){
 const w=1024,h=512;
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
 const ctx=canvas.getContext('2d');
 const imgData=ctx.createImageData(w,h);
 const data=imgData.data;

 for(let y=0;y<h;y++){
  const v=y/(h-1);
  const edgeTension=Math.exp(-(((v-0.06)/0.04)**2))+Math.exp(-(((v-0.94)/0.04)**2));
  const tensionRipple=Math.sin(v*120.0)*0.06*edgeTension;

  for(let x=0;x<w;x++){
   const u=x/(w-1);
   let nx=0,ny=tensionRipple;

   // Vertical glue overlap seam step at u = 0.0 / 1.0
   if(u<0.015){
    nx+=(1.0-u/0.015)*0.35;
   }else if(u>0.985){
    nx-=(u-0.985)/0.015*0.35;
   }

   const nz=1.0;
   const len=Math.sqrt(nx*nx+ny*ny+nz*nz);
   const idx=(y*w+x)*4;
   data[idx]=Math.floor(((nx/len)*0.5+0.5)*255);
   data[idx+1]=Math.floor(((ny/len)*0.5+0.5)*255);
   data[idx+2]=Math.floor(((nz/len)*0.5+0.5)*255);
   data[idx+3]=255;
  }
 }
 ctx.putImageData(imgData,0,0);
 const texture=new T.CanvasTexture(canvas);
 texture.wrapS=T.RepeatWrapping;texture.wrapT=T.ClampToEdgeWrapping;
 texture.anisotropy=8;
 return texture;
}

function bottleLabel(){return canvasTexture(2048,512,(c,w,h)=>{
 c.save();c.translate(w,h);c.scale(-1,-1);
 c.fillStyle='#e4e9dc';c.fillRect(0,0,w,h);
 // Top and bottom dark green brand border bars
 c.fillStyle='#1c442c';c.fillRect(0,0,w,12);c.fillRect(0,h-12,w,12);
 c.fillStyle='#43664d';c.fillRect(0,12,w,2);c.fillRect(0,h-14,w,2);

 // FRONT PANEL (centered at x = w * 0.50): main spring water branding
 const fx=w*0.50;
 // Expiration / Lot code dot-matrix imprint on upper margin
 c.fillStyle='#46584c';c.font='12px monospace';c.textAlign='left';
 c.fillText('BB 09/27 LOT 284A 11:47',fx-160,32);

 // Mountain range emblem
 c.strokeStyle='#6c8770';c.lineWidth=2.5;c.beginPath();
 c.moveTo(fx-150,120);c.lineTo(fx-60,42);c.lineTo(fx-25,82);c.lineTo(fx+18,30);c.lineTo(fx+108,120);c.stroke();
 c.strokeStyle='#98ab9a';c.lineWidth=1.5;c.beginPath();
 c.moveTo(fx-110,120);c.lineTo(fx-60,65);c.lineTo(fx-10,105);c.lineTo(fx+35,60);c.lineTo(fx+85,120);c.stroke();

 // Title typography
 c.fillStyle='#1d3e2a';c.textAlign='center';c.font='500 62px Georgia';
 c.fillText('STILLWATER',fx,186);
 c.font='600 19px Arial';c.fillStyle='#274c33';
 c.fillText('N A T U R A L   S P R I N G   W A T E R',fx,226);
 c.font='500 15px Arial';c.fillStyle='#47654f';
 c.fillText('BOTTLED AT THE SOURCE  ·  500 mL',fx,268);
 c.font='600 13px Arial';c.fillStyle='#47654f';
 c.fillText('100% RECYCLED PET  /  PLEASE RECYCLE',fx,306);

 // BACK PANEL LEFT (x = w * 0.16): mineral analysis table
 const mlx=w*0.16;
 c.fillStyle='#1d3e2a';c.textAlign='center';c.font='700 15px Arial';
 c.fillText('TYPICAL ANALYSIS (mg/L)',mlx,62);
 c.font='13px Arial';c.fillStyle='#2c4634';
 c.fillText('Ca²⁺: 26.4    Mg²⁺: 8.2    Na⁺: 5.6',mlx,96);
 c.fillText('K⁺: 1.2      HCO₃⁻: 112   pH: 7.3',mlx,124);
 c.font='12px Arial';c.fillStyle='#47654f';
 c.fillText('Source: Deep Aquifer Springs, Pine Hollow.',mlx,160);
 c.fillText('Naturally filtered through glacial gravel.',mlx,182);

 // BACK PANEL RIGHT (x = w * 0.84): Barcode and PET recycling emblem
 const brx=w*0.84;
 c.fillStyle='#ffffff';c.fillRect(brx-90,68,180,94);
 c.fillStyle='#162419';
 for(let i=0;i<44;i++){
  const lw=((i*7+5)%3===0)?3:1.4;
  c.fillRect(brx-80+i*3.65,76,lw,62);
 }
 c.font='12px monospace';c.textAlign='center';
 c.fillText('0  41800 29104  7',brx,152);

 // Recycling symbol
 c.strokeStyle='#2c4634';c.lineWidth=2;c.beginPath();
 c.arc(brx,220,16,0,Math.PI*2);c.stroke();
 c.fillStyle='#2c4634';c.font='700 13px Arial';c.fillText('1',brx,225);
 c.font='10px Arial';c.fillText('PET',brx,248);

 // Vertical glue overlap strip at label edges (wrapping around back)
 c.fillStyle='rgba(215,225,205,0.45)';c.fillRect(0,0,24,h);c.fillRect(w-24,0,24,h);
 c.strokeStyle='rgba(130,150,130,0.6)';c.lineWidth=1.5;
 c.beginPath();c.moveTo(24,0);c.lineTo(24,h);c.moveTo(w-24,0);c.lineTo(w-24,h);c.stroke();
 c.restore();
});}

function rebuildBottle(world){
 const bottle=world.items.bottle;
 removeTree(world,bottle,new Set([world.liquid.volume,world.bottleSmoke,world.spareCap,world.outlet]));

 if(world.heroModels?.bottle){
  const pet=new T.MeshPhysicalMaterial({
   color:'#f8fdfb',
   roughness:.08,
   metalness:0,
   transmission:.94,
   thickness:.00035,
   ior:1.57,
   transparent:true,
   opacity:.92,
   depthWrite:false,
   side:T.DoubleSide,
   envMapIntensity:1.15,
   clearcoat:1.0,
   clearcoatRoughness:.04,
   normalMap:createPetNormalTexture(),
   normalScale:new T.Vector2(.38,.38)
  });
  thinShellResponse(pet,.05,.96);
  world.petMat=pet;

  const intactOrig=world.heroModels.bottle.getObjectByName('BottleShell_Intact');
  const openOrig=world.heroModels.bottle.getObjectByName('BottleShell_Open');
  const labelOrig=world.heroModels.bottle.getObjectByName('BottleLabel');
  const threadOrig=world.heroModels.bottle.getObjectByName('NeckThread');
  const rimOrig=world.heroModels.bottle.getObjectByName('OutletRim');

  const intact=intactOrig?intactOrig.clone():null;
  const open=openOrig?openOrig.clone():null;
  const label=labelOrig?labelOrig.clone():null;
  const thread=threadOrig?threadOrig.clone():null;
  const rim=rimOrig?rimOrig.clone():null;

  if(intact){
   intact.name='BottleShell_Intact';
   intact.material=pet;
   intact.renderOrder=6;
   intact.castShadow=false;
   intact.receiveShadow=true;
   bottle.add(intact);
   world.bottleShellIntact=intact;
  }
  if(open){
   open.name='BottleShell_Open';
   open.material=pet;
   open.renderOrder=6;
   open.castShadow=false;
   open.receiveShadow=true;
   bottle.add(open);
   world.bottleShellOpen=open;
  }

  const isOutlet=!!(world.sim?.outlet);
  if(intact)intact.visible=!isOutlet;
  if(open)open.visible=isOutlet;

  if(label){
   label.name='BottleLabel';
   label.material=new T.MeshPhysicalMaterial({
    map:bottleLabel(),
    normalMap:createLabelNormalTexture(),
    roughness:.25,
    metalness:0,
    clearcoat:.70,
    clearcoatRoughness:.08,
    side:T.FrontSide
   });
   label.rotation.y=Math.PI*0.5;
   label.renderOrder=3;
   label.castShadow=false;
   label.receiveShadow=true;
   bottle.add(label);
   world.heroProps.bottleLabel=label;
  }

  if(world.heroModels?.bottleCavity){
   const cav=world.heroModels.bottleCavity.getObjectByName('BottleCavity');
   if(cav&&world.liquid?.setCavityGeometry)world.liquid.setCavityGeometry(cav.geometry);
  }
  if(world.heroContract?.samples&&world.liquid?.setSamples){
    world.liquid.setSamples(world.heroContract.samples);
   }

  if(thread){
   thread.name='NeckThread';
   thread.material=pet;
   thread.renderOrder=6;
   thread.castShadow=false;
   thread.receiveShadow=true;
   bottle.add(thread);
  }

  if(rim){
   rim.name='OutletRim';
   rim.material=new T.MeshPhysicalMaterial({color:'#3d2b18',roughness:.40,transmission:.12,opacity:.82,transparent:true,depthWrite:false,side:T.DoubleSide,clearcoat:.45});
   rim.renderOrder=7;
   rim.visible=isOutlet;
   rim.castShadow=false;
   rim.receiveShadow=true;
   bottle.add(rim);
   world.meltRim=rim;
  }

  if(world.heroModels?.spareCap){
   const sc=world.heroModels.spareCap.getObjectByName('Cap_Intact');
   if(sc){
    world.spareCap.geometry.dispose();
    world.spareCap.geometry=sc.geometry.clone();
    world.spareCap.material=new T.MeshPhysicalMaterial({color:'#1c4e33',roughness:.34,metalness:.01,clearcoat:.35,clearcoatRoughness:.18});
    world.spareCap.position.set(0,.226,0);
    world.spareCap.renderOrder=4;
   }
  }

  world.outlet.position.set(.0326,.032,0);
  world.outlet.visible=false;

  mark(world,bottle,'bottle');
  world.liquid.volume.userData.pickable=false;
  world.bottleSmoke.userData.pickable=false;
  world.heroProps.bottle=open||intact;
  return;
 }

 // Authentic disposable 500 mL thin PET spring water bottle profile:
 // Prominent molded corrugation ribs (hoop reinforcement), recessed label waist,
 // stepped shoulder dome flutes, 5-petal petaloid base, and standard 28mm PCO finish.
 const outer=[
  // 1. Push-up base dome & sprue gate center
  [.0005,.0070],
  [.0025,.0068],
  [.0060,.0055],
  [.0110,.0042],
  [.0170,.0022],
  [.0220,.0008],
  [.0255,.0002], // 5-petal contact foot ring (lowest standing point)
  [.0285,.0022],
  [.0308,.0075],
  [.0320,.0155], // heel sweep
  [.0324,.0235], // lower body
  [.0326,.0320], // outlet level (anchor matches x=.0326, y=.032, z=0)
  [.0326,.0365],

  // 2. Deep lower molded corrugation ribs (hoop reinforcement)
  [.0312,.0385],
  [.0298,.0405], // rib 1 deep groove
  [.0314,.0425],
  [.0326,.0445], // rib 1 crest
  [.0312,.0465],
  [.0298,.0485], // rib 2 deep groove
  [.0314,.0505],
  [.0326,.0525], // rib 2 crest
  [.0312,.0545],
  [.0300,.0565], // rib 3 groove
  [.0326,.0590], // lower label bumper

  // 3. Recessed label panel waist
  [.03205,.0605],
  [.03200,.0750],
  [.03185,.0895], // subtle waist center
  [.03200,.1040],
  [.03205,.1185],
  [.0326,.1205],  // upper label bumper

  // 4. Deep upper molded grip ribs (corrugations above label)
  [.0312,.1225],
  [.0297,.1245], // rib 4 deep groove
  [.0313,.1265],
  [.0326,.1285], // rib 4 crest
  [.0312,.1305],
  [.0296,.1325], // rib 5 deep groove
  [.0313,.1345],
  [.0326,.1365], // rib 5 crest
  [.0312,.1385],
  [.0297,.1405], // rib 6 deep groove
  [.0313,.1425],
  [.0325,.1445], // rib 6 crest
  [.0314,.1465],
  [.0302,.1485], // rib 7 groove
  [.0324,.1510], // shoulder start ring

  // 5. Shoulder dome with stepped ring bands
  [.0315,.1550],
  [.0295,.1590], // shoulder step 1 groove
  [.0308,.1610], // shoulder step 1 ridge
  [.0296,.1660],
  [.0270,.1710], // shoulder step 2 groove
  [.0284,.1730], // shoulder step 2 ridge
  [.0262,.1790],
  [.0232,.1860],
  [.0196,.1930],
  [.0158,.2000],
  [.0135,.2050], // neck base

  // 6. Standard 28mm PCO neck finish
  [.0134,.2068], // neck support collar underside
  [.0168,.2075], // support collar flange rim
  [.0168,.2090], // support collar flange top
  [.0134,.2096], // collar top land
  [.0134,.2105],
  [.0145,.2115], // tamper-evident locking bead crest
  [.0133,.2125],
  [.0132,.2140], // thread zone root
  [.0132,.2220],
  [.0131,.2245],
  [.0128,.2260], // outer mouth lip rim (y = 0.226)
  [.0118,.2260], // inner lip rim
  [.0118,.2050]  // inner neck bore
 ];

 const bodyOuter=outer.slice(0,-2);
 const bodyInner=bodyOuter.slice(0,-1).reverse().map(([r,y])=>{
  const thick=y>.205?.0010:.00025;
  return [Math.max(.0001,r-thick),y<.012?y+.0003:y];
 });
 const geometry=lathe([...bodyOuter,...bodyInner,[.0005,.0070]],96);
 const positions=geometry.attributes.position;

 for(let i=0;i<positions.count;i++){
  let x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
  const r=Math.hypot(x,z),a=Math.atan2(x,z);
  if(r>.004){
   // 5-petal petaloid base modulation at bottom
   const footT=Math.max(0,1.0-y/.024);
   const petal=Math.cos(a*5);
   const deltaR=petal*.0020*footT;
   if(y<.020)y+=Math.max(0,-petal)*.0060*footT;

   // Split-mold vertical parting seam (peaks along x = +/- r flanks)
   const seamT=Math.pow(Math.abs(Math.sin(a)),60);
   const seam=seamT*.00028*(y<.206?1:0);

   // Shoulder dome radial pinch flutes
   let flute=0;
   if(y>=.155&&y<=.198){
    const fluteT=Math.sin((y-.155)/(.198-.155)*Math.PI);
    flute=Math.pow(.5+.5*Math.cos(a*8),2.5)*.00042*fluteT;
   }

   // Subtle flexible plastic panel deformations (natural handling depressions)
   const dent1=Math.exp(-(((y-.105)/.025)**2))*Math.exp(-(((a-.80)/.55)**2))*-.00085;
   const dent2=Math.exp(-(((y-.138)/.022)**2))*Math.exp(-(((a+2.15)/.60)**2))*-.00065;

   // Thin membrane waviness / subtle crinkle
   const crinkle=Math.sin(a*6+y*185)*.000085*Math.sin(Math.min(1,y/.035)*Math.PI*(y<.16?1:Math.max(0,1-(y-.16)/.04)));

   const nr=r+deltaR+seam+flute+dent1+dent2+crinkle;
   x*=nr/r;z*=nr/r;
  }else if(r<.0030&&y<.010){
   // Central sprue gate injection mark nub
   y+=Math.max(0,1.0-r/.0030)*.0006;
  }
  positions.setXYZ(i,x,y,z);
 }
 geometry.computeVertexNormals();

 // High-grade thin PET PBR material: crystal-clear facing transmission, smooth
 // exterior film clearcoat, normal crinkles and extrusion striations, grazing dielectric Fresnel.
 const pet=new T.MeshPhysicalMaterial({
  color:'#f8fdfb',
  roughness:.08,
  metalness:0,
  transmission:.06,
  thickness:.00025,
  ior:1.57,
  transparent:true,
  opacity:.14,
  depthWrite:false,
  side:T.FrontSide,
  envMapIntensity:1.05,
  clearcoat:1.0,
  clearcoatRoughness:.04,
  normalMap:createPetNormalTexture(),
  normalScale:new T.Vector2(.38,.38)
 });
 thinShellResponse(pet,.05,.96);
 world.petMat=pet;
 const shell=add(bottle,'Thin moulded PET shell',geometry,pet);
 shell.renderOrder=6;

 // Polypropylene wrap label: fits the recessed panel with vertical glue seam and BOPP sheen
 const wrap=add(bottle,'Upright spring-water label',
  new T.CylinderGeometry(.03212,.03212,.0585,96,1,true),
  new T.MeshPhysicalMaterial({
   map:bottleLabel(),
   normalMap:createLabelNormalTexture(),
   roughness:.25,
   metalness:0,
   clearcoat:.70,
   clearcoatRoughness:.08,
   side:T.FrontSide
  }),
  V(0,.08925,0)
 );
 wrap.rotation.y=Math.PI; // Aligns front brand panel towards camera (+Z) and seam to back
 wrap.renderOrder=3;

 // Authentic helical neck screw thread between tamper bead and mouth rim
 const threadPoints=[];
 for(let i=0;i<=144;i++){
  const a=i/144*Math.PI*4.4;
  const tY=.2135+(i/144)*.0095;
  threadPoints.push(V(Math.sin(a)*.01348,tY,Math.cos(a)*.01348));
 }
 const neck=add(bottle,'Moulded neck thread',new T.TubeGeometry(new T.CatmullRomCurve3(threadPoints),144,.00045,8,false),pet);
 neck.renderOrder=6;

 // Believable 28mm plastic screw cap on unprepared bottle
 const capMaterial=new T.MeshPhysicalMaterial({color:'#1c4e33',roughness:.34,metalness:.01,clearcoat:.35,clearcoatRoughness:.18});
 world.spareCap.geometry.dispose();
 world.spareCap.geometry=createCapGeometry(false,64);
 world.spareCap.material=capMaterial;
 world.spareCap.position.set(0,.226,0);
 world.spareCap.renderOrder=4;

 // Heat-formed curled outlet puncture rim (charred melted PET)
 const rimMaterial=new T.MeshPhysicalMaterial({color:'#3d2b18',roughness:.40,transmission:.12,opacity:.82,transparent:true,depthWrite:false,side:T.DoubleSide,clearcoat:.45});
 world.meltRim=add(bottle,'Heat-formed outlet lip',new T.TorusGeometry(.00275,.00045,12,32),rimMaterial,V(.03265,.032,0));
 world.meltRim.rotation.y=Math.PI/2;
 world.meltRim.visible=false;
 world.meltRim.renderOrder=7;
 world.outlet.position.set(.0326,.032,0);
 world.outlet.rotation.y=Math.PI/2;
 world.outlet.renderOrder=7;

 mark(world,bottle,'bottle');
 world.liquid.volume.userData.pickable=false;
 world.bottleSmoke.userData.pickable=false;
 world.heroProps.bottle=shell;
 world.heroProps.bottleLabel=wrap;
}

function correctLighter(world){
 const lighter=world.items.lighter;
 const model=lighter.children.find(o=>o.isGroup&&o.getObjectByName('Body'));
 if(!model)return;

 const bodyRoll=Math.PI*.72;model.rotation.set(0,bodyRoll,0);model.updateMatrix();

 // Remove old misaligned meshes from imported model (handling sanitized names with underscores)
 const keepFromModel=new Set([
  'Body',
  'Base_mould_seam','Base mould seam',
  'Refill_valve','Refill valve',
  'Refill_valve_recess','Refill valve recess',
  'Upper_collar','Upper collar'
 ]);
 for(const child of [...model.children]){
  if(!keepFromModel.has(child.name)||child.name==='Clipper top assembly'||child.name==='Right-hand-facing printed wrap'){
   model.remove(child);
   child.traverse(o=>{
    const i=world.interactive.indexOf(o);
    if(i>=0)world.interactive.splice(i,1);
   });
  }
 }

 // Materials for authentic Clipper lighter head
 const polymerMat=new T.MeshStandardMaterial({color:'#141615',roughness:.35,metalness:.04});
 const steelMat=new T.MeshStandardMaterial({color:'#b8bdc0',roughness:.20,metalness:.96,envMapIntensity:1.5});
 const brassMat=new T.MeshStandardMaterial({color:'#caa046',roughness:.24,metalness:.88,envMapIntensity:1.4});
 const darkSteelMat=new T.MeshStandardMaterial({color:'#36393b',roughness:.40,metalness:.88});
 const flintMat=new T.MeshStandardMaterial({color:'#242526',roughness:.75,metalness:.15});

 // Top assembly group aligned to world view:
 // -X = Flame side (Windscreen Hood & Burner Nozzle) on screen-left
 // +X = Actuator side (Gas Lever Thumb Pad) on screen-right
 // Z  = Front-to-back axis (Wheel axle direction)
 // Y  = Vertical axis (upward from lighter collar at Y = 0.062)
 const topAssembly=new T.Group();
 topAssembly.name='Clipper top assembly';
 topAssembly.rotation.y=-bodyRoll; // Aligns top mechanism with the front view
 model.add(topAssembly);

 // 1. Burner Nozzle (machined brass valve seated inside the windscreen at -X)
 const nozzleGroup=new T.Group();nozzleGroup.name='Burner valve assembly';
 topAssembly.add(nozzleGroup);
 const nozzleX=-.0036;
 add(nozzleGroup,'Valve collar base',new T.CylinderGeometry(.0017,.0018,.0035,32),brassMat,V(nozzleX,.0638,0));
 add(nozzleGroup,'Valve actuator collar',new T.CylinderGeometry(.0021,.0021,.0010,32),brassMat,V(nozzleX,.0655,0));
 add(nozzleGroup,'Burner nozzle tube',new T.CylinderGeometry(.00115,.00125,.0065,32),brassMat,V(nozzleX,.0692,0));
 const nozzleTip=add(nozzleGroup,'Burner nozzle orifice',new T.CylinderGeometry(.0013,.00115,.0015,32),brassMat,V(nozzleX,.0725,0));
 add(nozzleGroup,'Burner orifice bore',new T.CylinderGeometry(.00065,.00065,.0012,16),darkSteelMat,V(nozzleX,.0728,0));

 // 2. Stainless Steel Windscreen Hood (classic Clipper guard with vent ports)
 const shieldGroup=new T.Group();shieldGroup.name='Windscreen hood assembly';
 topAssembly.add(shieldGroup);
 // The hood encloses the left (-X) half around the burner nozzle
 const hoodArc=Math.PI*.92;
 const hoodStart=Math.PI*1.5-hoodArc*.5;
 const hoodGeo=new T.CylinderGeometry(.0078,.0079,.0135,48,1,true,hoodStart,hoodArc);
 const hoodMesh=add(shieldGroup,'Steel windscreen guard',hoodGeo,steelMat,V(0,.06925,0));
 hoodMesh.material.side=T.DoubleSide;
 // Rolled fire-guard rim along top edge of windscreen
 const rimPoints=[];
 for(let i=0;i<=32;i++){
  const th=hoodStart+(i/32)*hoodArc;
  rimPoints.push(V(.0078*Math.sin(th),.0760,.0078*Math.cos(th)));
 }
 add(shieldGroup,'Windscreen rolled rim',new T.TubeGeometry(new T.CatmullRomCurve3(rimPoints),32,.00035,8,false),steelMat);
 // Ventilation slots on front and back flanks of the hood
 const ventGeo=new T.BoxGeometry(.0018,.0026,.0002);
 const thFront=Math.PI*1.5+.55;
 const ventFront=add(shieldGroup,'Vent slot front',ventGeo,darkSteelMat,V(.00785*Math.sin(thFront),.0688,.00785*Math.cos(thFront)));
 ventFront.rotation.y=-(thFront-Math.PI*.5);
 const thBack=Math.PI*1.5-.55;
 const ventBack=add(shieldGroup,'Vent slot back',ventGeo,darkSteelMat,V(.00785*Math.sin(thBack),.0688,.00785*Math.cos(thBack)));
 ventBack.rotation.y=-(thBack-Math.PI*.5);

 // 3. Flint Barrel & Stanchion Assembly (Clipper removable flint stanchion)
 const flintX=.0006;
 const barrelGroup=new T.Group();barrelGroup.name='Flint stanchion assembly';
 topAssembly.add(barrelGroup);
 add(barrelGroup,'Flint barrel column',new T.CylinderGeometry(.0023,.0025,.0088,32),polymerMat,V(flintX,.0665,0));
 add(barrelGroup,'Flint guide bushing',new T.CylinderGeometry(.0016,.0016,.0014,24),brassMat,V(flintX,.0712,0));
 // Vertical axle brackets (stanchion ears) holding the wheel axle along Z
 add(barrelGroup,'Front stanchion ear',new T.BoxGeometry(.0036,.0074,.00075),polymerMat,V(flintX,.0745,.0026));
 add(barrelGroup,'Back stanchion ear',new T.BoxGeometry(.0036,.0074,.00075),polymerMat,V(flintX,.0745,-.0026));
 // Axle pin passing horizontally along Z through both stanchions and wheel center
 const axleGeo=new T.CylinderGeometry(.00075,.00075,.0074,20);
 axleGeo.rotateX(Math.PI*.5);
 add(barrelGroup,'Striker wheel axle pin',axleGeo,steelMat,V(flintX,.0755,0));
 const rivetGeo=new T.CylinderGeometry(.0011,.0011,.0004,16);
 rivetGeo.rotateX(Math.PI*.5);
 add(barrelGroup,'Axle rivet head front',rivetGeo,steelMat,V(flintX,.0755,.0037));
 add(barrelGroup,'Axle rivet head back',rivetGeo,steelMat,V(flintX,.0755,-.0037));
 // Spring-loaded flint stick emerging from tube and pressing against bottom of striker wheel
 add(barrelGroup,'Spring-loaded flint stick',new T.CylinderGeometry(.0010,.0010,.0022,16),flintMat,V(flintX,.0722,0));

 // 4. Striker Wheel & Knurled Teeth (rotates around Z-axle)
 // Mount in axle frame so rotor.rotation.x rotates around the physical axle
 const wheelMount=new T.Group();
 wheelMount.name='Flint wheel axle frame';
 wheelMount.position.set(flintX,.0755,0);
 wheelMount.rotation.y=Math.PI*.5; // Maps rotor.rotation.x to the Z axle
 topAssembly.add(wheelMount);

 const rotor=new T.Group();
 rotor.name='Flint wheel and teeth rotor';
 wheelMount.add(rotor);

 const wheelGeo=new T.CylinderGeometry(.0034,.0034,.0040,32);
 wheelGeo.rotateZ(Math.PI*.5);
 add(rotor,'Fluted striker wheel body',wheelGeo,darkSteelMat);
 for(let i=0;i<24;i++){
  const a=i/24*Math.PI*2;
  const y=Math.cos(a)*.0034;
  const z=Math.sin(a)*.0034;
  const toothGeo=new T.BoxGeometry(.0040,.00030,.00044);
  toothGeo.rotateX(a);
  add(rotor,`Knurled tooth ${i}`,toothGeo,steelMat,V(0,y,z));
 }
 world.wheel=rotor;

 // 5. Gas Lever (actuator rocker with ergonomic thumb pad and forward fork)
 const leverGroup=new T.Group();leverGroup.name='Gas actuator lever';
 topAssembly.add(leverGroup);
 // Sloping thumb button pad at +X
 const thumbPadGeo=new T.BoxGeometry(.0052,.0020,.0062);
 thumbPadGeo.rotateZ(-.38);
 add(leverGroup,'Thumb rest push pad',thumbPadGeo,polymerMat,V(.0054,.0684,0));
 // Grip ridges across the thumb pad
 for(let r=0;r<3;r++){
  const ridgeGeo=new T.BoxGeometry(.00028,.00038,.0056);
  ridgeGeo.rotateZ(-.38);
  add(leverGroup,`Thumb pad grip ridge ${r}`,ridgeGeo,polymerMat,V(.0044+r*.0010,.0696-r*.0009,0));
 }
 // Lever column down to body deck
 add(leverGroup,'Lever base pivot column',new T.BoxGeometry(.0040,.0060,.0056),polymerMat,V(.0054,.0645,0));
 // Dual forward fork arms straddling flint barrel and engaging burner valve
 const forkArmGeo=new T.BoxGeometry(.0068,.0015,.0011);
 add(leverGroup,'Actuator fork arm front',forkArmGeo,polymerMat,V(-.0002,.0645,.0028));
 add(leverGroup,'Actuator fork arm back',forkArmGeo,polymerMat,V(-.0002,.0645,-.0028));

 // Printed graphic wrap
 const texture=canvasTexture(1024,1024,(c,w,h)=>{
  c.fillStyle='#111312';c.fillRect(0,0,w,h);
  // FRONT PANEL: centered at x = w * 0.25 (facing camera in standard held/front view)
  const fx=w*0.25;
  c.fillStyle='#edf0e9';c.textAlign='center';c.font='700 36px Arial';c.fillText('CLIPPER',fx,130);
  c.strokeStyle='#b5bcb4';c.lineWidth=2;c.beginPath();c.moveTo(fx-75,158);c.lineTo(fx+75,158);c.stroke();
  c.fillStyle='#f4f4ee';c.font='800 80px Arial';c.fillText('HIGH',fx,355);c.font='700 54px Arial';c.fillText('AS',fx,475);c.font='800 80px Arial';c.fillText('FUCK',fx,610);
  c.fillStyle='#d4dbd0';c.font='60px Georgia';c.fillText('✦',fx,775);c.font='16px Arial';c.fillText('REFILL. REUSE. REPEAT.',fx,910);

  // BACK PANEL: centered at x = w * 0.75 (authentic technical markings, barcode & safety info)
  const bx=w*0.75;
  c.fillStyle='#edf0e9';c.textAlign='center';c.font='700 24px Arial';c.fillText('CLIPPER',bx,160);
  c.fillStyle='#ffffff';c.fillRect(bx-70,220,140,80);
  c.fillStyle='#162419';
  for(let i=0;i<32;i++){
   const lw=((i*5+3)%3===0)?3:1.4;
   c.fillRect(bx-60+i*3.8,228,lw,52);
  }
  c.font='10px monospace';c.textAlign='center';c.fillText('8 412765 001924',bx,292);
  c.fillStyle='#8e9890';c.font='600 13px Arial';c.fillText('ISO 9994 · MADE IN SPAIN',bx,340);
  c.fillText('KEEP AWAY FROM CHILDREN',bx,370);
  c.font='12px Arial';c.fillText('FLAMMABLE GAS UNDER PRESSURE',bx,400);
  c.strokeStyle='#5a635c';c.lineWidth=1.5;c.strokeRect(bx-85,430,170,48);
  c.fillStyle='#d4dbd0';c.font='700 14px Arial';c.fillText('DO NOT PUNCTURE / INCINERATE',bx,460);
 });
 const sticker=add(model,'Right-hand-facing printed wrap',new T.CylinderGeometry(.00823,.00818,.054,96,1,true),new T.MeshStandardMaterial({map:texture,roughness:.47}),V(0,.031,0));sticker.rotation.y=-Math.PI/2-bodyRoll;

 model.traverse(o=>{
  if(o.isMesh){
   o.userData.item='lighter';
   if(!world.interactive.includes(o))world.interactive.push(o);
   if(o!==sticker){
    o.castShadow=true;o.receiveShadow=true;
    if(o.material?.metalness>.7){
     o.material=o.material.clone();
     o.material.envMapIntensity=1.35;
     o.material.roughness=Math.max(.22,o.material.roughness);
    }
   }
  }
 });

 // Connect flame system precisely to the new burner nozzle orifice
 model.updateMatrixWorld(true);
 topAssembly.updateMatrixWorld(true);
 const nozzleWorldPos=nozzleTip.getWorldPosition(new T.Vector3());
 world.nozzle=lighter.worldToLocal(nozzleWorldPos.clone());
 world.flameAnchor=world.nozzle.clone().add(V(0,.021,0));
 world.flame.position.copy(world.nozzle);
 world.flameCore.position.copy(world.nozzle);
 world.flameLight.position.copy(world.nozzle).add(V(0,.012,0));
 world.flame.userData.pickable=world.flameCore.userData.pickable=false;
 mark(world,model,'lighter');
 world.heroProps.lighter=model;
}

function upgradeHeroBag(world){
 if(!world.heroModels?.bag)return;
 const bag=world.items.bag;
 const bagFilm=world.heroModels.bag.getObjectByName('BagFilm');
 const zip1=world.heroModels.bag.getObjectByName('ZipRail_1');
 const zip2=world.heroModels.bag.getObjectByName('ZipRail_-1');
 if(!bagFilm)return;

 const weedBagGroup=bag.getObjectByName('weed-bag');
 if(!weedBagGroup)return;

 for(const child of [...weedBagGroup.children]){
  if(child.name==='bag-film'||child.name==='bag-seal'){
   weedBagGroup.remove(child);
   if(child.geometry)child.geometry.dispose();
  }
 }

 const filmMat=createBagFilmMaterial();
 const newFilm=bagFilm.clone();
 newFilm.name='bag-film';
 newFilm.material=filmMat;
 newFilm.renderOrder=4;
 newFilm.castShadow=false;
 newFilm.receiveShadow=false;
 weedBagGroup.add(newFilm);
 world.bagFilm=newFilm;

 world.zipRails=[];
 for(const z of [zip1,zip2]){
  if(z){
   const r=z.clone();
   r.material=filmMat;
   r.renderOrder=4;
   weedBagGroup.add(r);
   world.zipRails.push(r);
  }
 }
 mark(world,bag,'bag');
}

export function upgradeHeroProps(world){
 world.heroProps={};
 rebuildPipe(world);
 rebuildBottle(world);
 correctLighter(world);
 upgradeHeroBag(world);

 world.bottleSmoke.material.uniforms.uWaterPlane.value=world.liquid.localWaterPlane;
 const scale = world.heroModels?.pipe ? (80.0 / 96.5) : 1.0;
 world.heroAnchors={
  pipeTip:V(0,-.049*scale+0.016,0),
  bowl:V(0,.045*scale+0.016,0),
  budSeat:V(0,.040*scale+0.016,0),
  bottleMouth:V(0,.226,0),
  outlet:V(.0326,.032,0),
  nozzle:world.nozzle?world.nozzle.clone():V(0,0,0)
 };
 world.heroProps.update=sim=>{
  if(world.pipeGrommet)world.pipeGrommet.visible=sim.prep>0;
  if(world.pipeResidue){
   world.pipeResidue.visible=sim.residue>0.003;
   if(world.pipeResidue.visible&&world.pipeResidueCanvas){
    updatePipeResidueTexture(world.pipeResidueCanvas,world.pipeResidueCtx,world.pipeResidueTexture,sim.residue);
   }
  }
  if(world.pipeMat){
   world.pipeMat.color.setRGB(1-sim.residue*.04,1-sim.residue*.06,1-sim.residue*.09);
   world.pipeMat.roughness=.035+sim.residue*.025;
  }
  if(world.bottleShellIntact&&world.bottleShellOpen){
   world.bottleShellIntact.visible=!sim.outlet;
   world.bottleShellOpen.visible=!!sim.outlet;
  }
  if(world.meltRim){
   world.meltRim.visible=!!sim.outlet;
  }
  if(world.bagFilm?.morphTargetInfluences&&world.bagFilm?.morphTargetDictionary){
   const d=world.bagFilm.morphTargetDictionary;
   if('Open' in d){
    const openVal=(sim.mode==='pack')?1.0:0.0;
    world.bagFilm.morphTargetInfluences[d['Open']]=openVal;
    if(world.zipRails){
     for(const r of world.zipRails){
      if(r.morphTargetDictionary&&'Open' in r.morphTargetDictionary){
       r.morphTargetInfluences[r.morphTargetDictionary['Open']]=openVal;
      }
     }
    }
   }
   if('Empty' in d){
    world.bagFilm.morphTargetInfluences[d['Empty']]=sim.stock<=0?1.0:0.0;
   }
  }
  if(world.heroProps?.packedCharge){
   world.heroProps.packedCharge.traverse(child=>{
    if(child.morphTargetInfluences&&child.morphTargetDictionary){
     const d=child.morphTargetDictionary;
     if('Spent' in d){
      child.morphTargetInfluences[d['Spent']]=Math.max(0,1.0-sim.bud);
     }
    }
   });
  }
  if(world.bowlBud?.morphTargetInfluences&&world.bowlBud?.morphTargetDictionary){
   const d=world.bowlBud.morphTargetDictionary;
   if('Spent' in d){
    world.bowlBud.morphTargetInfluences[d['Spent']]=Math.max(0,1.0-sim.bud);
   }
  }
 };
}
