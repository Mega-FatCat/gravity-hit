import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCaptureSession } from './qa-capture.mjs';

const outDir = path.resolve('../qa/recovery', process.argv[2] || 'gh12-lighter');
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

  async function shotLighter(name, rotation = [0, 0, 0], center = 0.070, distance = 0.13, yOffset = 0.012) {
    await session.capture(name, {
      setup: ({ rotation, center, distance, yOffset }) => {
        const g = window.__game, w = g.world, o = w.items.lighter;
        Object.assign(g.sim, {
          phase: 'free',
          mode: 'idle',
          prep: 2,
          cap: false,
          water: 0,
          smoke: 0,
          residue: 0,
          bud: 0,
          embers: 0,
          outlet: true
        });
        for (const [key, item] of Object.entries(w.items)) item.visible = key === 'lighter';
        w.trash.visible = false;
        w.spareCap.visible = false;
        w.flame.visible = false;
        w.flameCore.visible = false;
        w.hotTip.visible = false;
        w.bowlBud.visible = false;
        w.outlet.visible = false;
        w.heroProps.update(g.sim);

        o.quaternion.copy(w.camera.quaternion);
        o.rotateX(rotation[0]);
        o.rotateY(rotation[1]);
        o.rotateZ(rotation[2]);
        const anchor = o.position.clone().set(0, center, 0).applyQuaternion(o.quaternion);
        o.position.set(0, yOffset, -distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
        w.scene.updateMatrixWorld(true);
        w.renderer.shadowMap.needsUpdate = true;
        w.render();
      },
      setupArgs: { rotation, center, distance, yOffset },
      state: { rotation, center, distance, yOffset }
    });
    console.log(`Captured verified lighter macro: ${name}`);
  }

  // 5 required macro views for GH-12: front, left, right, top, tilted
  await shotLighter('lighter-macro-front', [0, 0, 0], 0.070, 0.13, 0.012);
  await shotLighter('lighter-macro-left', [0, Math.PI * 0.5, 0], 0.070, 0.13, 0.012);
  await shotLighter('lighter-macro-right', [0, -Math.PI * 0.5, 0], 0.070, 0.13, 0.012);
  await shotLighter('lighter-macro-top', [Math.PI * 0.46, 0, 0], 0.071, 0.11, 0.012);
  await shotLighter('lighter-macro-tilted', [0.35, 0.55, 0.12], 0.070, 0.13, 0.012);

  const manifest = await session.finalize({
    testSuite: 'GH-12 Lighter Top Mechanism Assembly Alignment',
    errors
  });

  console.log(`=== GH-12 CAPTURES FINALIZED: ${manifest?.records?.length || 5} shots ===`);
} finally {
  await app.close();
}
