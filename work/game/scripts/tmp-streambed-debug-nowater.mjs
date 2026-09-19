import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const out=path.resolve('qa/stream-bed-01-debug-nowater.png');
await fs.mkdir(path.dirname(out),{recursive:true});
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
try{
  await page.waitForFunction(()=>!!window.__game,{timeout:30000});
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);if(w.showInactive)w.showInactive();});
  await page.evaluate(()=>{
    const g=window.__game;g.begin();g.setState({phase:'free',mode:'fill',held:'bottle',supporting:null,prep:2,water:.2,cap:true,tutorial:false});
    g.world.setQuality('high');g.world.reach=1;g.world.prepareFrame(.016,g.sim,g.input,g.settings);
    const water=g.world.scene.getObjectByName('stream');if(water)water.visible=false;
  });
  await page.waitForTimeout(3000);
  const colors=await page.evaluate(()=>{
    const rows=[];
    window.__game.world.scene.traverse(o=>{
      if(!o?.isInstancedMesh||!String(o.name).includes('Streambed Class 2b Medium'))return;
      const a=o.instanceColor;
      const samples=[];
      if(a)for(let i=0;i<Math.min(8,o.count);i++)samples.push([a.getX(i),a.getY(i),a.getZ(i)]);
      rows.push({name:o.name,count:o.count,key:o.material?.customProgramCacheKey?.(),samples});
    });
    return rows;
  });
  await page.screenshot({path:out});
  console.log(JSON.stringify({out,colors},null,2));
}finally{await app.close();}
