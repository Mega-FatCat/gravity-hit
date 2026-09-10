import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const outDir = path.resolve('qa/gh02-verification');
await fs.mkdir(outDir, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.waitForFunction(() => !!window.__game, {timeout: 180000});
await page.waitForTimeout(2000);

await page.evaluate(() => {
  window.__game.begin();
  window.__game.setView(0, -0.265);
});
await page.waitForTimeout(1000);

async function resetState() {
  await page.evaluate(() => {
    window.__game.setState({
      phase: 'free',
      mode: 'idle',
      held: null,
      supporting: null,
      picked: [],
      prep: 2,
      outlet: true,
      cap: false,
      bud: 1,
      water: 1,
      stock: 10,
      tutorial: false,
      progress: 0
    });
    window.__game.world.poses = {};
  });
  await page.waitForTimeout(500);
}

// Function to sample prop geometries and bounding info
async function sampleGeometry(label) {
  return await page.evaluate(lbl => {
    const pipe = window.__game.world.items.pipe;
    const bottle = window.__game.world.items.bottle;
    const sim = window.__game.sim;

    // Get world positions
    const T = window.__game.world.renderer.capabilities; // dummy ref
    pipe.updateWorldMatrix(true, false);
    bottle.updateWorldMatrix(true, false);

    // Tip of glass pipe stem in world space:
    // in props.js, lowest point of stem profile is at y = -0.049 in pipe local space
    const stemTipWorld = pipe.localToWorld(pipe.position.clone().set(0, -0.049, 0));

    // Mouth / lip of bottle in world space:
    // in props.js, lip is at y = 0.226 in bottle local space
    const bottleLipWorld = bottle.localToWorld(bottle.position.clone().set(0, 0.226, 0));

    // Bottle local pipe position
    const pipeInBottle = pipe.position.clone();

    // Clearance along bottle axis (positive means pipe tip is above bottle lip, negative means inside bottle)
    const clearance = pipeInBottle.y - 0.049 - 0.226;

    return {
      label: lbl,
      sim: {
        held: sim.held,
        supporting: sim.supporting,
        mode: sim.mode,
        progress: sim.progress,
        cap: sim.cap
      },
      pipePosBottle: {
        x: pipeInBottle.x,
        y: pipeInBottle.y,
        z: pipeInBottle.z
      },
      pipeRotationBottle: {
        x: pipe.rotation.x,
        y: pipe.rotation.y,
        z: pipe.rotation.z
      },
      stemTipWorld: {
        x: stemTipWorld.x,
        y: stemTipWorld.y,
        z: stemTipWorld.z
      },
      bottleLipWorld: {
        x: bottleLipWorld.x,
        y: bottleLipWorld.y,
        z: bottleLipWorld.z
      },
      clearance: clearance,
      isIntersecting: clearance < 0
    };
  }, label);
}

// Step helper using game input
async function turnScrew(targetProgress, direction = 'forward') {
  // Turn using right (D) or left (A) until reaching targetProgress
  await page.evaluate(({target, dir}) => {
    return new Promise(resolve => {
      const isFwd = dir === 'forward';
      function stepAnim() {
        const sim = window.__game.sim;
        if (isFwd ? sim.progress >= target : sim.progress <= target) {
          window.__game.input.right = false;
          window.__game.input.left = false;
          resolve();
          return;
        }
        if (isFwd) {
          window.__game.input.right = true;
          window.__game.input.left = false;
        } else {
          window.__game.input.left = true;
          window.__game.input.right = false;
        }
        requestAnimationFrame(stepAnim);
      }
      requestAnimationFrame(stepAnim);
    });
  }, {target: targetProgress, dir: direction});
  await page.waitForTimeout(200);
}

const results = {
  orderA_pipe_then_bottle: {},
  orderB_bottle_then_pipe: {}
};

// =========================================================================
// RUN ORDER A: pipe -> bottle
// =========================================================================
console.log('\n--- Running Order A: pipe -> bottle ---');
await resetState();

// Pick pipe first
await page.evaluate(() => window.__game.act('pipe'));
await page.waitForTimeout(600);

// Pick bottle second
await page.evaluate(() => window.__game.act('bottle'));
await page.waitForTimeout(600);

// 1. START (0%)
results.orderA_pipe_then_bottle.start = await sampleGeometry('Order A - Start (0%)');
await page.screenshot({path: path.join(outDir, 'orderA-01-start.png')});

// 2. ~25%
await turnScrew(0.25, 'forward');
results.orderA_pipe_then_bottle.p25 = await sampleGeometry('Order A - ~25%');
await page.screenshot({path: path.join(outDir, 'orderA-02-progress25.png')});

// 3. ~50%
await turnScrew(0.50, 'forward');
results.orderA_pipe_then_bottle.p50 = await sampleGeometry('Order A - ~50%');
await page.screenshot({path: path.join(outDir, 'orderA-03-progress50.png')});

// 4. FULLY SCREWED (100%)
await turnScrew(0.999, 'forward');
results.orderA_pipe_then_bottle.fullyScrewed = await sampleGeometry('Order A - Fully Screwed (100%)');
await page.screenshot({path: path.join(outDir, 'orderA-04-fully-screwed.png')});

// 5. REVERSED BACK TO 0%
await turnScrew(0.001, 'reverse');
results.orderA_pipe_then_bottle.reversedTo0 = await sampleGeometry('Order A - Reversed to 0%');
await page.screenshot({path: path.join(outDir, 'orderA-05-reversed-back-to-0.png')});

// =========================================================================
// RUN ORDER B: bottle -> pipe
// =========================================================================
console.log('\n--- Running Order B: bottle -> pipe ---');
await resetState();

// Pick bottle first
await page.evaluate(() => window.__game.act('bottle'));
await page.waitForTimeout(600);

// Pick pipe second
await page.evaluate(() => window.__game.act('pipe'));
await page.waitForTimeout(600);

// 1. START (0%)
results.orderB_bottle_then_pipe.start = await sampleGeometry('Order B - Start (0%)');
await page.screenshot({path: path.join(outDir, 'orderB-01-start.png')});

// 2. ~25%
await turnScrew(0.25, 'forward');
results.orderB_bottle_then_pipe.p25 = await sampleGeometry('Order B - ~25%');
await page.screenshot({path: path.join(outDir, 'orderB-02-progress25.png')});

// 3. ~50%
await turnScrew(0.50, 'forward');
results.orderB_bottle_then_pipe.p50 = await sampleGeometry('Order B - ~50%');
await page.screenshot({path: path.join(outDir, 'orderB-03-progress50.png')});

// 4. FULLY SCREWED (100%)
await turnScrew(0.999, 'forward');
results.orderB_bottle_then_pipe.fullyScrewed = await sampleGeometry('Order B - Fully Screwed (100%)');
await page.screenshot({path: path.join(outDir, 'orderB-04-fully-screwed.png')});

// 5. REVERSED BACK TO 0%
await turnScrew(0.001, 'reverse');
results.orderB_bottle_then_pipe.reversedTo0 = await sampleGeometry('Order B - Reversed to 0%');
await page.screenshot({path: path.join(outDir, 'orderB-05-reversed-back-to-0.png')});

// Write summary json
await fs.writeFile(path.join(outDir, 'results.json'), JSON.stringify({results, errors}, null, 2));

console.log('\nVerification Summary:');
console.log('Order A Start clearance:', results.orderA_pipe_then_bottle.start.clearance.toFixed(4), 'm (intersecting:', results.orderA_pipe_then_bottle.start.isIntersecting, ')');
console.log('Order B Start clearance:', results.orderB_bottle_then_pipe.start.clearance.toFixed(4), 'm (intersecting:', results.orderB_bottle_then_pipe.start.isIntersecting, ')');
console.log('Order A vs B Start pos diff Y:', Math.abs(results.orderA_pipe_then_bottle.start.pipePosBottle.y - results.orderB_bottle_then_pipe.start.pipePosBottle.y));

console.log('Order A 25% clearance:', results.orderA_pipe_then_bottle.p25.clearance.toFixed(4), 'm (intersecting:', results.orderA_pipe_then_bottle.p25.isIntersecting, ')');
console.log('Order B 25% clearance:', results.orderB_bottle_then_pipe.p25.clearance.toFixed(4), 'm (intersecting:', results.orderB_bottle_then_pipe.p25.isIntersecting, ')');

console.log('Order A 50% clearance:', results.orderA_pipe_then_bottle.p50.clearance.toFixed(4), 'm (intersecting:', results.orderA_pipe_then_bottle.p50.isIntersecting, ')');
console.log('Order B 50% clearance:', results.orderB_bottle_then_pipe.p50.clearance.toFixed(4), 'm (intersecting:', results.orderB_bottle_then_pipe.p50.isIntersecting, ')');

console.log('Order A Fully Screwed clearance:', results.orderA_pipe_then_bottle.fullyScrewed.clearance.toFixed(4), 'm (intersecting:', results.orderA_pipe_then_bottle.fullyScrewed.isIntersecting, ')');
console.log('Order B Fully Screwed clearance:', results.orderB_bottle_then_pipe.fullyScrewed.clearance.toFixed(4), 'm (intersecting:', results.orderB_bottle_then_pipe.fullyScrewed.isIntersecting, ')');

console.log('Order A Reversed back to 0% clearance:', results.orderA_pipe_then_bottle.reversedTo0.clearance.toFixed(4), 'm (intersecting:', results.orderA_pipe_then_bottle.reversedTo0.isIntersecting, ')');
console.log('Order B Reversed back to 0% clearance:', results.orderB_bottle_then_pipe.reversedTo0.clearance.toFixed(4), 'm (intersecting:', results.orderB_bottle_then_pipe.reversedTo0.isIntersecting, ')');

await app.close();
console.log('Verification completed. Errors:', errors);
