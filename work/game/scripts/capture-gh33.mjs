import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const outDir = path.resolve(process.argv[2] || 'qa/gh33-evidence');
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

  // 1. Close ground view looking directly down into foreground loam clutter (sticks, twigs, bark, leaves, stones, pine cones)
  await capture('01-ground-close-up', 0, -0.92);
  await capture('01b-ground-close-up-angled', 0.28, -0.82);

  // 2. Normal player-height view (looking at the clearing, slab, and forest floor)
  await capture('02-player-height-normal', 0, -0.265);
  await capture('02b-player-height-slight-down', 0, -0.42);

  // 3. Ritual slab edge & perimeter collar (verifying clutter accumulation at base, 100% clean slab top)
  await capture('03-slab-perimeter-collar', 0.45, -0.52);
  await capture('03b-slab-perimeter-left', -0.40, -0.52);

  // 4. Creek bank and stream wrack line
  await capture('04-creek-bank-wrack', 0.88, -0.38);

  // 5. Midground forest floor view
  await capture('05-midground-forest-floor', -0.75, -0.22);

  const manifest = await session.finalize({
    warning: 'GH-33 physical forest-floor clutter verification fixtures.',
    errors,
    extraMeta: {
      scope: 'GH-33 physical forest-floor clutter (sticks, twigs, bark plates, small stones, leaf piles, pine cones, organic clustering)'
    }
  });

  console.log(JSON.stringify({outDir, summary: manifest.summary, errors}, null, 2));
} finally {
  await app.close();
}
