import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

// Explicit inspection fixtures. These pause state and pose writers to rotate
// each finished prop around its own axes; they are not gameplay verification.
const out = path.resolve('../qa/recovery', process.argv[2] || 'props-pass2');

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

try {
  await page.waitForFunction(() => window.__game && document.querySelector('#begin') && !document.querySelector('#begin').disabled, null, {timeout: 180000});
  await page.click('#begin');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const g = window.__game;
    g.openMenu();
    document.querySelector('#modal').classList.add('hidden');
    document.querySelector('#hud').classList.add('hidden');
    g.world.prepareFrame = () => {};
    g.world.update = () => {};
  });

  const session = await createCaptureSession({
    outDir: out,
    page,
    minTriangles: 100, // Props in isolation have thousands of triangles
    minCalls: 1
  });

  async function shot(name, id, rotation = [0, 0, 0], water = 0, smoke = 0, residue = 0) {
    if (process.argv[3] && !name.includes(process.argv[3])) return;

    await session.capture(name, {
      setup: ({id, rotation, water, smoke, residue}) => {
        const g = window.__game, w = g.world, o = w.items[id];
        Object.assign(g.sim, {phase: 'free', mode: 'idle', prep: 0, cap: true, water, smoke, residue, bud: 0, embers: 0, outlet: water > 0});
        for (const [key, item] of Object.entries(w.items)) item.visible = key === id;
        if (w.trash) w.trash.visible = false;
        if (w.spareCap) w.spareCap.visible = true;
        if (w.flame) w.flame.visible = false;
        if (w.flameCore) w.flameCore.visible = false;
        if (w.hotTip) w.hotTip.visible = false;
        if (w.bowlBud) w.bowlBud.visible = false;
        if (w.outlet) w.outlet.visible = water > 0;
        if (w.items?.pipe) for (const child of w.items.pipe.children) if (w.capmesh && child.material === w.capmesh.material) child.visible = false;
        if (w.heroProps?.update) w.heroProps.update(g.sim);
        const distance = {bottle: 0.48, pipe: 0.30, lighter: 0.20, bag: 0.35}[id] || 0.35, center = {bottle: 0.112, pipe: 0.0115, lighter: 0.04, bag: 0.066}[id] || 0.05;
        o.quaternion.copy(w.camera.quaternion);
        o.rotateX(rotation[0]);
        o.rotateY(rotation[1]);
        o.rotateZ(rotation[2]);
        const anchor = o.position.clone().set(0, center, 0).applyQuaternion(o.quaternion);
        o.position.set(0, 0, -distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
        w.scene.updateMatrixWorld(true);
        w.liquid.update(water, w.time);
        w.liquid.volume.visible = w.liquid.surface.visible = id === 'bottle' && water > 0;
        w.bottleSmoke.visible = id === 'bottle' && smoke > 0;
        const u = w.bottleSmoke.material.uniforms;
        u.uDensity.value = smoke / Math.max(0.06, 1 - water) * 2.6;
        u.uCam.value.copy(w.items.bottle.worldToLocal(w.camera.position.clone()));
        if (w.meltRim) w.meltRim.visible = water > 0;
        w.renderer.shadowMap.needsUpdate = true;
        w.render();
      },
      setupArgs: {id, rotation, water, smoke, residue},
      state: {id, rotation, water, smoke, residue}
    });
    console.log(`Captured verified prop: ${name}`);
  }

  await shot('01-bottle-empty', 'bottle');
  await shot('02-bottle-full', 'bottle', [0, 0, 0], 0.92);
  await shot('03-bottle-water-smoke', 'bottle', [0, 0, 0], 0.16, 0.65);
  await shot('04-bottle-x-tilt', 'bottle', [0.95, 0, 0], 0.48, 0.2);
  await shot('05-bottle-z-tilt', 'bottle', [0, 0, 1.1], 0.48, 0.2);
  await shot('06-bottle-combined-tilt', 'bottle', [0.75, 0.65, 0.85], 0.3, 0.5);
  await shot('07-bottle-bottom', 'bottle', [-1.8, 0.3, 0.1]);
  await shot('08-bottle-back', 'bottle', [0, Math.PI, 0]);
  await shot('09-pipe-front', 'pipe');
  await shot('10-pipe-bowl', 'pipe', [0.65, 0, 0]);
  await shot('11-pipe-bottom', 'pipe', [-1.0, 0.5, 0.3]);
  await shot('12-pipe-residue', 'pipe', [0.3, 0, 0.6], 0, 0, 0.6);
  await shot('13-lighter-front', 'lighter');
  await shot('14-lighter-left', 'lighter', [0, 0.65, 0]);
  await shot('15-lighter-right', 'lighter', [0, -0.65, 0]);
  await shot('16-lighter-back', 'lighter', [0, Math.PI, 0]);
  await shot('17-lighter-bottom', 'lighter', [-1.35, 0.3, 0.1]);
  await shot('18-lighter-tilted', 'lighter', [0.2, 0, 0.78]);
  await shot('19-bag-front', 'bag');
  await shot('20-bag-tilted', 'bag', [0.35, 0.5, 0.15]);

  const manifest = await session.finalize({
    warning: 'Paused, isolated prop inspection fixtures, not gameplay proof.',
    errors
  });
  console.log(`Finalized prop captures at ${out} (${manifest.summary.totalCaptures} captures, max triangles: ${manifest.summary.maxTriangles.toLocaleString()})`);
} catch (err) {
  console.error(`PROP CAPTURE FAILED LOUDLY: ${err.message}`);
  process.exitCode = 1;
  throw err;
} finally {
  await app.close();
}
