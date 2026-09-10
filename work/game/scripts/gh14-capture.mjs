import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCaptureSession } from './qa-capture.mjs';

const outDir = path.resolve('../qa/recovery', process.argv[2] || 'gh14-bottle');
await fs.mkdir(outDir, { recursive: true });

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
  await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
  await page.click('#begin');
  await page.waitForTimeout(600);

  // Freeze world update during staged prop shots
  await page.evaluate(() => {
    const g = window.__game;
    g.openMenu();
    document.querySelector('#modal').classList.add('hidden');
    document.querySelector('#hud').classList.add('hidden');
    window.__origPrepare = g.world.prepareFrame;
    window.__origUpdate = g.world.update;
    g.world.prepareFrame = () => {};
    g.world.update = () => {};
  });

  const session = await createCaptureSession({
    outDir,
    page,
    minTriangles: 100,
    minCalls: 1
  });

  async function shotBottle(name, {
    rotation = [0, 0, 0],
    center = 0.112,
    distance = 0.44,
    yOffset = 0.0,
    water = 0,
    smoke = 0,
    prep = 0,
    cap = true,
    held = false
  } = {}) {
    await session.capture(name, {
      setup: ({ rotation, center, distance, yOffset, water, smoke, prep, cap, held }) => {
        const g = window.__game, w = g.world, o = w.items.bottle;
        Object.assign(g.sim, {
          phase: held ? 'free' : 'free',
          mode: 'idle',
          prep,
          cap,
          water,
          smoke,
          residue: 0,
          bud: 0,
          embers: 0,
          outlet: water > 0 || prep >= 2,
          held: held ? 'bottle' : null,
          supporting: null
        });

        for (const [key, item] of Object.entries(w.items)) item.visible = key === 'bottle';
        w.trash.visible = false;
        w.spareCap.visible = prep === 0 && cap;
        w.flame.visible = false;
        w.flameCore.visible = false;
        w.hotTip.visible = false;
        w.bowlBud.visible = false;
        w.outlet.visible = g.sim.outlet;
        if (w.meltRim) w.meltRim.visible = g.sim.outlet;
        w.heroProps.update(g.sim);

        if (held) {
          // Live camera-relative held pose matching interaction-view.js
          const b = new (w.camera.position.constructor)(-0.08, -0.15, -0.64);
          o.quaternion.copy(w.camera.quaternion);
          o.position.copy(b).applyQuaternion(w.camera.quaternion).add(w.camera.position);
        } else {
          o.quaternion.copy(w.camera.quaternion);
          o.rotateX(rotation[0]);
          o.rotateY(rotation[1]);
          o.rotateZ(rotation[2]);
          const anchor = o.position.clone().set(0, center, 0).applyQuaternion(o.quaternion);
          o.position.set(0, yOffset, -distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
        }

        w.scene.updateMatrixWorld(true);
        w.liquid.update(water, w.time);
        w.liquid.volume.visible = w.liquid.surface.visible = water > 0.002;
        w.bottleSmoke.visible = smoke > 0.002;
        const u = w.bottleSmoke.material.uniforms;
        u.uDensity.value = smoke / Math.max(0.06, 1 - water) * 2.6;
        u.uCam.value.copy(o.worldToLocal(w.camera.position.clone()));
        w.renderer.shadowMap.needsUpdate = true;
        w.render();
      },
      setupArgs: { rotation, center, distance, yOffset, water, smoke, prep, cap, held },
      state: { rotation, center, distance, yOffset, water, smoke, prep, cap, held }
    });
    console.log(`Captured verified bottle view: ${name}`);
  }

  // 1. Empty bottle front view: molded ribs, shoulder dome, thin shell response
  await shotBottle('01-bottle-empty', { rotation: [0, 0, 0], center: 0.112, distance: 0.44 });

  // 2. Full bottle view: water inside thin PET ribbed container
  await shotBottle('02-bottle-full', { rotation: [0, 0, 0], center: 0.112, distance: 0.44, water: 0.92 });

  // 3. Back view: mold parting seam, back label with mineral analysis & barcode, glue seam
  await shotBottle('03-bottle-back', { rotation: [0, Math.PI, 0], center: 0.112, distance: 0.44 });

  // 4. Bottom view: 5-petal petaloid base, injection sprue gate mark, bottom mold seam
  await shotBottle('04-bottle-bottom', { rotation: [-1.85, 0.25, 0.1], center: 0.05, distance: 0.32, yOffset: 0.01 });

  // 5. Tilted view: specular highlight warping across ribs, flexible shell crinkle
  await shotBottle('05-bottle-tilted', { rotation: [0.75, 0.65, 0.85], center: 0.112, distance: 0.42, water: 0.35, smoke: 0.2 });

  // 6. Held view: first-person hand-held pose in game
  await shotBottle('06-bottle-held', { held: true, water: 0 });

  // 7. Macro close-up: Neck finish, 28mm knurled cap, collar and threads
  await shotBottle('07-bottle-neck-cap', { rotation: [0.15, 0, 0], center: 0.216, distance: 0.17, yOffset: 0.005 });

  // 8. Water & smoke: trapped smoke and water during ritual
  await shotBottle('08-bottle-water-smoke', { rotation: [0, 0, 0], center: 0.112, distance: 0.44, water: 0.25, smoke: 0.70 });

  const manifest = await session.finalize({
    testSuite: 'GH-14 PET Plastic Bottle Model and Material',
    errors
  });

  console.log(`=== GH-14 CAPTURES FINALIZED: ${manifest?.records?.length || 8} shots ===`);
} finally {
  await app.close();
}
