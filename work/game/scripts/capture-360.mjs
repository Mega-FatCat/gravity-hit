import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || 'qa/gh27-360-baseline');
await fs.mkdir(outDir, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
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
  window.__game.setState({phase: 'collect', mode: 'idle', picked: [], stock: 10, water: 0, cap: true, prep: 0, tutorial: false});
});
await page.waitForTimeout(2500);

// 8 cardinal and intercardinal directions at level and ground angles
const angles = [
  { name: '01-north-forward', yaw: 0, pitch: -0.15 },
  { name: '02-north-ground', yaw: 0, pitch: -0.45 },
  { name: '03-northeast-stream', yaw: 0.785, pitch: -0.18 },
  { name: '04-east-stream-bank', yaw: 1.57, pitch: -0.22 },
  { name: '05-southeast-rear-stream', yaw: 2.35, pitch: -0.15 },
  { name: '06-south-rear', yaw: 3.14, pitch: -0.18 },
  { name: '07-southwest-rear-forest', yaw: -2.35, pitch: -0.15 },
  { name: '08-west-forest', yaw: -1.57, pitch: -0.15 },
  { name: '09-northwest-forest-mid', yaw: -0.785, pitch: -0.12 }
];

for (const v of angles) {
  await page.evaluate(({yaw, pitch}) => {
    window.__game.setView(yaw, pitch);
  }, v);
  await page.waitForTimeout(800);
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)));
  }
  await page.screenshot({path: path.join(outDir, v.name + '.png')});
  console.log('Captured:', v.name);
}

const stats = await page.evaluate(() => {
  const r = window.__game.world.renderer;
  return {
    triangles: r.info.render.triangles,
    calls: r.info.render.calls,
    counts: window.__game.world.environmentCounts
  };
});
console.log('Render stats:', stats);
console.log('Errors:', errors);

await app.close();
