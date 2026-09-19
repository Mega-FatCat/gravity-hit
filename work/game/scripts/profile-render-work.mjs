import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const qualityArg=process.argv.find(arg=>arg.startsWith('--quality='));
const quality=qualityArg?.split('=')[1]||'high';
const viewArg=process.argv.find(arg=>arg.startsWith('--view='));
const viewName=viewArg?.split('=')[1]||'forward';
const views={forward:[0,-.265],stream:[.75,-.2],forest:[-.85,-.15],canopy:[0,.6]};
if(!views[viewName])throw Error(`Unknown view: ${viewName}`);
const outputArg=process.argv.find(arg=>arg.startsWith('--output='));
const output=path.resolve(outputArg?.slice('--output='.length)||`qa/preset-baseline/profile-${quality}-${viewName}.json`);

const app=await electron.launch({args:['.','--qa','--benchmark',`--quality=${quality}`],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.setContentSize(1920,1080);window.showInactive?.();});
 const [yaw,pitch]=views[viewName];
 const profile=await page.evaluate(async({quality,viewName,yaw,pitch})=>{
  const game=window.__game;
  game.settings.quality=quality;game.world.setQuality(quality);game.begin();game.setView(yaw,pitch);
  game.setState({phase:'free',mode:'idle',held:null,supporting:null,water:.3,cap:true,bud:1,prep:2,outlet:true,smoke:.15,tutorial:false});
  await new Promise(resolve=>setTimeout(resolve,1200));
  const records=new Map(),saved=[];
  const normalize=name=>(name||'unnamed')
   .replace(/:-?\d+,-?\d+(?::(?:shadow|unshadowed))?$/,'')
   .replace(/ attached leaf shoots:-?\d+$/,' attached leaf shoots')
   .replace(/ dense tree leaves v\d+:-?\d+,-?\d+$/,' dense tree leaves');
  const tally=(object,geometry,pass)=>{
   const base=normalize(object.name||object.type),key=`${base} [${pass}]`;
   const triangles=(geometry.index?.count??geometry.attributes.position?.count??0)/3*(object.isInstancedMesh?object.count:1);
   const record=records.get(key)??{name:base,pass,calls:0,triangles:0,instances:0};
   record.calls++;record.triangles+=triangles;record.instances+=object.isInstancedMesh?object.count:1;records.set(key,record);
  };
  game.world.scene.traverse(object=>{
   if(!object.isMesh&&!object.isPoints&&!object.isLine)return;
   const before=object.onBeforeRender,shadow=object.onBeforeShadow;saved.push([object,before,shadow]);
   object.onBeforeRender=function(renderer,scene,camera,geometry,...rest){tally(object,geometry,'color');return before.call(this,renderer,scene,camera,geometry,...rest);};
   object.onBeforeShadow=function(renderer,object2,camera,shadowCamera,geometry,...rest){tally(object,geometry,'shadow');return shadow.call(this,renderer,object2,camera,shadowCamera,geometry,...rest);};
  });
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  for(const [object,before,shadow] of saved){object.onBeforeRender=before;object.onBeforeShadow=shadow;}
  const rows=[...records.values()],byTriangles=[...rows].sort((a,b)=>b.triangles-a.triangles).slice(0,40),byCalls=[...rows].sort((a,b)=>b.calls-a.calls).slice(0,40);
  const renderer=game.world.renderer;
  return{quality,view:viewName,yaw,pitch,renderer:{triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries},byTriangles,byCalls,environmentCounts:game.world.environmentCounts??{}};
 },{quality,viewName,yaw,pitch});
 profile.errors=errors;
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(profile,null,2));
 console.log(JSON.stringify(profile,null,2));
 if(errors.length)throw Error(`Runtime errors: ${errors.join('; ')}`);
}finally{await app.close();}
