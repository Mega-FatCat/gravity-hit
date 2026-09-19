import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {sampleAtmSunVisibility} from './atm-sun-visibility.mjs';
import {createHash} from 'node:crypto';
const sourceFiles=['src/atmosphere.js','src/environment.js','src/foliage-rendering.js','src/foliage-mipmaps.js','dist/index.html'];
const fingerprint=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,createHash('sha256').update(await fs.readFile(f)).digest('hex')])));
const sourceHashes=await fingerprint();
const app=await electron.launch({args:['.','--qa','--benchmark'],executablePath:path.resolve('node_modules/electron/dist/electron.exe'),timeout:90000});
try{
 const page=await app.firstWindow(); await page.waitForFunction(()=>!!window.__game,null,{timeout:180000});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1920,1080));
 await page.evaluate(async()=>{const g=window.__game;await g.world.ready;g.begin();g.settings.quality='medium';g.settings.weather='clear';g.world.setQuality('medium');g.setState({phase:'free',mode:'idle',held:null,water:.3,cap:true,prep:2,tutorial:false});g.setView(.9273,.8);g.openMenu();g.world.time=3;document.getElementById('modal').classList.add('hidden');});
 await page.waitForTimeout(1500);
 await page.screenshot({path:'qa/atm-01/occlusion-probe-preview.png'});
 const runtime=await page.evaluate(()=>{const a=window.__game.world.atmosphere;return {diagnostics:a.getDiagnostics(),depthSize:a.depthTexture?.image,solarUV:a._compositeUniforms.atmosphereSunUV.value.toArray()};});
 const rows=[];
 for(const camera of [[-2.5,2.8,1],...([.98,1.6,2.8].flatMap(y=>Array.from({length:41},(_,i)=>[-4+i*.2,y,1])))]){
  await page.evaluate(camera=>window.__game.world.baseCam.fromArray(camera),camera);await page.waitForTimeout(100);
  const visibility=await sampleAtmSunVisibility(page);
  rows.push({camera,visibility});
 }
 await fs.writeFile('qa/atm-01/sun-occlusion-probe.json',JSON.stringify({timestamp:new Date().toISOString(),sourceHashes,sourceHashesEnd:await fingerprint(),runtime,rows},null,2));console.log(JSON.stringify(rows.filter(r=>r.visibility<.45)));
}finally{await app.close();}

