import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const outDir = path.resolve(process.argv[2] || 'qa/gh32-evidence');
const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
});

try {
  await page.waitForFunction(() => !!window.__game, {timeout: 180000});
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    window.__game.begin();
    window.__game.setState({phase: 'collect', mode: 'idle', picked: [], stock: 10, water: 0, cap: true, prep: 0, tutorial: false});
  });
  await page.waitForTimeout(2500);

  const session = await createCaptureSession({outDir, page, minTriangles: 1000, minCalls: 1});

  const capture = async (name, yaw, pitch) => {
    await session.capture(name, {
      setup: ({yaw, pitch}) => window.__game.setView(yaw, pitch),
      setupArgs: {yaw, pitch},
      view: {yaw, pitch},
      state: {phase: 'collect', mode: 'idle'}
    });
    console.log(`Captured verified: ${name}.png`);
  };

  // 1. Ground close-up (foreground soil and microtopography between player and slab)
  await capture('01-ground-close-up', 0, -0.92);
  await capture('01b-ground-close-up-angled', 0.25, -0.85);

  // 2. Interaction clearing edge (clearing perimeter, root crossings, and slab margin)
  await capture('02-clearing-edge', 0.42, -0.52);
  await capture('02b-clearing-edge-left', -0.38, -0.52);

  // 3. Creek bank (sloped banks, erosion lips, bank shelves, and waterline)
  await capture('03-creek-bank', 0.88, -0.38);
  await capture('03b-creek-bank-shelf', 1.15, -0.32);

  // 4. Midground (forest floor knolls, hollows, nurse logs, and rock outcroppings)
  await capture('04-midground', -0.75, -0.22);
  await capture('04b-midground-forward', 0, -0.20);

  const manifest = await session.finalize({
    warning: 'GH-32 real 3D meso-scale terrain breakup verification fixtures.',
    errors,
    extraMeta: {
      scope: 'GH-32 real 3D meso-scale terrain breakup (local rises/depressions, exposed root ridges, erosion lips, embedded stones, disturbed soil)'
    }
  });

  console.log(JSON.stringify({outDir, summary: manifest.summary, errors}, null, 2));
} finally {
  await app.close();
}
