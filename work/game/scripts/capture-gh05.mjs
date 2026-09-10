import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const outDir = path.resolve(process.argv[2] || '../qa/recovery/gh05-baseline');
const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});
const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.waitForFunction(() => !!window.__game, {timeout: 180000});
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    window.__game.begin();
    await window.__game.world.ready;
  });
  await page.waitForTimeout(2500);

  const session = await createCaptureSession({
    outDir,
    page,
    minTriangles: 1000,
    minCalls: 1
  });

  const base = {
    phase: 'free',
    mode: 'idle',
    held: 'bottle',
    supporting: null,
    picked: ['bottle'],
    prep: 2,
    cap: true,
    outlet: true,
    bud: 0.4,
    embers: 0.2,
    tutorial: false,
    stock: 10
  };

  async function shot(name, state = {}, view = [0, -0.265]) {
    await session.capture(name, {
      setup: ({base, state, view}) => {
        const g = window.__game;
        g.setState({...base, ...state});
        g.setView(...view);
        g.input.fire = false;
        g.input.seal = true;
      },
      setupArgs: {base, state, view},
      state,
      view
    });
    console.log(`Captured verified: ${name}`);
  }

  // 1. 25% smoke state (~25% of headspace)
  // headspace = 1 - 0.16 = 0.84. 0.84 * 0.25 = 0.21
  await shot('01-smoke-25pct', {water: 0.16, smoke: 0.21});

  // 2. 50% smoke state (~50% of headspace)
  // 0.84 * 0.50 = 0.42
  await shot('02-smoke-50pct', {water: 0.16, smoke: 0.42});

  // 3. 75% smoke state (~75% of headspace)
  // 0.84 * 0.75 = 0.63
  await shot('03-smoke-75pct', {water: 0.16, smoke: 0.63});

  // 4. Near-full smoke state (~95% of headspace)
  // 0.84 * 0.95 = 0.80
  await shot('04-smoke-near-full', {water: 0.16, smoke: 0.80});

  // 5. Half water (water: 0.50), verifying water readability vs smoke headspace readability
  // headspace = 0.50. 0.50 * 0.75 = 0.375
  await shot('05-smoke-half-water', {water: 0.50, smoke: 0.375});

  // 6. Bottle resting on slab with 75% smoke
  await shot('06-smoke-resting-slab', {held: null, water: 0.16, smoke: 0.63});

  const manifest = await session.finalize({
    warning: 'GH-05 smoke visual density verification captures.',
    errors,
    extraMeta: {scope: 'GH-05 smoke density / opacity / compositing'}
  });
  console.log(JSON.stringify({outDir, summary: manifest.summary, errors}, null, 2));
} finally {
  await app.close();
}
