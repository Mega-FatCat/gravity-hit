import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const outDir = path.resolve('qa/gh15-bud-verification');
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

  // 1. INDIVIDUAL NUG CLOSE-UP:
  // Macro close-up shot of the botanical bud asset in natural lighting
  console.log('Capturing 01_individual_nug_closeup...');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    const T = g.THREE;
    const {createBudGeometry, createBudMaterial} = g.bud;

    if (!w.heroInspectionNug) {
      const geo = createBudGeometry({seed: 777, scale: 0.85, calyxCount: 46, leafCount: 16, pistilCount: 24});
      const mat = createBudMaterial();
      const mesh = new T.Mesh(geo, mat);
      mesh.name = 'heroInspectionNug';
      w.scene.add(mesh);
      w.heroInspectionNug = mesh;
    }

    g.setState({phase: 'collect', mode: 'idle', held: null, supporting: null});
    g.setView(0, -0.2);

    // Position inspection nug 5.5cm directly in front of camera
    const cam = w.camera;
    const offset = new T.Vector3(0, -0.003, -0.055).applyQuaternion(cam.quaternion);
    w.heroInspectionNug.position.copy(cam.position).add(offset);
    w.heroInspectionNug.quaternion.copy(cam.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(0.2, 0.45, -0.1)));
    w.heroInspectionNug.visible = true;
    w.scene.updateMatrixWorld(true);
  });
  await page.waitForTimeout(800);
  await page.screenshot({path: path.join(outDir, '01_individual_nug_closeup.png')});

  // 1b. INDIVIDUAL NUG OBLIQUE / TURNTABLE:
  console.log('Capturing 01b_individual_nug_angle...');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    const T = g.THREE;
    const cam = w.camera;
    const offset = new T.Vector3(0, -0.003, -0.055).applyQuaternion(cam.quaternion);
    w.heroInspectionNug.position.copy(cam.position).add(offset);
    w.heroInspectionNug.quaternion.copy(cam.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(0.35, 2.3, 0.25)));
    w.scene.updateMatrixWorld(true);
  });
  await page.waitForTimeout(800);
  await page.screenshot({path: path.join(outDir, '01b_individual_nug_angle.png')});

  // 1c. INDIVIDUAL NUG STUDIO MACRO (isolated clean backdrop):
  console.log('Capturing 01c_individual_nug_studio...');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    const T = g.THREE;
    const {createBudGeometry, createBudMaterial} = g.bud;

    const studioScene = new T.Scene();
    studioScene.background = new T.Color('#141c15');

    const amb = new T.AmbientLight('#a0b894', 1.6);
    studioScene.add(amb);
    const sun = new T.DirectionalLight('#fff2dc', 2.8);
    sun.position.set(1.5, 2.8, 2.0);
    studioScene.add(sun);
    const rim = new T.DirectionalLight('#82b278', 1.5);
    rim.position.set(-2.0, 1.2, -1.8);
    studioScene.add(rim);

    const geo = createBudGeometry({seed: 777, scale: 0.85, calyxCount: 46, leafCount: 16, pistilCount: 24});
    const mat = createBudMaterial();
    const mesh = new T.Mesh(geo, mat);
    mesh.rotation.set(0.25, 0.55, -0.1);
    studioScene.add(mesh);

    const cam = new T.PerspectiveCamera(28, innerWidth / innerHeight, 0.001, 1);
    cam.position.set(0, 0, 0.021);
    cam.lookAt(0, 0, 0);

    w._origPrepare = w.prepareFrame;
    w.prepareFrame = () => {};
    w.renderer.render(studioScene, cam);
    w._studioScene = studioScene;
    w._studioCam = cam;
  });
  await page.waitForTimeout(600);
  await page.screenshot({path: path.join(outDir, '01c_individual_nug_studio.png')});

  // Restore main scene
  await page.evaluate(() => {
    const w = window.__game.world;
    if (w._origPrepare) {
      w.prepareFrame = w._origPrepare;
      delete w._origPrepare;
    }
    if (w.heroInspectionNug) w.heroInspectionNug.visible = false;
  });

  // 2. BAG / SLAB: Bag resting on stone slab with realistic botanical nugs
  console.log('Capturing 02_bag_slab...');
  await page.evaluate(() => {
    const g = window.__game;
    g.setState({phase: 'collect', mode: 'idle', held: null, supporting: null});
    g.setView(-0.58, -0.44);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({path: path.join(outDir, '02_bag_slab.png')});

  // 3. DRAGGING / LOADING: Pack minigame with the new botanical bud asset
  console.log('Capturing 03_dragging_loading...');
  await page.evaluate(() => {
    const g = window.__game;
    g.setState({
      phase: 'free',
      mode: 'pack',
      held: 'bag',
      supporting: 'pipe',
      prep: 2,
      outlet: true,
      cap: false,
      bud: 0,
      stock: 10
    });
    // Position nug in transit midway between bag and pipe opening
    const nug = document.getElementById('nug');
    if (nug) {
      nug.style.left = '42%';
      nug.style.top = '49%';
    }
  });
  await page.waitForTimeout(1200);
  await page.screenshot({path: path.join(outDir, '03_dragging_loading.png')});

  // 4. LOADED BOWL: Normal in-game held pipe pose
  console.log('Capturing 04_loaded_bowl...');
  await page.evaluate(() => {
    const g = window.__game;
    g.setState({
      phase: 'free',
      mode: 'idle',
      held: 'pipe',
      supporting: null,
      prep: 2,
      outlet: true,
      cap: false,
      bud: 1,
      stock: 9,
      embers: 0
    });
  });
  await page.waitForTimeout(1200);
  await page.screenshot({path: path.join(outDir, '04_loaded_bowl.png')});

  // 4b. LOADED BOWL CLOSE-UP: Macro inspection peering directly into the bowl
  console.log('Capturing 04b_loaded_bowl_closeup...');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    const T = g.THREE;
    const pipe = w.items.pipe;
    const cam = w.camera;

    // Freeze prepareFrame temporarily for macro fixture
    w._origPrepare = w.prepareFrame;
    w.prepareFrame = () => {};

    g.setState({
      phase: 'free',
      mode: 'idle',
      held: 'pipe',
      supporting: null,
      prep: 2,
      outlet: true,
      cap: false,
      bud: 1,
      stock: 9,
      embers: 0
    });

    // Bring pipe bowl 10cm from lens and tilt 38 degrees to look inside bowl
    const distance = 0.10;
    const bowlCenter = 0.040;
    pipe.quaternion.copy(cam.quaternion);
    pipe.rotateX(0.42);
    pipe.rotateY(-0.15);
    const anchor = new T.Vector3(0, bowlCenter, 0).applyQuaternion(pipe.quaternion);
    pipe.position.set(0, -0.01, -distance).applyQuaternion(cam.quaternion).add(cam.position).sub(anchor);
    w.scene.updateMatrixWorld(true);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({path: path.join(outDir, '04b_loaded_bowl_closeup.png')});

  // 5. LOADED BOWL WITH EMBER GLOW: Peering into glowing embers
  console.log('Capturing 05_loaded_bowl_ember...');
  await page.evaluate(() => {
    const g = window.__game;
    const w = g.world;
    g.setState({
      phase: 'free',
      mode: 'ignite',
      held: 'pipe',
      supporting: 'lighter',
      prep: 2,
      outlet: true,
      cap: false,
      bud: 1,
      stock: 9,
      embers: 0.90,
      smoke: 0.40
    });
    w.scene.updateMatrixWorld(true);
  });
  await page.waitForTimeout(1000);
  await page.screenshot({path: path.join(outDir, '05_loaded_bowl_ember.png')});

  // Restore prepareFrame
  await page.evaluate(() => {
    const w = window.__game.world;
    if (w._origPrepare) {
      w.prepareFrame = w._origPrepare;
      delete w._origPrepare;
    }
  });

  console.log('Verification captures completed successfully!');
  console.log('Errors logged:', errors);
} finally {
  await app.close();
}
