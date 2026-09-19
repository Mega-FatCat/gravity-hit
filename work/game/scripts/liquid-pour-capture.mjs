import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

// Deterministic live-game capture of the open-outlet water stream and splash.
const out = path.resolve('../qa/recovery/liquid-pour-live-after2');
const startupTimeout = Number(process.argv.find(arg => arg.startsWith('--startup-timeout='))?.split('=')[1] || 180000);
const app = await electron.launch({
  args: ['.', '--qa'],
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
    g.setView(0, -.265);
    g.setState({
      phase: 'free', mode: 'idle', held: 'bottle', supporting: null,
      prep: 2, cap: false, outlet: true, water: .56, flow: 0,
      smoke: 0, seal: false, angle: 0
    });
  });

  const session = await createCaptureSession({outDir: out, page, minTriangles: 100, minCalls: 1});
  const measurements = [];

  async function state() {
    return page.evaluate(() => {
      const g = window.__game, w = g.world;
      const vector = new g.THREE.Vector3();
      return {
        phase: g.sim.phase,
        mode: g.sim.mode,
        held: g.sim.held,
        water: g.sim.water,
        flow: g.sim.flow,
        surfaceHeight: w.liquid.level,
        outletWorldPosition: w.outlet.getWorldPosition(vector).toArray(),
        jetVisible: w.jet.visible,
        jetVertexCount: w.jet.geometry.attributes.position?.count || 0,
        splashVisible: w.splashRing.visible,
        visibleDrops: w.jetDrops.filter(drop => drop.visible).length,
        splashWorldPosition: w.splashRing.position.toArray()
      };
    });
  }

  async function capture(name) {
    const snapshot = await state();
    measurements.push(snapshot);
    await session.capture(name, {state: snapshot});
    console.log(`${name}: ${JSON.stringify(snapshot)}`);
  }

  async function advance(frames) {
    await page.evaluate(({frames}) => {
      const g = window.__game, w = g.world, dt = 1 / 60;
      for (let i = 0; i < frames; i++) {
        w.prepareFrame(dt, g.sim, g.input, g.settings);
        g.sim.step(dt, g.input);
        w.update(dt, g.sim, g.input, g.settings, true);
      }
      w.render();
    }, {frames});
  }

  async function settleHeldPose(frames) {
    await page.evaluate(({frames}) => {
      const g = window.__game, w = g.world, dt = 1 / 60;
      for (let i = 0; i < frames; i++) {
        w.prepareFrame(dt, g.sim, g.input, g.settings);
        w.update(dt, g.sim, g.input, g.settings, true);
      }
      w.render();
    }, {frames});
  }

  await settleHeldPose(90);
  await capture('01-open-outlet-before-flow');
  await advance(1);
  await capture('02-open-outlet-stream-start');
  await advance(45);
  await capture('03-open-outlet-steady-pour');

  const flowing = measurements.filter(m => m.flow > 0 && m.jetVisible && m.jetVertexCount > 0);
  const waterDrop = measurements[1].water - measurements[2].water;
  if (!flowing.length) throw new Error('Open outlet did not produce a rendered water stream');
  if (!(waterDrop > 0)) throw new Error(`Water level did not drain during the live pour (${waterDrop})`);
  if (errors.length) throw new Error(`Runtime page errors: ${errors.join('; ')}`);

  const manifest = await session.finalize({
    warning: 'Deterministic live Electron open-outlet pour fixture; runtime evidence, not human playtest.',
    errors,
    extraMeta: {measurements, waterDrop}
  });
  console.log(`Finalized ${manifest.summary.totalCaptures} live pouring captures at ${out}`);
} catch (err) {
  console.error(`LIQUID POUR CAPTURE FAILED: ${err.message}`);
  process.exitCode = 1;
  throw err;
} finally {
  await app.close();
}
