import * as T from 'three';

const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function lathe(profile,segments=96,smooth=false){
 const points=smooth?new T.CatmullRomCurve3(profile.map(([r,y])=>V(r,y,0)),false,'centripetal').getPoints(profile.length*5).map(p=>new T.Vector2(Math.max(.0001,p.x),p.y)):profile.map(p=>new T.Vector2(...p));
 return new T.LatheGeometry(points,segments);
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
 // The ordinary transparent material scales even grazing reflections by one
 // uniform alpha, erasing thin clear objects against textured backgrounds.
 // Retain face transparency while allowing real surface normals to reveal
 // reflected rims, moulded ribs and the polished glass wall at grazing angles.
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
float shellGrazing=pow(1.-abs(dot(normal,normalize(vViewPosition))),2.4);
diffuseColor.a=mix(${face.toFixed(3)},${edge.toFixed(3)},shellGrazing);
#include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`thin-shell-${face}-${edge}`;
}
function borosilicateResponse(material){
 // Keep the broad face optically clear while giving the very thin wall a
 // restrained grazing-angle highlight. This is surface readability, not a
 // frosted alpha treatment, so the forest remains visible through the pipe.
 material.onBeforeCompile=shader=>{
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
float pipeGrazing=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),1.9);
float pipeLuma=dot(outgoingLight,vec3(.2126,.7152,.0722));
vec3 pipeEdgeTone=vec3(mix(.76,.24,smoothstep(.38,.62,pipeLuma)));
outgoingLight=mix(outgoingLight,pipeEdgeTone,pipeGrazing*.24);
#include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=>`borosilicate-edge-v4`;
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
 const glass=new T.MeshPhysicalMaterial({color:'#f4fbf7',roughness:.05,metalness:0,transmission:1,thickness:.0007,ior:1.474,transparent:false,opacity:1,depthWrite:false,side:T.DoubleSide,envMapIntensity:1.8,clearcoat:.45,clearcoatRoughness:.06});
 borosilicateResponse(glass);
 world.pipeMat=glass;world.pipeGlass=add(pipe,'Slim borosilicate one-hitter',lathe(profile,96),glass);world.pipeGlass.renderOrder=5;
 // Cap aperture sized down for the slimmer stem.
 world.capmesh.geometry.dispose();world.capmesh.geometry=lathe([[.00370,.006],[.0125,.006],[.0132,.005],[.0132,-.006],[.0128,-.007],[.0122,-.007],[.0122,.004],[.00370,.004],[.00370,.006]],80);
 capMaterial.color.set('#365546');capMaterial.roughness=.5;
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
 const residue=add(pipe,'Inner amber residue',lathe(residueProfile,64),residueMaterial);residue.renderOrder=4;residue.userData.pickable=false;
 world.pipeResidue=residue;
 world.hotTip.geometry.dispose();world.hotTip.geometry=lathe([[.00315,-.004],[.00355,-.004],[.00355,.003],[.00315,.003]],48);world.hotTip.position.set(0,-.044,0);world.hotTip.userData.pickable=false;
 world.bowlBud.position.set(0,.040,0);world.bowlBud.scale.set(1.0,.65,1.0);world.bowlBud.userData.pickable=false;
 world.emberLight.position.set(0,.042,0);
 mark(world,pipe,'pipe');
 world.heroProps.pipe=world.pipeGlass;
}

