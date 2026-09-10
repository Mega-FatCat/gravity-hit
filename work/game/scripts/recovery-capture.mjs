import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const label = process.argv[2] || 'baseline';
const out = path.resolve('../qa/recovery', label);

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

try {
  await page.waitForFunction(() => !!window.__game, null, {timeout: 180000});
  await page.click('#begin');
  const base = {phase: 'collect', mode: 'idle', held: null, supporting: null, picked: [], prep: 0, cap: true, water: 0, smoke: 0, bud: 0, angle: 45, outlet: false};

  const session = await createCaptureSession({
    outDir: out,
    page,
    minTriangles: 1000,
    minCalls: 1
  });

  async function shot(name, state = {}, view = [0, -0.265]) {
    if (process.argv[3] && !process.argv[3].split(',').some(prefix => name.startsWith(prefix))) return;
    await session.capture(name, {
      setup: ({base, state, view}) => {
        const g = window.__game;
        g.setState({...base, ...state});
        g.setView(...view);
        g.input.fire = false;
        g.input.seal = true;
        g.input.x = innerWidth * 0.55;
        g.input.y = innerHeight * 0.48;
      },
      setupArgs: {base, state, view},
      state,
      view
    });
    console.log(`Captured verified: ${name}`);
  }

  for (const [name, yaw, pitch] of [
    ['01-forward', 0, -0.265],
    ['02-left', 0.75, -0.2],
    ['03-far-left', 1.5, -0.15],
    ['04-right', -0.85, -0.15],
    ['05-far-right', -1.6, -0.1],
    ['06-ground', 0, -0.95],
    ['07-canopy', 0, 0.65],
    ['08-rear', Math.PI, -0.15],
    ['09-midground', 0.25, 0.04]
  ]) await shot(name, {}, [yaw, pitch]);

  await shot('10-bottle-held', {held: 'bottle'});
  await shot('11-pipe-held', {held: 'pipe'});
  await shot('12-lighter-held', {held: 'lighter'});
  await shot('13-heat', {phase: 'heat', mode: 'heat', held: 'lighter', supporting: 'pipe', picked: ['pipe', 'lighter'], heat: 0.5});
  await shot('14-press', {phase: 'press', mode: 'press', held: 'bottle', supporting: 'pipe', picked: ['pipe', 'lighter'], progress: 0.5});
  await shot('15-unscrew', {phase: 'unscrew', mode: 'unscrew', held: 'bottle', prep: 1, cap: true, progress: 0.4});
  await shot('16-hole', {phase: 'hole', mode: 'hole', held: 'lighter', supporting: 'bottle', prep: 1, cap: false, progress: 0.3});
  await shot('17-pack', {phase: 'free', mode: 'pack', held: 'bag', prep: 2, cap: false, outlet: true});
  await shot('18-fill', {phase: 'free', mode: 'fill', held: 'bottle', prep: 2, cap: false, outlet: true, water: 0.5});
  await shot('19-full', {phase: 'free', held: 'bottle', prep: 2, cap: true, outlet: true, water: 0.9, bud: 1});
  await shot('20-smoke', {phase: 'free', held: 'bottle', prep: 2, cap: true, outlet: true, water: 0.16, smoke: 0.65, bud: 0.4, embers: 0.3});
  await shot('21-ignite', {phase: 'free', mode: 'ignite', held: 'lighter', supporting: 'bottle', prep: 2, cap: true, outlet: true, water: 0.4, smoke: 0.4, bud: 0.7, embers: 0.2});
  await shot('22-upgraded', {phase: 'free', day: 2, stock: 1000, prep: 2, cap: false, outlet: true});

  const manifest = await session.finalize({
    warning: 'Explicit visual fixtures, not gameplay proof',
    errors
  });
  console.log(`Finalized QA capture for "${label}" at ${out} (${manifest.summary.totalCaptures} captures, max triangles: ${manifest.summary.maxTriangles.toLocaleString()})`);
} catch (err) {
  console.error(`QA CAPTURE FAILED LOUDLY: ${err.message}`);
  process.exitCode = 1;
  throw err;
} finally {
  await app.close();
}
