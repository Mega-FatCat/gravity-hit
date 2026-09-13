import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createCaptureSession} from './qa-capture.mjs';

const outDir = path.resolve('qa/gh35-rebuild');
await fs.mkdir(outDir, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => {
  console.error('PAGE ERROR:', e);
  errors.push(e.message || String(e));
});
page.on('console', m => {
  console.log('PAGE LOG [' + m.type() + ']:', m.text());
  if (m.type() === 'error') errors.push(m.text());
});

try {
  await page.waitForFunction(() => !!window.__game, {timeout: 30000});
  await page.waitForTimeout(2500);

  // Set window size to 1920x1080
  await app.evaluate(({BrowserWindow}) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setContentSize(1920, 1080);
    if (w.showInactive) w.showInactive();
  });

  await page.evaluate(() => {
    window.__game.begin();
    window.__game.setState({phase: 'free', mode: 'idle', held: 'bottle', prep: 2, stock: 10, water: 0.3, cap: true, tutorial: false});
    window.__game.world.setQuality('high');
  });
  await page.waitForTimeout(4000);

  const session = await createCaptureSession({outDir, page, minTriangles: 1000, minCalls: 1});

  // 1. Exposed / dry edge view
  await session.capture('01-exposed-dry-edge', {
    setup: () => {
      window.__game.setState({phase: 'free', mode: 'idle', held: null, supporting: null});
      window.__game.setView(0.52, -0.48);
    },
    view: {yaw: 0.52, pitch: -0.48},
    state: {phase: 'free', mode: 'idle'}
  });
  console.log('Captured 01-exposed-dry-edge');

  // 2. Shallow-water bottom view (looking down into shallow water)
  await session.capture('02-shallow-water-bottom', {
    setup: () => {
      window.__game.setView(0.72, -0.52);
    },
    view: {yaw: 0.72, pitch: -0.52},
    state: {phase: 'free', mode: 'idle'}
  });
  console.log('Captured 02-shallow-water-bottom');

  // 3. Looking along stream (longitudinal channel perspective)
  await session.capture('03-looking-along-stream', {
    setup: () => {
      window.__game.setView(0.38, -0.22);
    },
    view: {yaw: 0.38, pitch: -0.22},
    state: {phase: 'free', mode: 'idle'}
  });
  console.log('Captured 03-looking-along-stream');

  // 4. Looking across stream (from near bank to far bank)
  await session.capture('04-looking-across-stream', {
    setup: () => {
      window.__game.setView(0.85, -0.28);
    },
    view: {yaw: 0.85, pitch: -0.28},
    state: {phase: 'free', mode: 'idle'}
  });
  console.log('Captured 04-looking-across-stream');

  // 5. Refill view (interactive fill mode with bottle submerged)
  await session.capture('05-refill-view', {
    setup: () => {
      window.__game.setState({phase: 'free', mode: 'fill', held: 'bottle', supporting: null, prep: 2, water: 0.2});
      window.__game.world.reach = 1.0;
      window.__game.world.prepareFrame(0.016, window.__game.sim, window.__game.input, window.__game.settings);
    },
    view: {mode: 'fill'},
    state: {phase: 'free', mode: 'fill'}
  });
  console.log('Captured 05-refill-view');

  const manifest = await session.finalize({
    warning: 'GH-35 streambed 3D rebuild verification captures.',
    errors,
    extraMeta: {
      scope: 'GH-35: 3D dense gravel, multi-class pebbles, cobbles, anchor rocks, uneven bed depth, sediment pockets, believable burial'
    }
  });

  console.log(JSON.stringify({outDir, summary: manifest.summary, errors}, null, 2));
} finally {
  await app.close();
}
