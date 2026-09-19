import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const outDir=path.resolve(process.argv[2]||'qa/user-fixes-20260919/interaction');
await fs.mkdir(outDir,{recursive:true});

const app=await electron.launch({
  args:['.','--qa'],
  executablePath:path.resolve('node_modules/electron/dist/electron.exe'),
  timeout:90000
});
const page=await app.firstWindow();
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});

try{
  await page.waitForFunction(()=>window.__game&&document.querySelector('#begin')&&!document.querySelector('#begin').disabled,null,{timeout:180000});
  await page.click('#begin');
  await page.waitForTimeout(500);
  await page.evaluate(()=>{
    const g=window.__game;
    g.settings.wind=0;
    g.settings.motion=false;
    g.setView(0,-.265);
    g.setState({
      phase:'free',mode:'ignite',held:'lighter',supporting:'bottle',picked:['lighter','bottle'],
      prep:2,cap:true,outlet:true,water:1,bud:1,smoke:0,embers:0,flow:0,
      seal:false,angle:45,flameQuality:1,tutorial:false,stock:10
    });
    g.input.fire=true;
    g.input.aim=1;
    g.input.seal=true;
  });

  const session=await createCaptureSession({outDir,page,minTriangles:100,minCalls:1});
  const measurements=[];

  async function advanceWorld(frames,{simulate=false}={}){
    return page.evaluate(({frames,simulate})=>{
      const g=window.__game,w=g.world,dt=1/60;
      for(let i=0;i<frames;i++){
        w.prepareFrame(dt,g.sim,g.input,g.settings);
        if(simulate){
          g.input.aim=1;
          g.sim.step(dt,g.input);
        }
        w.update(dt,g.sim,g.input,g.settings,true);
      }
      w.render();
    },{frames,simulate});
  }

  async function advanceToWater(target){
    const result=await page.evaluate(({target})=>{
      const g=window.__game,w=g.world,dt=1/60;
      g.input.seal=false;
      let frames=0;
      while(g.sim.water>target&&frames<1200){
        w.prepareFrame(dt,g.sim,g.input,g.settings);
        g.input.aim=1;
        g.sim.step(dt,g.input);
        w.update(dt,g.sim,g.input,g.settings,true);
        frames++;
      }
      g.input.seal=true;
      w.prepareFrame(dt,g.sim,g.input,g.settings);
      w.update(dt,g.sim,g.input,g.settings,true);
      w.render();
      return {frames,water:g.sim.water,bud:g.sim.bud,smoke:g.sim.smoke,smokeDensity:g.sim.smokeDensity,embers:g.sim.embers};
    },{target});
    measurements.push({target,...result});
    return result;
  }

  async function captureBurn(name,target){
    const state=await advanceToWater(target);
    await page.waitForTimeout(100);
    await session.capture(name,{state});
    console.log(`${name}: ${JSON.stringify(state)}`);
  }

  await advanceWorld(60);
  await captureBurn('01-live-burn-10pct-water-released',.90);
  await captureBurn('02-live-burn-25pct-water-released',.75);
  await captureBurn('03-live-burn-50pct-water-released',.50);

  const halfway=measurements[1],complete=measurements[2];
  if(Math.abs(halfway.smoke-.5)>.025||Math.abs(halfway.bud-.5)>.025){
    throw new Error(`25% drainage mapping drifted: ${JSON.stringify(halfway)}`);
  }
  if(complete.smoke<.975||complete.bud>.025){
    throw new Error(`50% drainage did not consume the full charge: ${JSON.stringify(complete)}`);
  }

  await page.evaluate(()=>{
    const g=window.__game;
    g.input.fire=false;
    g.input.seal=false;
    g.setState({phase:'free',mode:'idle',held:null,supporting:null,picked:[],prep:2,cap:false,outlet:true,water:.8,bud:0,smoke:0,embers:0,flow:0});
  });
  await advanceWorld(45);
  await page.evaluate(()=>{
    const g=window.__game,w=g.world;
    g.setState({mode:'pack',held:'bag',picked:['bag']});
    w.__qaUpdate=w.update.bind(w);
    w.update=(...args)=>{
      if(w.poses.bag?.key==='held')w.poses.bag.elapsed=Math.min(w.poses.bag.elapsed,.18);
      w.__qaUpdate(...args);
      if(w.poses.bag?.key==='held')w.poses.bag.elapsed=Math.min(w.poses.bag.elapsed,.18);
    };
  });
  await page.waitForTimeout(110);
  const bagEntering=await page.evaluate(()=>({
    pose:window.__game.world.poses.bag,
    overlayHidden:document.querySelector('#packing').classList.contains('hidden'),
    overlayDisplay:getComputedStyle(document.querySelector('#packing')).display
  }));
  const bagEnteringPng=await page.screenshot();
  await page.evaluate(()=>{
    const w=window.__game.world;
    w.update=w.__qaUpdate;
    delete w.__qaUpdate;
  });
  await page.waitForTimeout(330);
  const bagReady=await page.evaluate(()=>({
    pose:window.__game.world.poses.bag,
    overlayHidden:document.querySelector('#packing').classList.contains('hidden'),
    overlayDisplay:getComputedStyle(document.querySelector('#packing')).display
  }));
  const bagReadyPng=await page.screenshot();
  if(!bagEntering.overlayHidden)throw new Error(`Nug appeared before the bag settled: ${JSON.stringify(bagEntering)}`);
  if(bagReady.overlayHidden)throw new Error(`Nug did not appear once the bag was ready: ${JSON.stringify(bagReady)}`);

  if(errors.length)throw new Error(`Runtime errors: ${errors.join('; ')}`);
  const manifest=await session.finalize({
    warning:'Deterministic live burn and bag-reveal fixture; automated runtime evidence, not human playtest.',
    errors,
    extraMeta:{measurements,bagEntering,bagReady}
  });
  await fs.writeFile(path.join(outDir,'04-bag-entering-no-early-nug.png'),bagEnteringPng);
  await fs.writeFile(path.join(outDir,'05-bag-ready-nug-revealed.png'),bagReadyPng);
  console.log(JSON.stringify({outDir,summary:manifest.summary,measurements,bagEntering,bagReady},null,2));
}finally{
  await app.close();
}
