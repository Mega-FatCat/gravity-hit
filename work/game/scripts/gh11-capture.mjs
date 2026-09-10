import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCaptureSession } from './qa-capture.mjs';

const outDir = path.resolve('../qa/recovery', process.argv[2] || 'gh11-residue');
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

  async function shotProp(name, rotation = [0.25, 0.4, 0.65], residue = 0, center = 0.005, distance = 0.20, yOffset = 0.045) {
    await session.capture(name, {
      setup: ({ rotation, residue, center, distance, yOffset }) => {
        const g = window.__game, w = g.world, o = w.items.pipe;
        Object.assign(g.sim, {
          phase: 'free',
          mode: 'idle',
          prep: 0,
          cap: true,
          water: 0,
          smoke: 0,
          residue,
          bud: 0,
          embers: 0,
          outlet: false
        });
        for (const [key, item] of Object.entries(w.items)) item.visible = key === 'pipe';
        w.trash.visible = false;
        w.spareCap.visible = true;
        w.flame.visible = false;
        w.flameCore.visible = false;
        w.hotTip.visible = false;
        w.bowlBud.visible = false;
        w.outlet.visible = false;
        for (const child of w.items.pipe.children) {
          if (child.material === w.capmesh.material) child.visible = false;
        }
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
      setupArgs: { rotation, residue, center, distance, yOffset },
      state: { rotation, residue, center, distance, yOffset }
    });
    console.log(`Captured verified fixture: ${name}`);
  }

  const levels = [
    { tag: '01-fresh',        res: 0.00 },
    { tag: '02-early-subtle', res: 0.10 },
    { tag: '03-early-mid',    res: 0.25 },
    { tag: '04-mid',          res: 0.50 },
    { tag: '05-mid-late',     res: 0.75 },
    { tag: '06-late-heavy',   res: 0.95 }
  ];

  // 1. Capture staged side and bowl close-ups for all 4 states
  for (const lvl of levels) {
    // Side profile showing entire pipe length
    await shotProp(`${lvl.tag}-side`, [0.25, 0.4, 0.65], lvl.res, 0.005, 0.20, 0.045);
    // Bowl angled macro looking into the combustion cavity
    await shotProp(`${lvl.tag}-bowl`, [0.68, 0.25, 0.05], lvl.res, 0.040, 0.16, 0.035);
  }

  // 2. Unfreeze world and capture first-person held gameplay view
  await page.evaluate(() => {
    const g = window.__game;
    g.closeMenu();
    g.world.prepareFrame = window.__origPrepare;
    g.world.update = window.__origUpdate;
    for (const item of Object.values(g.world.items)) item.visible = true;
    g.world.trash.visible = false;
    g.world.spareCap.visible = false;
    g.world.hotTip.visible = true;
    g.world.bowlBud.visible = false;
    g.world.flame.visible = false;
    g.world.flameCore.visible = false;
    g.world.outlet.visible = false;
    document.querySelector('#hud').classList.remove('hidden');
    g.setView(0, -0.265);
    g.input.fire = false;
    g.input.seal = false;
  });

  for (const lvl of levels) {
    await page.evaluate(({ residue }) => {
      const g = window.__game;
      g.setState({
        phase: 'free',
        mode: 'idle',
        held: 'pipe',
        supporting: null,
        picked: ['pipe'],
        prep: 0,
        cap: false,
        water: 0,
        smoke: 0,
        bud: 0,
        embers: 0,
        residue,
        outlet: false,
        tutorial: false,
        stock: 10
      });
      g.world.poses = {};
    }, { residue: lvl.res });

    await page.waitForTimeout(500);
    await page.waitForFunction(() => {
      const p = window.__game.world.poses?.pipe;
      return p && p.elapsed >= 0.32;
    }, null, { timeout: 20000 });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
    await page.waitForTimeout(200);

    await session.capture(`${lvl.tag}-held`, {
      state: { held: 'pipe', residue: lvl.res }
    });
    console.log(`Captured verified held: ${lvl.tag}-held`);
  }

  const manifest = await session.finalize({
    testSuite: 'GH-11 Progressive Pipe Residue',
    levels,
    errors
  });

  console.log(`=== GH-11 CAPTURES FINALIZED: ${manifest?.records?.length || 12} shots ===`);
} finally {
  await app.close();
}
