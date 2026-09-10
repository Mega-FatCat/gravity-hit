import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve('../qa/recovery',process.argv[2]||'gh10');
await fs.mkdir(out,{recursive:true});
const app=await electron.launch({args:['.','--qa'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[],records=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});

try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.click('#begin');
 await page.waitForTimeout(500);
 await page.evaluate(()=>{
  const g=window.__game,w=g.world;
  g.openMenu();document.querySelector('#modal').classList.add('hidden');document.querySelector('#hud').classList.add('hidden');
  window.__gh10Originals={prepareFrame:w.prepareFrame,update:w.update};
  g.closeMenu();document.querySelector('#hud').classList.add('hidden');
  w.prepareFrame=()=>{};w.update=()=>{};
 });

 async function contrast(name,view,rotation){
  await page.evaluate(({view,rotation})=>{
   const g=window.__game,w=g.world,o=w.items.pipe;
   g.setView(view[0],view[1]);
   w.camera.position.copy(w.baseCam);
   w.camera.rotation.set(view[1],view[0],0,'YXZ');
   w.camera.updateMatrixWorld(true);
   if(!window.__gh10SceneVisibility)window.__gh10SceneVisibility=w.scene.children.map(child=>[child,child.visible]);
   for(const child of w.scene.children)if(child!==o&&!child.isLight)child.visible=true;
   for(const item of Object.values(w.items))item.visible=item===o;
   w.trash.visible=false;w.spareCap.visible=false;w.flame.visible=false;w.flameCore.visible=false;w.hotTip.visible=false;w.bowlBud.visible=false;w.outlet.visible=false;
   for(const child of o.children)if(child.material===w.capmesh.material)child.visible=false;
   Object.assign(g.sim,{phase:'free',mode:'idle',prep:0,cap:true,water:0,smoke:0,bud:0,embers:0,residue:0,outlet:false});
   w.heroProps.update(g.sim);
   o.quaternion.copy(w.camera.quaternion);o.rotateX(rotation[0]);o.rotateY(rotation[1]);o.rotateZ(rotation[2]);
   const anchor=o.position.clone().set(0,-.00075,0).applyQuaternion(o.quaternion);
   o.position.set(0,0,-.30).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
   w.scene.updateMatrixWorld(true);w.renderer.shadowMap.needsUpdate=true;w.render();
  },{view,rotation});
  await page.waitForTimeout(180);
  await page.screenshot({path:path.join(out,`${name}.png`)});
  records.push({name,view,rotation});
  console.log(`Captured ${name}`);
 }

 await contrast('01-dark-trunk',[.62,.04],[0,.35,.12]);
 await contrast('02-bright-sky',[-.25,.55],[0,.35,.12]);
 await contrast('03-forest-floor',[-.18,-.60],[0,.35,.12]);

 await page.evaluate(()=>{
  const g=window.__game,w=g.world;
  w.prepareFrame=window.__gh10Originals.prepareFrame;w.update=window.__gh10Originals.update;
  for(const [child,visible] of window.__gh10SceneVisibility||[])child.visible=visible;
  for(const item of Object.values(w.items))item.visible=true;
  w.trash.visible=false;w.hotTip.visible=true;w.bowlBud.visible=true;w.flame.visible=true;w.flameCore.visible=true;w.outlet.visible=true;
  document.querySelector('#hud').classList.remove('hidden');
  g.setView(0,-.265);g.input.fire=false;g.input.seal=false;
  g.setState({phase:'free',mode:'idle',held:'pipe',supporting:null,picked:[],prep:0,cap:false,water:0,smoke:0,bud:0,embers:0,residue:0,outlet:false,tutorial:false,stock:10});
 });
 await page.waitForTimeout(900);
 await page.screenshot({path:path.join(out,'04-normal-held.png')});
 records.push({name:'04-normal-held',state:{held:'pipe',cap:false}});
 const metrics=await page.evaluate(()=>window.__game.metrics());
 await fs.writeFile(path.join(out,'capture.json'),JSON.stringify({warning:'GH-10 glass material contrast captures.',records,metrics,errors},null,2));
}finally{await app.close();}
