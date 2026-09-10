import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || 'qa/gh22-evidence');
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

const views = [
  { name: '01-forward', yaw: 0, pitch: -0.265 },
  { name: '02-side-right', yaw: Math.PI * 0.5, pitch: -0.15 },
  { name: '03-side-left', yaw: -Math.PI * 0.5, pitch: -0.15 },
  { name: '04-rear', yaw: Math.PI, pitch: -0.15 },
  { name: '05-midground-forest', yaw: -0.75, pitch: 0.02 },
  { name: '06-midground-stream', yaw: 0.65, pitch: -0.18 },
  { name: '07-look-up-trunks', yaw: 0, pitch: 0.45 },
  { name: '08-rear-left', yaw: 2.4, pitch: -0.10 }
];

for (const v of views) {
  await page.evaluate(({yaw, pitch}) => {
    window.__game.setView(yaw, pitch);
  }, v);
  await page.waitForTimeout(1000);
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
