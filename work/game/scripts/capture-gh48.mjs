import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';
import {createCaptureSession} from './qa-capture.mjs';

const out = path.resolve('qa/gh48-acceptance');
await fs.mkdir(out, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 120000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
});

try {
  await page.waitForFunction(() => !!window.__game, null, {timeout: 180000});
  await page.evaluate(() => {
    window.__game.begin();
    document.querySelector('#modal')?.classList.add('hidden');
    document.querySelector('#hud')?.classList.add('hidden');
  });
  await page.waitForTimeout(1000);

  const session = await createCaptureSession({
    outDir: out,
    page,
    minTriangles: 100,
    minCalls: 1
  });

  // Freeze normal game frame updates so our close-range turntable fixtures are not overwritten
  await page.evaluate(() => {
    const g = window.__game, w = g.world;
    w._realPrepare = w.prepareFrame;
    w._realUpdate = w.update;
    w.prepareFrame = () => {};
    w.update = () => {};
  });

  // Helper for isolated hero prop studio / turntable shots
  async function shotProp(name, id, {rotation = [0, 0, 0], water = 0, smoke = 0, residue = 0, prep = 0, cap = true, bud = 0, embers = 0, showCapOnPipe = false, flame = false, customDistance = null, customCenter = null} = {}) {
    await session.capture(name, {
      setup: ({id, rotation, water, smoke, residue, prep, cap, bud, embers, showCapOnPipe, flame, customDistance, customCenter}) => {
        const g = window.__game, w = g.world, o = w.items[id];
        Object.assign(g.sim, {phase: 'free', mode: 'idle', prep, cap, water, smoke, residue, bud, embers, outlet: water > 0});
        for (const [key, item] of Object.entries(w.items)) item.visible = (key === id);
        if (w.heroInspectionNug) w.heroInspectionNug.visible = false;
        w.trash.visible = false;
        w.spareCap.visible = (id === 'bottle' && cap && prep === 0);
        w.flame.visible = flame;
        w.flameCore.visible = flame;
        w.hotTip.visible = false;
        w.bowlBud.visible = (id === 'pipe' && bud > 0);
        w.outlet.visible = (id === 'bottle' && water > 0);

        if (id === 'pipe') {
          for (const child of w.items.pipe.children) {
            if (child.material === w.capmesh.material) child.visible = showCapOnPipe;
          }
          if (w.pipeGrommet) w.pipeGrommet.visible = showCapOnPipe;
        }

        w.heroProps.update(g.sim);
        const defDistance = {bottle: 0.42, pipe: 0.22, lighter: 0.16, bag: 0.25}[id];
        const defCenter = {bottle: 0.112, pipe: 0.0115, lighter: 0.042, bag: 0.06}[id];
        const distance = customDistance ?? defDistance;
        const center = customCenter ?? defCenter;

        o.quaternion.copy(w.camera.quaternion);
        o.rotateX(rotation[0]);
        o.rotateY(rotation[1]);
        o.rotateZ(rotation[2]);
        const anchor = o.position.clone().set(0, center, 0).applyQuaternion(o.quaternion);
        o.position.set(0, 0, -distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
        w.scene.updateMatrixWorld(true);

        w.liquid.update(water, w.time);
        w.liquid.volume.visible = w.liquid.surface.visible = (id === 'bottle' && water > 0);
        w.bottleSmoke.visible = (id === 'bottle' && smoke > 0);
        if (w.bottleSmoke.visible) {
          const u = w.bottleSmoke.material.uniforms;
          u.uDensity.value = smoke / Math.max(0.06, 1 - water) * 2.6;
          u.uCam.value.copy(w.items.bottle.worldToLocal(w.camera.position.clone()));
        }
        if (w.meltRim) w.meltRim.visible = (id === 'bottle' && water > 0);
        if (flame) {
          w.flameLight.intensity = 0.025;
          if (w.nozzle) w.flame.position.copy(w.nozzle);
          w.flame.quaternion.copy(w.items.lighter.quaternion).invert().multiply(new g.THREE.Quaternion().setFromEuler(new g.THREE.Euler(0, w.camera.rotation.y, 0)));
          if (w.flame.material?.uniforms?.time) w.flame.material.uniforms.time.value = 1.5;
        } else {
          w.flameLight.intensity = 0;
        }

        w.scene.updateMatrixWorld(true);
        w.renderer.shadowMap.needsUpdate = true;
        w.render();
      },
      setupArgs: {id, rotation, water, smoke, residue, prep, cap, bud, embers, showCapOnPipe, flame, customDistance, customCenter},
      state: {id, rotation, water, smoke, residue, prep, cap, bud, embers}
    });
    console.log(`Captured: ${name}`);
  }

  console.log('--- 1. BOTTLE ACCEPTANCE VIEWS ---');
  // 1. empty
  await shotProp('01-bottle-empty', 'bottle');
  // 2. full
  await shotProp('02-bottle-full', 'bottle', {water: 0.92});
  // 3. smoke
  await shotProp('03-bottle-smoke', 'bottle', {water: 0.15, smoke: 0.70});
  // 4. tilted
  await shotProp('04-bottle-tilted', 'bottle', {rotation: [0.75, 0.45, 0.65], water: 0.35, smoke: 0.45});
  // 5. bottom
  await shotProp('05-bottle-bottom', 'bottle', {rotation: [-1.82, 0.28, 0.12], customCenter: 0.015, customDistance: 0.26});
  // 6. back
  await shotProp('06-bottle-back', 'bottle', {rotation: [0, Math.PI, 0]});

  console.log('--- 2. PIPE ACCEPTANCE VIEWS ---');
  // 7. front (clean borosilicate one-hitter)
  await shotProp('07-pipe-front', 'pipe', {rotation: [0, 0, 0]});
  // 8. side (profile view showing flared bowl, straight body, mouthpiece lip)
  await shotProp('08-pipe-side', 'pipe', {rotation: [0, Math.PI * 0.5, 0]});
  // 9. bowl (looking straight down into the bowl opening)
  await shotProp('09-pipe-bowl', 'pipe', {rotation: [0.72, 0, 0], customCenter: 0.042, customDistance: 0.14});
  // 10. mouth (looking straight down into the mouthpiece lip)
  await shotProp('10-pipe-mouth', 'pipe', {rotation: [-0.92, 0, 0], customCenter: -0.045, customDistance: 0.14});
  // 11. bottom (stem from below showing passage through cap/collar)
  await shotProp('11-pipe-bottom', 'pipe', {rotation: [-1.2, 0.45, 0.25], showCapOnPipe: true, customCenter: -0.01, customDistance: 0.19});
  // 12. residue (amber / dark resin buildup after use)
  await shotProp('12-pipe-residue', 'pipe', {rotation: [0.25, 0.35, 0.45], residue: 0.65});

  // 13. held (natural in-game first-person held pose)
  await session.capture('13-pipe-held', {
    setup: () => {
      const g = window.__game, w = g.world;
      w.prepareFrame = w._realPrepare;
      w.update = w._realUpdate;
      g.setState({phase: 'free', mode: 'idle', held: 'pipe', supporting: null, prep: 0, cap: false, bud: 0, residue: 0.25});
      for (const [key, item] of Object.entries(w.items)) item.visible = true;
      w.trash.visible = false;
      if (w.heroInspectionNug) w.heroInspectionNug.visible = false;
      for (let s = 0; s < 12; s++) w.prepareFrame(0.04, g.sim, g.input, g.settings);
      w.render();
      w.prepareFrame = () => {};
      w.update = () => {};
    },
    state: {view: 'held-pipe-ingame'}
  });
  console.log('Captured: 13-pipe-held');

  // 14. installed (close-range inspection view of pipe installed on bottle cap on bottle neck)
  await session.capture('14-pipe-installed', {
    setup: () => {
      const g = window.__game, w = g.world, b = w.items.bottle, p = w.items.pipe;
      w.prepareFrame = () => {};
      w.update = () => {};
      Object.assign(g.sim, {phase: 'free', mode: 'idle', prep: 2, cap: true, water: 0.85, smoke: 0, bud: 1});
      for (const [key, item] of Object.entries(w.items)) item.visible = (key === 'bottle' || key === 'pipe');
      w.trash.visible = false;
      w.spareCap.visible = false;
      for (const child of p.children) if (child.material === w.capmesh.material) child.visible = true;
      if (w.pipeGrommet) w.pipeGrommet.visible = true;
      w.bowlBud.visible = true;
      w.heroProps.update(g.sim);

      // Frame bottle neck + cap + pipe assembly in crisp close-up
      const distance = 0.35, center = 0.24;
      b.quaternion.copy(w.camera.quaternion);
      const anchor = b.position.clone().set(0, center, 0).applyQuaternion(b.quaternion);
      b.position.set(0, 0, -distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
      p.position.set(0, 0.226, 0);
      p.quaternion.set(0, 0, 0, 1);
      b.add(p);
      b.updateMatrixWorld(true);
      p.updateMatrixWorld(true);

      w.liquid.update(0.85, w.time);
      w.liquid.volume.visible = w.liquid.surface.visible = true;
      w.scene.updateMatrixWorld(true);
      w.render();
      w.scene.add(p);
      p.updateMatrixWorld(true);
    },
    state: {view: 'installed-pipe-on-bottle'}
  });
  console.log('Captured: 14-pipe-installed');

  console.log('--- 3. LIGHTER ACCEPTANCE VIEWS ---');
  // 15. front
  await shotProp('15-lighter-front', 'lighter', {rotation: [0, 0, 0]});
  // 16. side (showing profile: windscreen on left, wheel in center, lever on right)
  await shotProp('16-lighter-side', 'lighter', {rotation: [0, -Math.PI * 0.5, 0], customDistance: 0.15, customCenter: 0.055});
  // 17. back (rear stanchion ear, rivet, rear vent slot, rear thumb rest)
  await shotProp('17-lighter-back', 'lighter', {rotation: [0, Math.PI, 0]});
  // 18. top (peering down into nozzle orifice, knurled teeth, lever ridges)
  await shotProp('18-lighter-top', 'lighter', {rotation: [1.38, 0, 0], customCenter: 0.072, customDistance: 0.12});
  // 19. bottom (refill valve recess, base mould seam)
  await shotProp('19-lighter-bottom', 'lighter', {rotation: [-1.42, 0.30, 0.10], customCenter: 0.005, customDistance: 0.14});
  // 20. tilted (angled for heating down toward bowl)
  await shotProp('20-lighter-tilted', 'lighter', {rotation: [0.25, 0, 0.78]});

  // 21. standalone lit (macro hero-prop upright framing with active flame)
  await shotProp('21-lighter-standalone-lit', 'lighter', {rotation: [0, 0, 0], flame: true, customDistance: 0.16, customCenter: 0.052});
  console.log('Captured: 21-lighter-standalone-lit');

  // 22. heating (close-up flame contact heating loaded pipe bowl)
  await session.capture('22-lighter-heating', {
    setup: () => {
      const g = window.__game, w = g.world, p = w.items.pipe, l = w.items.lighter, T = g.THREE;
      w.scene.add(p);
      w.scene.add(l);
      w.prepareFrame = () => {};
      w.update = () => {};
      Object.assign(g.sim, {phase: 'free', mode: 'ignite', held: 'pipe', supporting: 'lighter', prep: 2, cap: false, bud: 1, embers: 0.85, smoke: 0.35, angle: 45, flameQuality: 1});
      for (const [key, item] of Object.entries(w.items)) item.visible = (key === 'pipe' || key === 'lighter');
      w.trash.visible = false;
      if (w.heroInspectionNug) w.heroInspectionNug.visible = false;
      w.flame.visible = true;
      w.flameCore.visible = false;
      w.flameLight.intensity = 0.035;
      if (w.flame.material?.uniforms?.time) w.flame.material.uniforms.time.value = 1.5;
      w.bowlBud.visible = true;
      w.emberLight.intensity = 0.02;

      // Position pipe in close inspection view
      const distance = 0.22, center = 0.040;
      p.quaternion.copy(w.camera.quaternion);
      p.rotateX(0.20);
      const anchor = new T.Vector3(0, center, 0).applyQuaternion(p.quaternion);
      p.position.set(-0.02, -0.01, -distance).applyQuaternion(w.camera.quaternion).add(w.camera.position).sub(anchor);
      p.updateMatrixWorld(true);

      // Position lighter angled directly over the pipe bowl, with nozzle/flame touching the bowl opening
      l.quaternion.copy(p.quaternion);
      l.rotateZ(-0.75); // ~45 deg heating angle
      l.rotateY(0.15);
      l.updateMatrixWorld(true);
      const bowlWorld = p.localToWorld(new T.Vector3(0, 0.045, 0));
      const nozzleWorldOffset = (w.nozzle || new T.Vector3(0, 0.072, 0)).clone().applyQuaternion(l.quaternion);
      l.position.copy(bowlWorld).sub(nozzleWorldOffset).sub(new T.Vector3(0, 0.021, 0).applyQuaternion(w.camera.quaternion)).add(new T.Vector3(-0.003, 0, 0).applyQuaternion(w.camera.quaternion));

      if (w.nozzle) w.flame.position.copy(w.nozzle);
      w.flame.quaternion.copy(l.quaternion).invert().multiply(new T.Quaternion().setFromEuler(new T.Euler(0, w.camera.rotation.y, 0)));
      if (w.flame.material?.uniforms?.time) w.flame.material.uniforms.time.value = 1.5;
      p.updateMatrixWorld(true);
      l.updateMatrixWorld(true);
      w.scene.updateMatrixWorld(true);
      w.render();
    },
    state: {view: 'heating-flame-contact'}
  });
  console.log('Captured: 22-lighter-heating');

  console.log('--- 4. WEED ACCEPTANCE VIEWS ---');
  // 23. weed bag (on stone slab resting pose and close-up)
  await shotProp('23-weed-bag', 'bag', {rotation: [0.35, 0.15, 0], customDistance: 0.22, customCenter: 0.065});

  // 24. individual bud (macro botanical bud shot in natural lighting)
  await session.capture('24-weed-individual-bud', {
    setup: () => {
      const g = window.__game, w = g.world, T = g.THREE;
      const {createBudGeometry, createBudMaterial} = g.bud;
      if (!w.heroInspectionNug) {
        const geo = createBudGeometry({seed: 777, scale: 0.88, calyxCount: 48, leafCount: 16, pistilCount: 26});
        const mat = createBudMaterial();
        const mesh = new T.Mesh(geo, mat);
        mesh.name = 'heroInspectionNug';
        w.scene.add(mesh);
        w.heroInspectionNug = mesh;
      }
      for (const item of Object.values(w.items)) item.visible = false;
      w.trash.visible = false;
      const cam = w.camera;
      const offset = new T.Vector3(0, -0.003, -0.055).applyQuaternion(cam.quaternion);
      w.heroInspectionNug.position.copy(cam.position).add(offset);
      w.heroInspectionNug.quaternion.copy(cam.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(0.25, 0.52, -0.12)));
      w.heroInspectionNug.visible = true;
      w.scene.updateMatrixWorld(true);
      w.render();
    },
    state: {view: 'individual-botanical-bud'}
  });
  console.log('Captured: 24-weed-individual-bud');

  // 25. drag / loading (pack minigame in-game view)
  await session.capture('25-weed-drag-loading', {
    setup: () => {
      const g = window.__game, w = g.world;
      w.prepareFrame = w._realPrepare;
      w.update = w._realUpdate;
      if (w.heroInspectionNug) w.heroInspectionNug.visible = false;
      w.scene.add(w.items.pipe);
      w.scene.add(w.items.lighter);
      w.scene.add(w.items.bottle);
      for (const item of Object.values(w.items)) item.visible = true;
      w.trash.visible = false;
      g.setState({phase: 'free', mode: 'pack', held: 'bag', supporting: 'pipe', prep: 2, outlet: true, cap: false, bud: 0, stock: 10});
      for (let s = 0; s < 12; s++) w.prepareFrame(0.04, g.sim, g.input, g.settings);
      document.querySelector('#hud')?.classList.remove('hidden');
      document.querySelector('#packing')?.classList.remove('hidden');
      const nug = document.getElementById('nug');
      if (nug) {
        nug.style.left = '44%';
        nug.style.top = '48%';
      }
      w.render();
      w.prepareFrame = () => {};
      w.update = () => {};
    },
    state: {view: 'drag-loading-pack'}
  });
  console.log('Captured: 25-weed-drag-loading');

  // 26. loaded bowl (macro close-up peering directly into the packed chillum bowl)
  await session.capture('26-weed-loaded-bowl', {
    setup: () => {
      const g = window.__game, w = g.world, T = g.THREE;
      if (w.heroInspectionNug) w.heroInspectionNug.visible = false;
      document.querySelector('#hud')?.classList.add('hidden');
      document.querySelector('#packing')?.classList.add('hidden');
      for (const [key, item] of Object.entries(w.items)) item.visible = (key === 'pipe');
      w.trash.visible = false;
      g.setState({phase: 'free', mode: 'idle', held: 'pipe', supporting: null, prep: 2, outlet: true, cap: false, bud: 1, stock: 9, embers: 0});
      const pipe = w.items.pipe, cam = w.camera;
      w.scene.add(pipe);
      pipe.updateMatrixWorld(true);
      const distance = 0.12, bowlCenter = 0.040;
      pipe.quaternion.copy(cam.quaternion);
      pipe.rotateX(0.48);
      pipe.rotateY(-0.18);
      const anchor = new T.Vector3(0, bowlCenter, 0).applyQuaternion(pipe.quaternion);
      pipe.position.set(0, -0.01, -distance).applyQuaternion(cam.quaternion).add(cam.position).sub(anchor);
      w.bowlBud.visible = true;
      w.scene.updateMatrixWorld(true);
      w.render();
    },
    state: {view: 'loaded-bowl-macro'}
  });
  console.log('Captured: 26-weed-loaded-bowl');

  const manifest = await session.finalize({
    warning: 'GH-48 Multi-Angle Hero Prop Acceptance Suite',
    errors
  });

  console.log(`Successfully finalized ${manifest.summary.totalCaptures} captures in ${out}`);
} catch (err) {
  console.error(`GH-48 CAPTURE FAILED: ${err.message}`);
  process.exitCode = 1;
  throw err;
} finally {
  await app.close();
}
