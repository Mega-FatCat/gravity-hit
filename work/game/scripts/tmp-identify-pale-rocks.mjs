import {_electron as electron} from 'playwright-core';
import path from 'node:path';

const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
const page=await app.firstWindow();
try{
  await page.waitForFunction(()=>!!window.__game,{timeout:30000});
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1920,1080);if(w.showInactive)w.showInactive();});
  await page.evaluate(()=>{
    const g=window.__game;g.begin();g.setState({phase:'free',mode:'fill',held:'bottle',supporting:null,prep:2,water:.2,cap:true,tutorial:false});
    g.setView(1.08,-0.38);g.world.setQuality('high');g.world.reach=1;g.world.prepareFrame(.016,g.sim,g.input,g.settings);
  });
  await page.waitForTimeout(2500);
  const rows=await page.evaluate(()=>{
    const w=window.__game.world;
    const targets=[[790,300],[760,330],[1795,375],[1740,330],[1550,320]];
    w.scene.updateMatrixWorld(true);
    return targets.map(([x,y])=>{
      const ndc={x:x/1920*2-1,y:1-y/1080*2};
      w.raycaster.setFromCamera(ndc,w.camera);
      const hits=w.raycaster.intersectObjects(w.scene.children,true).slice(0,12).map(h=>({
        name:h.object?.name||h.object?.parent?.name||'',
        instanceId:h.instanceId??null,
        distance:+h.distance.toFixed(3),
        point:[+h.point.x.toFixed(3),+h.point.y.toFixed(3),+h.point.z.toFixed(3)],
        color:(Array.isArray(h.object?.material)?h.object.material[0]:h.object?.material)?.color?.getHexString?.()??null
      }));
      return {screen:[x,y],hits};
    });
  });
  console.log(JSON.stringify(rows,null,2));
}finally{await app.close();}
