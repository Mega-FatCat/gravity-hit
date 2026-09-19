import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

// Live Electron fixture: keep the bottle held, move the in-game view, and
// record how the water surface responds. This is runtime evidence, not a
// hand-authored or paused prop pose.
const out = path.resolve('../qa/recovery/liquid-motion-live');
const startupTimeout = Number(process.argv.find(arg => arg.startsWith('--startup-timeout='))?.split('=')[1] || 180000);
const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
const browserErrors = [];
const failedRequests = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', message => {
  if (message.type() === 'error') browserErrors.push(message.text().slice(0, 500));
});
page.on('requestfailed', request => {
  failedRequests.push({url: request.url(), error: request.failure()?.errorText || 'unknown'});
});

try {
  try {
    await page.waitForFunction(() => window.__game && document.querySelector('#begin') && !document.querySelector('#begin').disabled, null, {timeout: startupTimeout});
  } catch (err) {
    const startup = await page.evaluate(() => ({
      url: location.href,
      readyState: document.readyState,
      progress: document.querySelector('#load-progress')?.style.width || null,
      beginText: document.querySelector('#begin')?.textContent || null,
      beginDisabled: document.querySelector('#begin')?.disabled ?? null,
      gameReady: !!window.__game,
      title: document.title
    })).catch(() => null);
    console.error(`STARTUP DIAGNOSTICS: ${JSON.stringify({startup, pageErrors: errors.slice(0, 25), browserErrors: browserErrors.slice(0, 25), failedRequests: failedRequests.slice(0, 25)})}`);
    throw err;
  }
  await page.click('#begin');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const g = window.__game;
    g.openMenu();
    document.querySelector('#modal').classList.add('hidden');
    document.querySelector('#hud').classList.add('hidden');
    g.setState({
      phase: 'free', mode: 'idle', held: 'bottle', supporting: null,
      prep: 2, cap: false, outlet: true, water: 0.56, flow: 0,
      smoke: 0, seal: true, angle: 0
    });
    g.setView(0, -0.265);
  });

  const session = await createCaptureSession({
    outDir: out,
    page,
    minTriangles: 100,
    minCalls: 1
  });
  const measurements = [];
  const motionSamples = [];

  async function advanceFrames(frames, totalDx = 0) {
    return page.evaluate(({frames, totalDx}) => {
      const g = window.__game, w = g.world, dt = 1 / 60;
      const samples = [];
      for (let i = 0; i < frames; i++) {
        if (totalDx) w.look(totalDx / frames, 0);
        w.prepareFrame(dt, g.sim, g.input, g.settings);
        w.update(dt, g.sim, g.input, g.settings, true);
        if (totalDx) {
          const l = w.liquid;
          const p = w.items.bottle.getWorldPosition(new g.THREE.Vector3());
          samples.push({
            t: w.time,
            held: g.sim.held,
            yaw: w.yaw,
            slope: [l.surfaceCore.sx, l.surfaceCore.sz],
            acceleration: [l.filteredAx, l.filteredAz],
            position: p.toArray()
          });
        }
      }
      w.render();
      return samples;
    }, {frames, totalDx});
  }

  async function capture(name, phase) {
    const state = await page.evaluate(({phase}) => {
      const g = window.__game, w = g.world, l = w.liquid;
      return {
        phase,
        held: g.sim.held,
        water: g.sim.water,
        localSurfaceSlope: [l.surfaceCore.sx, l.surfaceCore.sz],
        worldSurfaceNormal: [...l.surfaceCore.normal],
        filteredWorldAcceleration: [l.filteredAx, l.filteredAz],
        surfaceHeight: l.level,
        bottleWorldPosition: w.items.bottle.getWorldPosition(new g.THREE.Vector3()).toArray(),
        cameraYaw: w.yaw,
        cameraPitch: w.pitch
      };
    }, {phase});
    measurements.push(state);
    await session.capture(name, {state});
    console.log(`${name}: ${JSON.stringify(state)}`);
  }

  // Pause the live loop so the fixture can apply precise 60 Hz steps through
  // the same camera, interaction pose, world, and liquid update methods.
  await advanceFrames(90);
  await capture('01-held-rest', 'settled before movement');

  motionSamples.push(...await advanceFrames(9, 105));
  await capture('02-held-turn', 'midway through a rightward view turn');
  motionSamples.push(...await advanceFrames(9, 105));
  await advanceFrames(60);
  await capture('03-held-settled', 'after slosh settles');

  motionSamples.push(...await advanceFrames(18, -210));
  await capture('04-held-reversal', 'midway through the opposite view turn');
  motionSamples.push(...await advanceFrames(18, -210));
  await advanceFrames(60);
  await capture('05-held-final-settle', 'after opposite slosh settles');

  const peakSlope = Math.max(...motionSamples.map(m => Math.hypot(...m.slope)), ...measurements.map(m => Math.hypot(...m.localSurfaceSlope)));
  const base = measurements[0]?.bottleWorldPosition || [0, 0, 0];
  const peakBottleTravel = Math.max(...motionSamples.map(m => Math.hypot(m.position[0] - base[0], m.position[1] - base[1], m.position[2] - base[2])));
  if (measurements.some(m => m.held !== 'bottle')) {
    throw new Error('Runtime fixture lost the bottle before the movement captures completed');
  }
  if (!(peakBottleTravel > 0.15)) {
    throw new Error(`Held bottle did not move with the view (peak travel ${peakBottleTravel})`);
  }
  if (!(peakSlope > 0.001)) {
    throw new Error(`Held-bottle movement did not produce a measurable water response (peak slope ${peakSlope})`);
  }

  const manifest = await session.finalize({
    warning: 'Live Electron camera-turn fixture with a held bottle; real runtime evidence, not manual human playtest.',
    errors,
    extraMeta: {peakLocalSurfaceSlope: peakSlope, peakBottleTravel, measurements, motionSamples}
  });
  console.log(`Finalized ${manifest.summary.totalCaptures} live held-bottle captures at ${out}`);
} catch (err) {
  console.error(`LIQUID MOTION CAPTURE FAILED: ${err.message}`);
  process.exitCode = 1;
  throw err;
} finally {
  await app.close();
}
