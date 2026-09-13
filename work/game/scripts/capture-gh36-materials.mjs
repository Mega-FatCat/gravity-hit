import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createCaptureSession} from './qa-capture.mjs';

const outDir = path.resolve('qa/gh36-materials');
await fs.mkdir(outDir, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message || String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.waitForFunction(() => !!window.__game, {timeout: 30000});
  await page.waitForTimeout(2500);
  await app.evaluate(({BrowserWindow}) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setContentSize(1920, 1080);
    if (w.showInactive) w.showInactive();
  });
  await page.evaluate(() => {
    window.__game.begin();
    window.__game.setState({phase: 'free', mode: 'idle', held: null, supporting: null, prep: 2, stock: 10, water: 0.3, cap: true, tutorial: false});
    window.__game.world.setQuality('high');
  });
  await page.waitForTimeout(4000);

  const session = await createCaptureSession({outDir, page, minTriangles: 1000, minCalls: 1});
  const capture = (name, yaw, pitch, mode = 'idle') => session.capture(name, {
    setup: ({yaw, pitch, mode}) => {
      window.__game.setState({phase: 'free', mode, held: mode === 'fill' ? 'bottle' : null, supporting: null, prep: 2, water: mode === 'fill' ? 0.2 : 0.3});
      window.__game.setView(yaw, pitch);
      if (mode === 'fill') {
        window.__game.world.reach = 1.0;
        window.__game.world.prepareFrame(0.016, window.__game.sim, window.__game.input, window.__game.settings);
      }
    },
    setupArgs: {yaw, pitch, mode},
    view: {yaw, pitch, mode},
    state: {phase: 'free', mode}
  });

  await capture('01-exposed-bed-edge', 0.52, -0.48);
  await capture('02-shallow-water-bed', 0.72, -0.52);
  await capture('03-oblique-cross-stream', 0.85, -0.28);
  await capture('04-looking-along-bed', 0.38, -0.22);
  await capture('05-refill-shallow-bed', 0.72, -0.52, 'fill');

  const manifest = await session.finalize({
    warning: 'GH-36 streambed material variation captures.',
    errors,
    extraMeta: {
      scope: 'GH-36: gray/brown stones, wet sediment, lighter gravel, restrained moss/algae, and sparse leaf/debris accumulation'
    }
  });
  console.log(JSON.stringify({outDir, summary: manifest.summary, errors}, null, 2));
} finally {
  await app.close();
}
