import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out=path.resolve('../qa/recovery',process.argv[2]||'gh09');
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
  window.__gh09Originals={prepareFrame:w.prepareFrame,update:w.update};
  g.closeMenu();document.querySelector('#hud').classList.add('hidden');
  w.prepareFrame=()=>{};w.update=()=>{};
 });

 async function isolated(name,rotation,distance=.30){
 await page.evaluate(({rotation,distance})=>{
   const g=window.__game,w=g.world,o=w.items.pipe;
   if(!window.__gh09SceneVisibility)window.__gh09SceneVisibility=w.scene.children.map(child=>[child,child.visible]);
   for(const child of w.scene.children)if(child!==o&&!child.isLight)child.visible=false;
   Object.assign(g.sim,{phase:'free',mode:'idle',prep:0,cap:true,water:0,smoke:0,bud:0,embers:0,residue:0,outlet:false});
   for(const item of Object.values(w.items))item.visible=item===o;
   w.trash.visible=false;w.spareCap.visible=true;w.flame.visible=false;w.flameCore.visible=false;w.hotTip.visible=false;w.bowlBud.visible=false;w.outlet.visible=false;
   for(const child of o.children)if(child.material===w.capmesh.material)child.visible=false;
   w.heroProps.update(g.sim);
   o.quaternion.copy(w.camera.quaternion);o.rotateX(rotation[0]);o.rotateY(rotation[1]);o.rotateZ(rotation[2]);
   const anchor=o.position.clone().set(0,-.00075,0).applyQuaternion(o.quaternion);
   o.position.set(0,0,-distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
   w.scene.updateMatrixWorld(true);w.renderer.shadowMap.needsUpdate=true;w.render();
  },{rotation,distance});
  await page.waitForTimeout(120);
  await page.screenshot({path:path.join(out,`${name}.png`)});
  records.push({name,fixture:true,rotation});
  console.log(`Captured ${name}`);
 }

 await isolated('01-front',[0,0,0]);
 await isolated('02-side',[0,0,Math.PI*.5]);
 await isolated('03-bowl',[-1.25,0,0]);
 await isolated('04-mouthpiece',[1.25,0,0]);
 await isolated('05-bottom',[.3,1.0,.25]);

 await page.evaluate(()=>{
  const g=window.__game,w=g.world;
  w.prepareFrame=window.__gh09Originals.prepareFrame;w.update=window.__gh09Originals.update;
  for(const [child,visible] of window.__gh09SceneVisibility||[])child.visible=visible;
  for(const item of Object.values(w.items))item.visible=true;
  w.trash.visible=false;w.hotTip.visible=true;w.bowlBud.visible=true;w.flame.visible=true;w.flameCore.visible=true;w.outlet.visible=true;
  document.querySelector('#hud').classList.remove('hidden');
  g.setView(0,-.265);g.input.fire=false;g.input.seal=false;
 });
 async function runtime(name,state){
  await page.evaluate(state=>{const g=window.__game;g.setState({phase:'free',mode:'idle',held:null,supporting:null,picked:[],prep:0,cap:true,water:0,smoke:0,bud:0,embers:0,residue:0,outlet:false,tutorial:false,stock:10,...state});},state);
  await page.waitForTimeout(850);
  await page.screenshot({path:path.join(out,`${name}.png`)});
  records.push({name,fixture:false,state});
  console.log(`Captured ${name}`);
 }
 await runtime('06-resting-on-stone',{});
 await runtime('07-held',{held:'pipe',cap:false});
 await runtime('08-installed-on-cap',{held:'bottle',prep:2,cap:true,water:.9,bud:1,outlet:true});
 const metrics=await page.evaluate(()=>window.__game.metrics());
 await fs.writeFile(path.join(out,'capture.json'),JSON.stringify({warning:'GH-09 geometry and interaction captures.',records,metrics,errors},null,2));
}finally{await app.close();}
