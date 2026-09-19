import {_electron as electron} from 'playwright-core';
import path from 'node:path';

const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
try{
  await page.waitForFunction(()=>!!window.__game,{timeout:30000});
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);if(w.showInactive)w.showInactive();});
  await page.evaluate(()=>{
    const g=window.__game;g.begin();g.setState({phase:'free',mode:'idle',held:null,supporting:null,prep:2,water:.3,cap:true,tutorial:false});
    g.setView(.66,-.68);g.world.setQuality('high');g.world.prepareFrame(.016,g.sim,g.input,g.settings);
  });
  await page.waitForTimeout(2200);
  const rows=await page.evaluate(()=>{
    const w=window.__game.world;
    const targets=[[440,338],[585,310],[720,292],[865,278],[1050,270],[1220,285],[1375,318],[1530,355]];
    w.scene.updateMatrixWorld(true);
    return targets.map(([x,y])=>{
      w.raycaster.setFromCamera({x:x/1920*2-1,y:1-y/1080*2},w.camera);
      const hits=w.raycaster.intersectObjects(w.scene.children,true).slice(0,14).map(h=>({
        name:h.object?.name||h.object?.parent?.name||'',instanceId:h.instanceId??null,distance:+h.distance.toFixed(3),
        point:[+h.point.x.toFixed(3),+h.point.y.toFixed(3),+h.point.z.toFixed(3)]
      }));
      return {screen:[x,y],hits};
    });
  });
  console.log(JSON.stringify(rows,null,2));
}finally{await app.close();}
