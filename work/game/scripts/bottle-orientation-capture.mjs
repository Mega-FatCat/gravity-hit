import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright-core';
import {createCaptureSession} from './qa-capture.mjs';

const tag = process.argv.find(arg => arg.startsWith('--tag='))?.split('=')[1] || 'before';
if (!/^[a-z0-9-]+$/i.test(tag)) throw new Error('Use a simple alphanumeric --tag value');
const out = path.resolve(`../qa/recovery/bottle-orientation-${tag}`);
if (fs.existsSync(out)) throw new Error(`Refusing to overwrite existing capture folder: ${out}`);
const startupTimeout = Number(process.argv.find(arg => arg.startsWith('--startup-timeout='))?.split('=')[1] || 180000);
const app = await electron.launch({
  args: ['.', '--qa', '--dev'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

try {
  await page.waitForFunction(() => window.__game && document.querySelector('#begin') && !document.querySelector('#begin').disabled, null, {timeout: startupTimeout});
  await page.click('#begin');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const g = window.__game;
    g.openMenu();
    document.querySelector('#modal').classList.add('hidden');
    document.querySelector('#hud').classList.add('hidden');
  });

  const session = await createCaptureSession({outDir: out, page, minTriangles: 100, minCalls: 1});
  const views = [
    {name: 'center', yaw: 0},
    {name: 'left', yaw: -.12},
    {name: 'right', yaw: .12}
  ];
  const modes = [
    {name: 'held', mode: 'idle'},
    {name: 'fill', mode: 'fill'}
  ];
  const measurements = [];

  async function prepare(mode, yaw) {
    await page.evaluate(({mode, yaw}) => {
      const g = window.__game;
      g.setView(yaw, -.265);
      g.setState({
        phase: 'free', mode, held: 'bottle', supporting: null,
        prep: 2, cap: false, outlet: true, water: .56, flow: 0,
        smoke: 0, seal: false, angle: 0
      });
    }, {mode, yaw});

    await page.evaluate(() => {
      const g = window.__game, w = g.world, dt = 1 / 60;
      for (let i = 0; i < 90; i++) {
        w.prepareFrame(dt, g.sim, g.input, g.settings);
        w.update(dt, g.sim, g.input, g.settings, true);
      }
      w.render();
    });
  }

  for (const mode of modes) {
    for (const view of views) {
      await prepare(mode.mode, view.yaw);
      const name = `${mode.name}-${view.name}`;
      const state = await page.evaluate(({phaseName}) => {
        const g = window.__game, w = g.world, bottle = w.items.bottle;
        const q = bottle.getWorldQuaternion(new g.THREE.Quaternion());
        const axis = new g.THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
        const outlet = w.outlet.getWorldPosition(new g.THREE.Vector3());
        return {
          pose: phaseName,
          mode: g.sim.mode,
          held: g.sim.held,
          water: g.sim.water,
          cameraYaw: w.yaw,
          cameraPitch: w.pitch,
          bottlePosition: bottle.getWorldPosition(new g.THREE.Vector3()).toArray(),
          bottleQuaternion: q.toArray(),
          bottleLongAxisWorld: axis.toArray(),
          outletWorldPosition: outlet.toArray(),
          surfaceSlope: [w.liquid.surfaceCore.sx, w.liquid.surfaceCore.sz],
          surfaceWorldNormal: [...w.liquid.surfaceCore.normal],
          surfaceHeight: w.liquid.level
        };
      }, {phaseName: mode.name});
      measurements.push(state);
      await session.capture(name, {state});
      console.log(`${name}: ${JSON.stringify(state)}`);
    }
  }

  if (measurements.some(m => m.held !== 'bottle' || !Number.isFinite(m.surfaceHeight))) {
    throw new Error('Bottle ownership or water surface measurement was invalid');
  }
  const heldViews = measurements.filter(m => m.pose === 'held');
  const fillViews = measurements.filter(m => m.pose === 'fill');
  if (heldViews.some(m => m.bottleLongAxisWorld[1] < .98)) {
    throw new Error('Held bottle is not nearly vertical in world space');
  }
  if (fillViews.some(m => m.bottleLongAxisWorld[0] > -.9 || m.bottleLongAxisWorld[1] < .3 || m.bottleLongAxisWorld[1] > .36 || Math.abs(m.bottleLongAxisWorld[2]) > .1)) {
    throw new Error('Stream-fill bottle orientation changed from the established pose');
  }
  if (measurements.some(m => m.surfaceWorldNormal[1] < .99)) {
    throw new Error('Bottle water surface is not level with world gravity');
  }
  if (errors.length) throw new Error(`Runtime page errors: ${errors.join('; ')}`);

  const manifest = await session.finalize({
    warning: 'Held and stream-fill bottle poses captured in the live game; automated evidence, not human visual acceptance.',
    errors,
    extraMeta: {measurements}
  });
  console.log(`Finalized ${manifest.summary.totalCaptures} live bottle orientation views at ${out}`);
} catch (err) {
  console.error(`BOTTLE ORIENTATION CAPTURE FAILED: ${err.message}`);
  process.exitCode = 1;
  throw err;
} finally {
  await app.close();
}
