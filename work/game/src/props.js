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
 // Localized residue on the interior, scaled to the new bore.
 const residueMaterial=new T.MeshStandardMaterial({color:'#462a10',roughness:.47,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide});
 const residue=add(pipe,'Inner amber residue',lathe([[.00282,-.034],[.00284,.015],[.00180,.021],[.00140,.023],[.00180,.026],[.00380,.030],[.00430,.034],[.00445,.037]],64),residueMaterial);residue.renderOrder=4;residue.userData.pickable=false;
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
 // The imported model's longitudinal axis is local +Y. Rotating that axis
 // places the striker/actuator on screen-right and burner to its left.
 const bodyRoll=Math.PI*.72;model.rotation.set(0,bodyRoll,0);model.updateMatrix();
 const wheel=model.getObjectByName('Striker wheel')||model.getObjectByName('Striker_wheel');
 const lever=model.getObjectByName('Gas lever');if(lever)lever.position.set(-.004,.070,.002);
 // All teeth rotate with the flint wheel about its real axle. The imported
 // teeth were independent meshes, so rotating the cylinder alone did nothing
 // visible. The inner rotor's local X matches the existing ignition animation.
 if(wheel){
  const spindle=new T.Group();spindle.name='Flint wheel axle frame';spindle.position.copy(wheel.position);spindle.rotation.y=Math.PI/2;model.add(spindle);
  const rotor=new T.Group();rotor.name='Flint wheel and teeth';spindle.add(rotor);model.updateWorldMatrix(true,true);
  const parts=[wheel,...model.children.filter(o=>o.name.startsWith('Wheel tooth'))];
  for(const part of parts)rotor.attach(part);
  world.wheel=rotor;
 }
 for(const child of [...model.children])if(child.name==='Label'||child.material?.map===world.lighterDesign){
  model.remove(child);world.interactive=world.interactive.filter(o=>o!==child);
 }
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
 model.traverse(o=>{if(o.isMesh&&o!==sticker){o.castShadow=true;o.receiveShadow=true;if(o.material?.metalness>.7){o.material=o.material.clone();o.material.envMapIntensity=1.35;o.material.roughness=Math.max(.28,o.material.roughness);}}});
 world.nozzle=V(.003,.071,-.002).applyAxisAngle(V(0,1,0),bodyRoll);
 world.flameAnchor=world.nozzle.clone().add(V(0,.021,0));
 world.flame.position.copy(world.nozzle);world.flameCore.position.copy(world.nozzle);world.flameLight.position.copy(world.nozzle).add(V(0,.012,0));
 world.flame.userData.pickable=world.flameCore.userData.pickable=false;
 mark(world,model,'lighter');world.heroProps.lighter=model;
}

export function upgradeHeroProps(world){
 world.heroProps={};rebuildPipe(world);rebuildBottle(world);correctLighter(world);
 world.bottleSmoke.material.uniforms.uWaterPlane.value=world.liquid.localWaterPlane;
 world.heroAnchors={pipeTip:V(0,-.049,0),bowl:V(0,.045,0),bottleMouth:V(0,.226,0),outlet:V(.0326,.032,0),nozzle:world.nozzle.clone()};
 world.heroProps.update=sim=>{
  world.pipeGrommet.visible=sim.prep>0;
  world.pipeResidue.material.opacity=Math.min(.72,sim.residue*.78);world.pipeResidue.visible=sim.residue>.005;
  world.pipeMat.color.setRGB(1-sim.residue*.08,1-sim.residue*.12,1-sim.residue*.17);world.pipeMat.roughness=.05+sim.residue*.065;
 };
}
