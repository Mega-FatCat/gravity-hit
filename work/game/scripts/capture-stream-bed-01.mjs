import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createCaptureSession} from './qa-capture.mjs';

const outDir = path.resolve('qa/stream-bed-01');
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

  const views = [
    ['01-top-down-shallow-bed', 0.66, -0.68],
    ['02-low-oblique-along-stream', 0.36, -0.14],
    ['03-across-stream', 0.88, -0.29],
    ['04-medium-stone-closeup', 0.68, -0.61],
    ['05-size-mixture-closeup', 0.50, -0.56],
    ['06-underwater-looking-bed', 0.76, -0.74],
    ['08-farther-stream-section', 0.28, -0.09],
    ['09-bank-edge-transition', 0.96, -0.43],
    ['10-left-side-transition', -0.42, -0.39],
    ['11-right-side-transition', 1.08, -0.38]
  ];

  for (const [name, yaw, pitch] of views) {
    await session.capture(name, {
      setup: ({yaw: nextYaw, pitch: nextPitch}) => {
        window.__game.setState({phase: 'free', mode: 'idle', held: null, supporting: null});
        window.__game.setView(nextYaw, nextPitch);
      },
      setupArgs: {yaw, pitch},
      view: {yaw, pitch},
      state: {phase: 'free', mode: 'idle'}
    });
    console.log(`Captured ${name}`);
  }

  await session.capture('07-refill-area', {
    setup: () => {
      window.__game.setState({phase: 'free', mode: 'fill', held: 'bottle', supporting: null, prep: 2, water: 0.2});
      window.__game.world.reach = 1.0;
      window.__game.world.prepareFrame(0.016, window.__game.sim, window.__game.input, window.__game.settings);
    },
    view: {mode: 'fill'},
    state: {phase: 'free', mode: 'fill'}
  });
  console.log('Captured 07-refill-area');

  const streambedMeta = await page.evaluate(() => {
    const world = window.__game?.world;
    let batches = 0;
    let instances = 0;
    let trianglesPerColorPass = 0;
    world?.scene?.traverse?.(o => {
      if (!o?.isInstancedMesh || !String(o.name || '').startsWith('Streambed ')) return;
      batches++;
      instances += o.count || 0;
      const geometryTriangles = ((o.geometry?.index?.count ?? o.geometry?.attributes?.position?.count ?? 0) / 3);
      trianglesPerColorPass += geometryTriangles * (o.count || 0);
    });
    return {
      counts: world?.streambed?.counts || null,
      batches,
      instances,
      trianglesPerColorPass
    };
  });

  const manifest = await session.finalize({
    warning: 'STREAM-BED-01 exact-candidate visual verification captures.',
    errors,
    extraMeta: {
      scope: 'STREAM-BED-01: preserve established stream while adding dominant physically packed medium pebble/small-cobble layer and rebalancing tiny gap fill',
      streambed: streambedMeta
    }
  });

  console.log(JSON.stringify({outDir, streambedMeta, summary: manifest.summary, errors}, null, 2));
} finally {
  await app.close();
}
