import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('qa/gh02-inspect');
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

// Helper to reset state
async function reset() {
  await page.evaluate(() => {
    window.__game.setState({
      phase: 'free',
      mode: 'idle',
      held: null,
      supporting: null,
      prep: 2,
      outlet: true,
      cap: false,
      bud: 1,
      water: 1,
      stock: 10,
      tutorial: false
    });
    // cancel any held poses
    window.__game.world.poses = {};
  });
  await page.waitForTimeout(500);
}

// Order 1: pipe -> bottle
console.log('Testing Order 1: pipe -> bottle');
await reset();
await page.evaluate(() => {
  window.__game.act('pipe');
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(outDir, 'order1-step1-pipe.png')});

await page.evaluate(() => {
  window.__game.act('bottle');
});
await page.waitForTimeout(600);
const s1_info = await page.evaluate(() => {
  const sim = window.__game.sim;
  const pipe = window.__game.world.items.pipe;
  const bottle = window.__game.world.items.bottle;
  return {
    sim: {held: sim.held, supporting: sim.supporting, mode: sim.mode, progress: sim.progress},
    pipePos: pipe.position,
    pipeParent: pipe.parent?.name,
    bottlePos: bottle.position
  };
});
console.log('Order 1 state after bottle:', JSON.stringify(s1_info));
await page.screenshot({path: path.join(outDir, 'order1-step2-bottle.png')});

// Order 2: bottle -> pipe
console.log('Testing Order 2: bottle -> pipe');
await reset();
await page.evaluate(() => {
  window.__game.act('bottle');
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(outDir, 'order2-step1-bottle.png')});

await page.evaluate(() => {
  window.__game.act('pipe');
});
await page.waitForTimeout(600);
const s2_info = await page.evaluate(() => {
  const sim = window.__game.sim;
  const pipe = window.__game.world.items.pipe;
  const bottle = window.__game.world.items.bottle;
  return {
    sim: {held: sim.held, supporting: sim.supporting, mode: sim.mode, progress: sim.progress},
    pipePos: pipe.position,
    pipeParent: pipe.parent?.name,
    bottlePos: bottle.position
  };
});
console.log('Order 2 state after pipe:', JSON.stringify(s2_info));
await page.screenshot({path: path.join(outDir, 'order2-step2-pipe.png')});

await app.close();
console.log('Done. Errors:', errors);
