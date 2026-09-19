import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
try{
 const page=await app.firstWindow();await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.quality='medium';g.settings.weather='clear';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,water:.3,cap:true,prep:2});const update=g.world.update;g.world.update=function(...args){update.apply(this,args);if(window.__atmProbe){this.sun.intensity=window.__atmProbe.sun;this.forestHemisphere.intensity=window.__atmProbe.fill;}};});
 await page.waitForTimeout(1200);const session=await createCaptureSession({outDir:path.resolve('qa/atm-01/lighting-probe'),page,minTriangles:1000,minCalls:1});
 for(const [name,yaw,pitch] of [['shrubs',-.85,-.14],['side',1.65,-.16],['canopy',.9273,.8]]){
  await page.evaluate(({yaw,pitch})=>window.__game.setView(yaw,pitch),{yaw,pitch});await page.waitForTimeout(600);
  await page.evaluate(()=>{window.__game.openMenu();document.getElementById('modal').classList.add('hidden');});
  for(const [variant,sun,fill] of [['current',3.8,1.05],['sun58',5.8,.85],['sun70',7,.8]]){
   await page.evaluate(({sun,fill})=>window.__atmProbe={sun,fill},{sun,fill});
   await session.capture(`${name}-${variant}`,{view:{yaw,pitch},state:{diagnosticLightingOverride:{sun,fill}}});
  }
  await page.evaluate(()=>window.__game.closeMenu());
 }
 await session.finalize({extraMeta:{scope:'Diagnostic only: deliberate runtime direct-sun/fill overrides, no production source changes'}});
}finally{await app.close();}
