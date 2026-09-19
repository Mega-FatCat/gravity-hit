import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.quality='medium';g.settings.weather='clear';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,water:.3,cap:true,prep:2});});
 await page.waitForTimeout(1200);
 const result=await page.evaluate(()=>{
  const w=window.__game.world,shadow=w.sun.shadow,map=shadow.map,width=map.width,height=map.height;
  const pixels=new Uint8Array(width*height*4);w.renderer.readRenderTargetPixels(map,0,0,width,height,pixels);
  const depth=(x,y)=>{x=Math.max(0,Math.min(width-1,Math.floor(x)));y=Math.max(0,Math.min(height-1,Math.floor(y)));const i=(y*width+x)*4;return (pixels[i]*(255/256)+pixels[i+1]*(255/65536)+pixels[i+2]*(255/16777216)+pixels[i+3]/16777216)/255;};
  const rows=[];
  for(const [name,yaw,pitch] of [['shrubs',-.85,-.14],['side',1.65,-.16],['ground',.9273,-.55],['dense',2.5,.18]]){
   const g=window.__game;g.setView(yaw,pitch);w.prepareFrame(0,g.sim,g.input,g.settings);w.camera.updateMatrixWorld(true);
   const direction=w.camera.getWorldDirection(w.camera.position.clone());
   for(const t of [.1,.5,1,2,3,4,6]){
    const p=w.camera.position.clone().addScaledVector(direction,t),sc=p.clone().applyMatrix4(shadow.matrix),x=sc.x*width,y=sc.y*height,z=sc.z+.00035;
    const visible=(dx,dy)=>z<=depth(x+dx,y+dy)?1:0;
    const lit=.36*visible(0,0)+.16*(visible(1,0)+visible(-1,0)+visible(0,1)+visible(0,-1));
    const surrounding=(visible(44,0)+visible(-44,0)+visible(0,44)+visible(0,-44))*.25;
    rows.push({name,t,position:p.toArray(),lit,gap:(1-surrounding)*lit,shadowCoordinate:sc.toArray()});
   }
  }
  return {sun:w.sun.position.toArray(),mapSize:[width,height],rows};
 });
 await fs.writeFile('qa/atm-01/gap-diagnostic.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await app.close();}
