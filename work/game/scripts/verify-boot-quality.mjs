import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const server=await createServer({server:{host:'127.0.0.1',port:0}});
await server.listen();
const address=server.httpServer.address();
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:false,args:['--enable-gpu','--use-angle=d3d11']});
try{
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${address.port}/?qa=1&quality=low`,{waitUntil:'commit'});
 const select=page.locator('#boot-quality-select');
 await select.waitFor();
 assert.equal(await page.evaluate(()=>window.__zniczLoading?.done),false);
 await select.selectOption('medium');
 await select.selectOption('high');
 await page.waitForFunction(()=>window.__game?.world?.quality==='high'&&window.__zniczLoading?.done,null,{timeout:180000});
 const result=await page.evaluate(()=>({selected:document.querySelector('#boot-quality-select').value,setting:window.__game.settings.quality,quality:window.__game.world.quality,tier:window.__game.world.profile.textureTier,hdr:window.__game.world.profile.loadHDR,ready:!document.querySelector('#begin').disabled}));
 assert.deepEqual(result,{selected:'high',setting:'high',quality:'high',tier:'2k',hdr:true,ready:true});
 assert.deepEqual(errors,[]);
 console.log('Boot quality changes during loading:',result);
}finally{
 await browser.close();
 await server.close();
}
