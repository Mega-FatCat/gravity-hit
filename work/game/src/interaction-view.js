import * as T from 'three';
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const q=(x=0,y=0,z=0)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));

// A pose transition is interpolated in its owning frame. Camera motion is never
// fed back into a world-space chase of a hand-held object.
function pose(world,id,key,parent,position,rotation,dt){
 const object=world.items[id];world.poses??={};
 let state=world.poses[id];
 if(!state||state.key!==key){
  object.updateWorldMatrix(true,false);parent?.updateWorldMatrix(true,false);
  const start=object.getWorldPosition(v()),startQ=object.getWorldQuaternion(new T.Quaternion());
  if(parent){parent.worldToLocal(start);startQ.premultiply(parent.getWorldQuaternion(new T.Quaternion()).invert());}
  state=world.poses[id]={key,start,startQ,elapsed:0};
 }
 state.elapsed=Math.min(.32,state.elapsed+dt);
 const t=state.elapsed/.32,e=t*t*(3-2*t);
 object.position.copy(state.start).lerp(position,e);
 object.quaternion.copy(state.startQ).slerp(rotation,e);
 if(parent){parent.localToWorld(object.position);object.quaternion.premultiply(parent.getWorldQuaternion(new T.Quaternion()));}
 object.updateMatrixWorld(true);
}

export function prepareInteractionFrame(world,dt,sim,input,settings){
 const held=id=>sim.held===id||sim.supporting===id;
 world.bodyPosition??=world.baseCam.clone();
 const fill=sim.mode==='fill';
 world.reach= T.MathUtils.damp(world.reach||0,fill?1:0,5,dt);
 world.bodyPosition.copy(world.baseCam).lerp(v(-.45,.66,2.1),world.reach);
 world.camera.position.copy(world.bodyPosition);
 world.camera.rotation.set(world.pitch-world.reach*.18,world.yaw+world.reach*.62,0,'YXZ');
 if(sim.phase==='inhale'&&settings.motion){
  const envelope=Math.sin(Math.min(1,sim.transition/4)*Math.PI);
  world.camera.rotation.z=Math.sin(sim.transition*18)*sim.cough*.018*envelope;
  world.camera.position.y+=Math.sin(sim.transition*12)*sim.cough*.006*envelope;
 }
 world.camera.updateMatrixWorld(true);
 const hole=sim.phase==='hole'&&held('bottle');
 const bottle=world.items.bottle,pipe=world.items.pipe;
 const restBottleRotation=q(-1.7768,.1651,.7989),heldBottleWorldRotation=q(0,0,Math.PI/36);
 let b=world.home.bottle,bq=restBottleRotation.clone(),bParent=null,bKey='rest';
 if(held('bottle')){
  // Keep the held bottle world-upright with a 5-degree lean, independent of camera pitch/yaw.
  bParent=world.camera;b=v(-.08,-.15,-.64);bq.copy(world.camera.quaternion).invert().multiply(heldBottleWorldRotation);bKey='held';
  if(hole){b=v(-.07,.025,-.45);bq=q(-2.05,1.05,.12);bKey='bottom';}
  else if(sim.phase==='inhale'){b=v(0,-.23,-.22);bq=q(.22,0,0);bKey='inhale';}
  // Bottle tilted on its side with mouth submerged into stream water, not
  // pointing downward. Physics: water flows into the angled open mouth.
  else if(fill){bParent=null;b=v(world.streamX(.8)+.112,-.135,.784);bq=q(0.22,0,Math.PI*.39);bKey='fill';}
 }
 pose(world,'bottle',bKey,bParent,b,bq,dt);
  let p=world.home.pipe,pq=q(1.244,-.1329,-.1852),pParent=null,pKey='rest';
 const assembling=['screw','uncap','unscrew','press'].includes(sim.mode);
 if((sim.cap&&sim.prep>0)||assembling){
  pParent=bottle;p=v(0,.226,0);pq=q();pKey='attached';
  if(assembling){
   const lift=(1-sim.progress)*.065;
   p.y+=lift;pq=q(0,sim.mode==='press'?0:sim.progress*Math.PI*6,0);
  }
 }else if(held('pipe')){
  pParent=world.camera;p=v(-.13,-.035,-.49);pq=q(0,0,sim.phase==='heat'?Math.PI*.58:0);pKey=sim.phase==='heat'?'heating':'held';
 }
 pose(world,'pipe',pKey,pParent,p,pq,dt);
 for(const part of pipe.children)if(part.material===world.capmesh?.material)part.visible=sim.prep>0;
 world.spareCap.visible=sim.prep===0&&sim.cap;
 if(world.meltRim)world.meltRim.visible=sim.outlet;
 const bagHeld=held('bag');
  pose(world,'bag',bagHeld?'held':'rest',bagHeld?world.camera:null,bagHeld?v(-.22,-.12,-.57):world.home.bag,bagHeld?q(-.12):q(-1.453,-.0931,.9055),dt);
 const aiming=held('lighter')&&['heat','hole','ignite'].includes(sim.mode);
  if(!aiming)pose(world,'lighter',held('lighter')?'held':'rest',held('lighter')?world.camera:null,held('lighter')?v(.17,-.13,-.49):world.home.lighter,held('lighter')?q(0,0,.12+T.MathUtils.degToRad(sim.angle)):q(1.5708,0,0),dt);
 world.scene.updateMatrixWorld(true);
 world.target.copy(world.targetPoint(sim));
 if(aiming){
  const lighter=world.items.lighter;
  const plane=new T.Plane().setFromNormalAndCoplanarPoint(world.camera.getWorldDirection(v()),world.target);
  world.raycaster.setFromCamera(new T.Vector2(input.x/innerWidth*2-1,1-input.y/innerHeight*2),world.camera);
  const contact=world.raycaster.ray.intersectPlane(plane,v())||world.target.clone();
  // World-up buoyancy is also used by the visible flame. Its hot contact point
  // therefore shares the exact same anchor as the spatial interaction ray.
  const localQ=q(0,0,T.MathUtils.degToRad(sim.angle));
  const worldQ=world.camera.quaternion.clone().multiply(localQ);
  const destination=contact.clone().sub(v(0,.021,0)).sub((world.nozzle||world.flameAnchor).clone().applyQuaternion(worldQ));
  pose(world,'lighter','aimed',world.camera,world.camera.worldToLocal(destination),localQ,dt);
 }
 if(world.flameShader||world.nozzle){
  const lighter=world.items.lighter;
  world.flame.quaternion.copy(lighter.quaternion).invert().multiply(q(0,world.camera.rotation.y,0));
  if(world.nozzle)world.flame.position.copy(world.nozzle);
 }
 world.scene.updateMatrixWorld(true);
 world.aimScreen=world.screen(world.target);
 const anchors={bottle:v(0,.226,0),pipe:v(0,.045+0.016,0),lighter:world.nozzle||v(0,.08,0),bag:v(0,.14,0)};
 for(const [id,object]of Object.entries(world.items))world.projected[id]=world.screen(object.localToWorld(anchors[id].clone()));
 world.projected.stream=world.screen(v(world.streamX(.75),-.06,.75));
}
