import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const outDir = path.resolve('qa/gh16-bag-verification');
await fs.mkdir(outDir, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.waitForFunction(() => !!window.__game, null, {timeout: 180000});
  await page.evaluate(() => {
    window.__game.begin();
    document.querySelector('#hud')?.classList.remove('hidden');
  });
  await page.waitForTimeout(2000);

  const stats = await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    return {
      contents: w.bagNugs.length,
      variants: w.bagGeos.length,
      film: w.bagFilm?.geometry?.attributes?.position?.count || 0,
      stock: g.sim.stock
    };
  });
  console.log('GH-16 bag stats:', JSON.stringify(stats));

  console.log('Capturing 01_bag_closeup...');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    const T = g.THREE;
    const bag = w.items.bag;
    const cam = w.camera;
    w._gh16 = {
      pos: bag.position.clone(),
      quat: bag.quaternion.clone(),
      prepare: w.prepareFrame
    };
    g.setState({phase: 'collect', mode: 'idle', held: null, supporting: null, stock: 10});
    g.setView(-0.08, -0.30);
  });
  await page.waitForTimeout(900);
  await page.evaluate(() => {
    const w = window.__game.world;
    const T = window.__game.THREE;
    const bag = w.items.bag;
    const cam = w.camera;
    w.prepareFrame = () => {};
    const offset = new T.Vector3(0, -0.012, -0.20).applyQuaternion(cam.quaternion);
    bag.position.copy(cam.position).add(offset);
    bag.quaternion.copy(cam.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(-0.08, 0.18, 0.04)));
    w.scene.updateMatrixWorld(true);
  });
  await page.waitForTimeout(800);
  await page.screenshot({path: path.join(outDir, '01_bag_closeup.png')});

  console.log('Capturing 02_bag_oblique...');
  await page.evaluate(() => {
    const w = window.__game.world;
    const T = window.__game.THREE;
    const bag = w.items.bag;
    const cam = w.camera;
    const offset = new T.Vector3(0.035, -0.008, -0.20).applyQuaternion(cam.quaternion);
    bag.position.copy(cam.position).add(offset);
    bag.quaternion.copy(cam.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(0.28, 0.85, -0.12)));
    w.scene.updateMatrixWorld(true);
  });
  await page.waitForTimeout(800);
  await page.screenshot({path: path.join(outDir, '02_bag_oblique.png')});

  console.log('Capturing 03_starting_scene...');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    if (w._gh16?.prepare) {
      w.prepareFrame = w._gh16.prepare;
      delete w._gh16.prepare;
    }
    if (w._gh16) {
      w.items.bag.position.copy(w._gh16.pos);
      w.items.bag.quaternion.copy(w._gh16.quat);
      delete w._gh16;
    }
    g.setState({phase: 'collect', mode: 'idle', held: null, supporting: null, stock: 10});
    g.setView(0, -0.265);
    w.scene.updateMatrixWorld(true);
  });
  await page.waitForTimeout(1400);
  await page.screenshot({path: path.join(outDir, '03_starting_scene.png')});

  console.log('Verification captures completed successfully!');
  console.log('Errors logged:', errors);
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await app.close();
}