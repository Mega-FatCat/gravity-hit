import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const outDir = path.resolve('../qa/gh07-verification');
await fs.mkdir(outDir, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 120000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.waitForFunction(() => !!window.__game, {timeout: 180000});
await page.waitForTimeout(2000);

await page.evaluate(async () => {
  window.__game.begin();
  await window.__game.world.ready;
});
await page.waitForTimeout(2500);

// Helper for full page screenshot including HUD and reticle
async function shot(filename) {
  await page.waitForTimeout(600);
  await page.screenshot({path: path.join(outDir, filename)});
  console.log('Saved', filename);
}

// 1. Before contact: bottle is held in hand, stream is targeted
console.log('1. Capturing before contact...');
await page.evaluate(() => {
  const g = window.__game;
  g.setState({
    phase: 'free',
    mode: 'idle',
    held: 'bottle',
    supporting: null,
    picked: ['bottle'],
    prep: 2,
    cap: false,
    outlet: true,
    water: 0,
    bud: 1,
    stock: 10
  });
  g.setView(0.25, -0.22);
});
await page.waitForTimeout(1000);
await shot('01-before-contact.png');

// 2. Initial immersion: player clicks stream, bottle tilts into stream
console.log('2. Capturing initial immersion...');
await page.evaluate(() => {
  const g = window.__game;
  g.act('stream');
  g.setState({ water: 0.05 });
});
await page.waitForTimeout(1200);
await shot('02-initial-immersion.png');

// 3. Mid-fill: water level at 50%
console.log('3. Capturing mid-fill...');
await page.evaluate(() => {
  const g = window.__game;
  g.setState({ water: 0.50 });
});
await page.waitForTimeout(800);
await shot('03-mid-fill.png');

// 4. Immediately after full: bottle full (water = 1.0), returns to held state
console.log('4. Capturing immediately after full...');
await page.evaluate(() => {
  const g = window.__game;
  // Simulate finishing fill: water reaches 1.0 and mode returns to idle
  g.setState({ water: 1.0, mode: 'idle' });
});
await page.waitForTimeout(1200);
await shot('04-immediately-full.png');

// Verify states and log bottle coordinates in world space during refill
const verifyData = await page.evaluate(() => {
  const g = window.__game;
  const b = g.world.items.bottle;
  b.updateWorldMatrix(true, false);
  const base = new g.world.camera.position.constructor(0, 0, 0);
  const mouth = new g.world.camera.position.constructor(0, 0.226, 0);
  b.localToWorld(base);
  b.localToWorld(mouth);
  return {
    held: g.sim.held,
    water: g.sim.water,
    mode: g.sim.mode,
    basePos: { x: base.x, y: base.y, z: base.z },
    mouthPos: { x: mouth.x, y: mouth.y, z: mouth.z }
  };
});
console.log('Verification data immediately after full:', verifyData);

await app.close();