function bottleLabel(){return canvasTexture(1536,384,(c,w,h)=>{
 c.fillStyle='#e4e8d9';c.fillRect(0,0,w,h);
 c.fillStyle='#254937';c.fillRect(0,0,w,9);c.fillRect(0,h-9,w,9);
 for(const x of [w*.25,w*.75]){
  c.strokeStyle='#849784';c.lineWidth=2;c.beginPath();c.moveTo(x-165,112);c.lineTo(x-65,35);c.lineTo(x-28,74);c.lineTo(x+16,24);c.lineTo(x+112,112);c.stroke();
  c.fillStyle='#264535';c.textAlign='center';c.font='500 55px Georgia';c.fillText('STILLWATER',x,179);
  c.font='18px Arial';c.fillText('N A T U R A L   S P R I N G   W A T E R',x,219);
  c.fillStyle='#5b735e';c.font='15px Arial';c.fillText('BOTTLED AT THE SOURCE  ·  500 mL',x,263);
  c.font='13px Arial';c.fillText('100% RECYCLED PET  /  PLEASE RECYCLE',x,301);
  c.fillStyle='#293d2b';for(let i=0;i<40;i++)c.fillRect(x-69+i*3.45,322,(i%3)+.5,25);
 }
});}

function rebuildBottle(world){
 const bottle=world.items.bottle;
 removeTree(world,bottle,new Set([world.liquid.volume,world.bottleSmoke,world.spareCap,world.outlet]));
 const outer=[
  [.001,.009],[.011,.009],[.018,.006],[.025,.0028],[.029,.006],
  [.0318,.015],[.0325,.025],[.03255,.036],[.0318,.038],[.0315,.040],
  [.03245,.043],[.0325,.048],[.03165,.050],[.03155,.052],[.0323,.055],
  [.03225,.060],[.0322,.109],[.0323,.117],[.0313,.119],[.03115,.121],
  [.0323,.124],[.0324,.129],[.03115,.131],[.0311,.133],[.0323,.136],
  [.0322,.144],[.0313,.154],[.0294,.165],[.0258,.179],[.0200,.192],
  [.0141,.202],[.0133,.205],[.0151,.207],[.0151,.2085],[.0133,.210],
  [.01325,.222],[.0131,.225],[.0127,.226],[.0120,.226]
 ];
 const inner=outer.slice(0,-1).reverse().map(([r,y])=>[Math.max(.0001,r-.00032),y<.018?y+.0004:y]);
 const geometry=lathe([...outer,...inner,[.001,.009]],96);
 const positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++){
  let x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=Math.hypot(x,z);const a=Math.atan2(x,z);
  if(r>.005){
   const feet=Math.max(0,1-y/.022);const dent=Math.exp(-(((y-.151)/.03)**2))*Math.exp(-(((a-.65)/.42)**2))*-.00065;
   const seam=Math.pow(Math.abs(Math.cos(a)),90)*.000075;
   const ripple=Math.sin(a*6+y*210)*.000065*Math.sin(Math.min(1,y/.03)*Math.PI*.5);
   const nr=r+Math.cos(a*5)*.00125*feet+dent+seam+ripple;x*=nr/r;z*=nr/r;
   if(y<.014)y+=feet*(1-Math.cos(a*5))*.00055;
  }
  positions.setXYZ(i,x,y,z);
 }
 geometry.computeVertexNormals();
 // Clear PET uses a thin, lightly reflective shell. Strong rough transmission
 // blurred the complete background into a frosted laboratory-glass silhouette.
 const pet=new T.MeshPhysicalMaterial({color:'#f7fcfa',roughness:.115,metalness:0,transmission:.12,thickness:.00032,ior:1.57,transparent:true,opacity:.15,depthWrite:false,side:T.FrontSide,envMapIntensity:.85,clearcoat:.55,clearcoatRoughness:.14});
 thinShellResponse(pet,.15,.96);
 world.petMat=pet;const shell=add(bottle,'Thin moulded PET shell',geometry,pet);shell.renderOrder=6;
 const wrap=add(bottle,'Upright spring-water label',new T.CylinderGeometry(.03248,.03248,.049,96,1,true),new T.MeshStandardMaterial({map:bottleLabel(),roughness:.57,metalness:0,side:T.FrontSide}),V(0,.0845,0));wrap.rotation.y=Math.PI/2;wrap.renderOrder=3;
 // A shallow real helical neck thread, separate from the thin shell.
 const threadPoints=[];for(let i=0;i<=144;i++){const a=i/144*Math.PI*4.35;threadPoints.push(V(Math.sin(a)*.01343,.212+i/144*.010,Math.cos(a)*.01343));}
 const neck=add(bottle,'Moulded neck thread',new T.TubeGeometry(new T.CatmullRomCurve3(threadPoints),144,.00048,6,false),pet);neck.renderOrder=6;
 const rimMaterial=new T.MeshPhysicalMaterial({color:'#a6997a',roughness:.38,transparent:true,opacity:.62,depthWrite:false,side:T.DoubleSide});
 world.meltRim=add(bottle,'Heat-formed outlet lip',new T.TorusGeometry(.00275,.00043,10,32),rimMaterial,V(.03265,.032,0));world.meltRim.rotation.y=Math.PI/2;world.meltRim.visible=false;world.meltRim.renderOrder=7;
 world.outlet.position.set(.0326,.032,0);world.outlet.rotation.y=Math.PI/2;world.outlet.renderOrder=7;
 mark(world,bottle,'bottle');world.liquid.volume.userData.pickable=false;world.bottleSmoke.userData.pickable=false;
 world.heroProps.bottle=shell;world.heroProps.bottleLabel=wrap;
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
  const isOurWrap=child.name==='Right-hand-facing printed wrap';
  if(!isOurWrap&&(!keepFromModel.has(child.name)||child.name==='Clipper top assembly')){
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
  for(const x of [w*.25,w*.75]){
   c.fillStyle='#edf0e9';c.textAlign='center';c.font='700 39px Arial';c.fillText('CLIPPER',x,128);
   c.strokeStyle='#b5bcb4';c.lineWidth=2;c.beginPath();c.moveTo(x-100,160);c.lineTo(x+100,160);c.stroke();
   c.fillStyle='#f4f4ee';c.font='800 92px Arial';c.fillText('HIGH',x,360);c.font='700 61px Arial';c.fillText('AS',x,480);c.font='800 91px Arial';c.fillText('FUCK',x,618);
   c.fillStyle='#d4dbd0';c.font='70px Georgia';c.fillText('✦',x,785);c.font='18px Arial';c.fillText('REFILL. REUSE. REPEAT.',x,920);
  }
 });
 const sticker=add(model,'Right-hand-facing printed wrap',new T.CylinderGeometry(.00823,.00818,.054,96,1,true),new T.MeshStandardMaterial({map:texture,roughness:.47}),V(0,.031,0));sticker.rotation.y=Math.PI/2-bodyRoll;

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
 world.nozzle=model.worldToLocal(nozzleWorldPos.clone());
 world.flameAnchor=world.nozzle.clone().add(V(0,.021,0));
 world.flame.position.copy(world.nozzle);
 world.flameCore.position.copy(world.nozzle);
 world.flameLight.position.copy(world.nozzle).add(V(0,.012,0));
 world.flame.userData.pickable=world.flameCore.userData.pickable=false;
 mark(world,model,'lighter');
 world.heroProps.lighter=model;
}

export function upgradeHeroProps(world){
 world.heroProps={};rebuildPipe(world);rebuildBottle(world);correctLighter(world);
 world.bottleSmoke.material.uniforms.uWaterPlane.value=world.liquid.localWaterPlane;
 world.heroAnchors={pipeTip:V(0,-.049,0),bowl:V(0,.045,0),bottleMouth:V(0,.226,0),outlet:V(.0326,.032,0),nozzle:world.nozzle.clone()};
 world.heroProps.update=sim=>{
  world.pipeGrommet.visible=sim.prep>0;
  world.pipeResidue.visible=sim.residue>0.003;
  if(world.pipeResidue.visible&&world.pipeResidueCanvas){
   updatePipeResidueTexture(world.pipeResidueCanvas,world.pipeResidueCtx,world.pipeResidueTexture,sim.residue);
  }
  world.pipeMat.color.setRGB(1-sim.residue*.04,1-sim.residue*.06,1-sim.residue*.09);
  world.pipeMat.roughness=.05+sim.residue*.025;
 };
}
