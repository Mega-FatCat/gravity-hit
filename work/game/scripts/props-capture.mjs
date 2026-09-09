import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

// Explicit inspection fixtures. These pause state and pose writers to rotate
// each finished prop around its own axes; they are not gameplay verification.
const out=path.resolve('../qa/recovery',process.argv[2]||'props-pass2');
await fs.mkdir(out,{recursive:true});
const app=await electron.launch({args:['.','--qa'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[],records=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});await page.click('#begin');await page.waitForTimeout(500);
 await page.evaluate(()=>{
  const g=window.__game;g.openMenu();document.querySelector('#modal').classList.add('hidden');document.querySelector('#hud').classList.add('hidden');
  g.world.prepareFrame=()=>{};g.world.update=()=>{};
 });
 async function shot(name,id,rotation=[0,0,0],water=0,smoke=0,residue=0){
  if(process.argv[3]&&!name.includes(process.argv[3]))return;
  const record=await page.evaluate(({id,rotation,water,smoke,residue})=>{
   const g=window.__game,w=g.world,o=w.items[id];
   Object.assign(g.sim,{phase:'free',mode:'idle',prep:0,cap:true,water,smoke,residue,bud:0,embers:0,outlet:water>0});
   for(const [key,item]of Object.entries(w.items))item.visible=key===id;
   w.trash.visible=false;w.spareCap.visible=true;w.flame.visible=false;w.flameCore.visible=false;w.hotTip.visible=false;w.bowlBud.visible=false;w.outlet.visible=water>0;
   for(const child of w.items.pipe.children)if(child.material===w.capmesh.material)child.visible=false;
   w.heroProps.update(g.sim);
   const distance={bottle:.48,pipe:.30,lighter:.20}[id],center={bottle:.112,pipe:.0115,lighter:.04}[id];
   o.quaternion.copy(w.camera.quaternion);o.rotateX(rotation[0]);o.rotateY(rotation[1]);o.rotateZ(rotation[2]);
   const anchor=o.position.clone().set(0,center,0).applyQuaternion(o.quaternion);
   o.position.set(0,0,-distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
   w.scene.updateMatrixWorld(true);w.liquid.update(water,w.time);w.liquid.volume.visible=w.liquid.surface.visible=id==='bottle'&&water>0;
   w.bottleSmoke.visible=id==='bottle'&&smoke>0;
   const u=w.bottleSmoke.material.uniforms;u.uDensity.value=smoke/Math.max(.06,1-water)*2.6;u.uCam.value.copy(w.items.bottle.worldToLocal(w.camera.position.clone()));
   if(w.meltRim)w.meltRim.visible=water>0;
   w.renderer.shadowMap.needsUpdate=true;w.render();
   const names=[];o.traverse(c=>{if(c.isMesh)names.push(c.name);});
   return {id,rotation,water,smoke,residue,names,waterPlane:w.liquid.localWaterPlane.toArray()};
  },{id,rotation,water,smoke,residue});
  await page.waitForTimeout(100);await page.screenshot({path:path.join(out,name+'.png')});records.push({name,...record});console.log(name);
 }
 await shot('01-bottle-empty','bottle');
 await shot('02-bottle-full','bottle',[0,0,0],.92);
 await shot('03-bottle-water-smoke','bottle',[0,0,0],.16,.65);
 await shot('04-bottle-x-tilt','bottle',[.95,0,0],.48,.2);
 await shot('05-bottle-z-tilt','bottle',[0,0,1.1],.48,.2);
 await shot('06-bottle-combined-tilt','bottle',[.75,.65,.85],.3,.5);
 await shot('07-bottle-bottom','bottle',[-1.8,.3,.1]);
 await shot('08-bottle-back','bottle',[0,Math.PI,0]);
 await shot('09-pipe-front','pipe');
 await shot('10-pipe-bowl','pipe',[.65,0,0]);
 await shot('11-pipe-bottom','pipe',[-1.0,.5,.3]);
 await shot('12-pipe-residue','pipe',[.3,0,.6],0,0,.6);
 await shot('13-lighter-front','lighter');
 await shot('14-lighter-left','lighter',[0,.65,0]);
 await shot('15-lighter-right','lighter',[0,-.65,0]);
 await shot('16-lighter-back','lighter',[0,Math.PI,0]);
 await shot('17-lighter-bottom','lighter',[-1.35,.3,.1]);
 await shot('18-lighter-tilted','lighter',[.2,0,.78]);
 await fs.writeFile(path.join(out,'capture.json'),JSON.stringify({warning:'Paused, isolated prop inspection fixtures, not gameplay proof.',records,errors},null,2));
}finally{await app.close();}
