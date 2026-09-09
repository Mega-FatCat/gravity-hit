import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
const label=process.argv[2]||'baseline';
const out=path.resolve('../qa/recovery',label);await fs.mkdir(out,{recursive:true});
const app=await electron.launch({args:['.','--qa'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow(),errors=[],records=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});await page.click('#begin');
 const base={phase:'collect',mode:'idle',held:null,supporting:null,picked:[],prep:0,cap:true,water:0,smoke:0,bud:0,angle:45,outlet:false};
 async function shot(name,state={},view=[0,-.265]){
  if(process.argv[3]&&!process.argv[3].split(',').some(prefix=>name.startsWith(prefix)))return;
  await page.evaluate(({base,state,view})=>{const g=window.__game;g.setState({...base,...state});g.setView(...view);g.input.fire=false;g.input.seal=true;g.input.x=innerWidth*.55;g.input.y=innerHeight*.48;},{base,state,view});
  await page.waitForTimeout(600);
  await page.evaluate(()=>window.__game.world.render());
  await page.screenshot({path:path.join(out,name+'.png')});
  records.push({name,fixture:true,state,view,...await page.evaluate(()=>({metrics:window.__game.metrics(),target:window.__game.world.aimScreen,held:window.__game.sim.held,supporting:window.__game.sim.supporting}))});console.log(name);
 }
 for(const [name,yaw,pitch]of [['01-forward',0,-.265],['02-left',.75,-.2],['03-far-left',1.5,-.15],['04-right',-.85,-.15],['05-far-right',-1.6,-.1],['06-ground',0,-.95],['07-canopy',0,.65],['08-rear',Math.PI,-.15],['09-midground',.25,.04]])await shot(name,{},[yaw,pitch]);
 await shot('10-bottle-held',{held:'bottle'});
 await shot('11-pipe-held',{held:'pipe'});
 await shot('12-lighter-held',{held:'lighter'});
 await shot('13-heat',{phase:'heat',mode:'heat',held:'lighter',supporting:'pipe',picked:['pipe','lighter'],heat:.5});
 await shot('14-press',{phase:'press',mode:'press',held:'bottle',supporting:'pipe',picked:['pipe','lighter'],progress:.5});
 await shot('15-unscrew',{phase:'unscrew',mode:'unscrew',held:'bottle',prep:1,cap:true,progress:.4});
 await shot('16-hole',{phase:'hole',mode:'hole',held:'lighter',supporting:'bottle',prep:1,cap:false,progress:.3});
 await shot('17-pack',{phase:'free',mode:'pack',held:'bag',prep:2,cap:false,outlet:true});
 await shot('18-fill',{phase:'free',mode:'fill',held:'bottle',prep:2,cap:false,outlet:true,water:.5});
 await shot('19-full',{phase:'free',held:'bottle',prep:2,cap:true,outlet:true,water:.9,bud:1});
 await shot('20-smoke',{phase:'free',held:'bottle',prep:2,cap:true,outlet:true,water:.16,smoke:.65,bud:.4,embers:.3});
 await shot('21-ignite',{phase:'free',mode:'ignite',held:'lighter',supporting:'bottle',prep:2,cap:true,outlet:true,water:.4,smoke:.4,bud:.7,embers:.2});
 await shot('22-upgraded',{phase:'free',day:2,stock:1000,prep:2,cap:false,outlet:true});
 await fs.writeFile(path.join(out,'capture.json'),JSON.stringify({warning:'Explicit visual fixtures, not gameplay proof',records,errors},null,2));
}finally{await app.close();}
