import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const out = path.resolve('../qa/baseline');

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

try {
  await page.waitForFunction(() => !!window.__game, {timeout: 180000});
  await page.waitForTimeout(2000);

  const session = await createCaptureSession({
    outDir: out,
    page,
    minTriangles: 1000,
    minCalls: 1
  });

  async function capture(name, setup) {
    await session.capture(name, {
      setup: setup || null
    });
    console.log(`Captured verified: ${name}.png`);
  }

  // 1. Camera sweep baseline (Idle clearing)
  await capture('01-default-forward', () => {
    window.__game.begin();
    window.__game.setView(0, -0.265);
    window.__game.setState({phase: 'collect', mode: 'idle', picked: []});
  });

  await capture('02-look-left-stream', () => {
    window.__game.setView(0.75, -0.2);
  });

  await capture('03-look-sharp-left', () => {
    window.__game.setView(1.5, -0.15);
  });

  await capture('04-look-right-forest', () => {
    window.__game.setView(-0.85, -0.15);
  });

  await capture('05-look-sharp-right', () => {
    window.__game.setView(-1.6, -0.1);
  });

  await capture('06-look-down-ground', () => {
    window.__game.setView(0, -0.95);
  });

  await capture('07-look-up-canopy', () => {
    window.__game.setView(0, 0.65);
  });

  await capture('08-look-rear-left', () => {
    window.__game.setView(2.6, -0.1);
  });

  await capture('09-look-rear-right', () => {
    window.__game.setView(-2.6, -0.1);
  });

  // 2. Interaction poses baseline
  await capture('10-held-lighter-heating', () => {
    window.__game.setView(0, -0.265);
    window.__game.setState({phase: 'heat', mode: 'heat', prep: 0, cap: false, heat: 0.4, angle: 45});
    window.__game.input.x = innerWidth * 0.52;
    window.__game.input.y = innerHeight * 0.48;
  });

  await capture('11-bottle-hole-pose-current', () => {
    window.__game.setView(0, -0.265);
    window.__game.setState({phase: 'hole', mode: 'hole', prep: 1, cap: false, progress: 0.3, angle: 45});
    window.__game.input.x = innerWidth * 0.48;
    window.__game.input.y = innerHeight * 0.52;
  });

  await capture('12-refill-current', () => {
    window.__game.setState({phase: 'free', mode: 'fill', prep: 2, cap: false, water: 0.5, stock: 10, bud: 1});
  });

  const manifest = await session.finalize({
    warning: 'Baseline visual fixtures',
    errors
  });
  console.log(`Baseline capture complete at ${out} (${manifest.summary.totalCaptures} captures, max triangles: ${manifest.summary.maxTriangles.toLocaleString()})`);
} catch (err) {
  console.error(`BASELINE CAPTURE FAILED LOUDLY: ${err.message}`);
  process.exitCode = 1;
  throw err;
} finally {
  await app.close();
}
