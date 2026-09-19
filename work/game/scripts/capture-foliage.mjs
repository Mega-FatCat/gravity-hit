import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve(process.argv[2] || 'qa/foliage-density/baseline');
await fs.mkdir(outDir, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => console.error('PAGE ERROR:', e));
page.on('console', m => { if (m.type() === 'error') console.error('PAGE LOG ERROR:', m.text()); });

try {
  await page.waitForFunction(() => !!window.__game, null, {timeout: 180000});
  await page.waitForTimeout(2000);

  await page.evaluate(async () => {
    const g = window.__game;
    await g.world.ready;
    g.begin();
    g.settings.wind = 0;
    g.settings.motion = false;
    g.setState({phase: 'collect', mode: 'idle', picked: [], stock: 10, water: 0, cap: true, prep: 0, tutorial: false});
  });
  await page.waitForTimeout(2000);

  const angles = [
    { name: '01-player-default', yaw: 0, pitch: -0.265 },
    { name: '02-north-forward-deep', yaw: 0, pitch: -0.05 },
    { name: '03-stream-left-downstream', yaw: 0.75, pitch: -0.15 },
    { name: '04-stream-far-left', yaw: 1.50, pitch: -0.15 },
    { name: '05-stream-upstream', yaw: 2.40, pitch: -0.15 },
    { name: '06-rear-forest', yaw: 3.14, pitch: -0.15 },
    { name: '07-right-forest-mid', yaw: -0.85, pitch: -0.12 },
    { name: '08-right-forest-far', yaw: -1.60, pitch: -0.12 },
    { name: '09-ground-surrounding', yaw: 0, pitch: -0.60 }
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
  await fs.writeFile(path.join(outDir, 'stats.json'), JSON.stringify(stats, null, 2));
  console.log('Capture stats:', JSON.stringify(stats, null, 2));
} finally {
  await app.close();
}
