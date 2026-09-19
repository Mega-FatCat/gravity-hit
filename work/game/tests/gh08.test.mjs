import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Simulation} from '../src/simulation.js';
import {prepareInteractionFrame} from '../src/interaction-view.js';

globalThis.innerWidth ??= 1920;
globalThis.innerHeight ??= 1080;

const ready = (overrides = {}) => new Simulation({
  phase: 'free',
  prep: 2,
  outlet: true,
  cap: false,
  ...overrides
});

const advance = (s, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) s.step(1 / 60, input);
};

function assertInvariants(s, msg = '') {
  s.assert();
  assert.ok(s.water >= 0 && s.water <= 1, `${msg}: water out of bounds: ${s.water}`);
  assert.ok(s.smoke >= 0 && s.smoke <= 1, `${msg}: smoke out of bounds: ${s.smoke}`);
  assert.ok(s.smokeDensity >= 0 && s.smokeDensity <= 1, `${msg}: visual smoke density out of bounds: ${s.smokeDensity}`);
  assert.ok(s.bud >= 0 && s.bud <= 1, `${msg}: bud out of bounds: ${s.bud}`);
  assert.ok(s.embers >= 0 && s.embers <= 1, `${msg}: embers out of bounds: ${s.embers}`);
  assert.ok(s.stock >= 0, `${msg}: stock negative: ${s.stock}`);
  assert.ok(s.lost >= 0, `${msg}: lost negative: ${s.lost}`);
  assert.ok(s.hits >= 0, `${msg}: hits negative: ${s.hits}`);
  assert.ok(s.day >= 1, `${msg}: day < 1: ${s.day}`);
  assert.ok(s.heat >= 0 && s.heat <= 1, `${msg}: heat out of bounds: ${s.heat}`);
  assert.ok(s.progress >= 0 && s.progress <= 1, `${msg}: progress out of bounds: ${s.progress}`);
  assert.ok(s.angle >= -100 && s.angle <= 100, `${msg}: angle out of bounds: ${s.angle}`);

  if (s.held) {
    assert.ok(['bottle', 'pipe', 'lighter', 'bag'].includes(s.held), `${msg}: invalid held item: ${s.held}`);
  }
  if (s.supporting) {
    assert.ok(['bottle', 'pipe', 'bag'].includes(s.supporting), `${msg}: invalid supporting item: ${s.supporting}`);
    assert.notEqual(s.held, s.supporting, `${msg}: held and supporting cannot be identical (${s.held})`);
  }
  if (s.cap && s.prep > 0) {
    assert.notEqual(s.held, 'pipe', `${msg}: pipe cannot be held when cap is attached`);
    assert.notEqual(s.supporting, 'pipe', `${msg}: pipe cannot be supporting when cap is attached`);
  }
}

test('GH-08 Prep: heat, press, unscrew, and hole with cancel, reverse, spam, and reload', () => {
  // 1. Heat
  const s = new Simulation();
  s.action('pipe');
  s.action('lighter');
  assert.equal(s.phase, 'heat');
  assert.equal(s.mode, 'heat');
  s.angle = 45;
  advance(s, 2, {fire: true, aim: 1});
  const heatMid = s.heat;
  assert.ok(heatMid > 0.3);

  // Cooling reverse
  advance(s, 2, {fire: false});
  assert.ok(s.heat < heatMid);

  // Spam wrong items
  for (const item of ['bottle', 'bag', 'stream', 'hit']) {
    s.action(item);
    assertInvariants(s, `spam ${item} during heat`);
    assert.equal(s.phase, 'heat');
  }

  // Cancel and reload
  s.cancel();
  assert.equal(s.mode, 'idle');
  const heatBeforeReload = s.heat;
  const restoredHeat = new Simulation(s.snapshot());
  assert.equal(restoredHeat.phase, 'heat');
  assert.equal(restoredHeat.heat, heatBeforeReload);

  // Resume heat to press
  restoredHeat.action('lighter');
  restoredHeat.action('pipe');
  restoredHeat.angle = 45;
  advance(restoredHeat, 5, {fire: true, aim: 1});
  assert.equal(restoredHeat.phase, 'press');

  // 2. Press
  restoredHeat.action('bottle');
  assert.equal(restoredHeat.mode, 'press');
  advance(restoredHeat, 1, {fire: true, aim: 1});
  const pMid = restoredHeat.progress;

  // Press decay reverse
  advance(restoredHeat, 1, {fire: false});
  assert.ok(restoredHeat.progress < pMid);

  // Press cancel and reload
  restoredHeat.cancel();
  const restoredPress = new Simulation(restoredHeat.snapshot());
  assert.equal(restoredPress.phase, 'press');
  restoredPress.action('pipe');
  restoredPress.action('bottle');
  assert.equal(restoredPress.mode, 'press');

  while (restoredPress.phase === 'press') {
    restoredPress.step(1 / 60, {fire: true, aim: 1});
  }
  assert.equal(restoredPress.phase, 'unscrew');
  assert.equal(restoredPress.prep, 1);

  // 3. Unscrew (turn and reverse)
  advance(restoredPress, 0.8, {left: true});
  assert.ok(restoredPress.progress < 1 && restoredPress.progress > 0);
  const unMid = restoredPress.progress;

  // Clockwise reverse with D
  advance(restoredPress, 0.4, {right: true});
  assert.ok(restoredPress.progress > unMid);

  // Cancel and reload unscrew
  restoredPress.cancel();
  const restoredUnscrew = new Simulation(restoredPress.snapshot());
  assert.equal(restoredUnscrew.phase, 'unscrew');
  restoredUnscrew.action('bottle');

  // Complete unscrew to hole phase
  advance(restoredUnscrew, 3, {left: true});
  assert.equal(restoredUnscrew.phase, 'hole');
  assert.equal(restoredUnscrew.cap, false);

  // 4. Hole
  restoredUnscrew.action('lighter');
  assert.equal(restoredUnscrew.mode, 'hole');
  assert.equal(restoredUnscrew.held, 'lighter');
  assert.equal(restoredUnscrew.supporting, 'bottle');

  restoredUnscrew.cancel();
  const restoredHole = new Simulation(restoredUnscrew.snapshot());
  restoredHole.action('bottle');
  restoredHole.action('lighter');
  restoredHole.angle = 45;
  advance(restoredHole, 5, {fire: true, aim: 1});
  assert.equal(restoredHole.phase, 'free');
  assert.equal(restoredHole.outlet, true);
  assert.equal(restoredHole.prep, 2);
  assertInvariants(restoredHole, 'prep end-to-end');
});

test('GH-08 Packing: cancel, missed drop, reload, stock exhaustion', () => {
  let s = ready();
  s.action('bag');
  s.action('pipe');
  assert.equal(s.mode, 'pack');
  assert.equal(s.isHeld('pipe'), true);
  assert.equal(s.isHeld('bag'), true);

  // Cancel during pack
  s.cancel();
  assert.equal(s.mode, 'idle');
  assert.equal(s.held, null);
  assert.equal(s.pack(true), false);

  // Miss drop
  s.action('pipe');
  s.action('bag');
  assert.equal(s.pack(false), true);
  assert.equal(s.lost, 1);
  assert.equal(s.stock, 9);
  assert.equal(s.bud, 0);

  // Success drop
  s.action('bag');
  assert.equal(s.pack(true), true);
  assert.equal(s.bud, 1);
  assert.equal(s.stock, 8);

  // Already loaded
  s.action('pipe');
  assert.equal(s.pack(true), false);

  // Cap on
  s.cap = true;
  s.action('bag');
  assert.equal(s.pack(true), false);
  s.cap = false;

  // Empty bag
  s.stock = 0;
  s.bud = 0;
  s.action('bag');
  assert.equal(s.pack(true), false);
  assertInvariants(s, 'packing invariants');
});

test('GH-08 Refill: prerequisites, mid-fill cancel, slab drainage, re-entry', () => {
  let s = ready();
  assert.equal(s.action('stream'), false);

  s.action('bottle');
  s.cap = true;
  assert.equal(s.action('stream'), false);
  s.cap = false;

  assert.equal(s.action('stream'), true);
  assert.equal(s.mode, 'fill');
  advance(s, 1.5, {fire: true, aim: 1, seal: true});
  const midWater = s.water;
  assert.ok(midWater > 0.2 && midWater < 0.8);

  // Cancel mid-fill
  s.cancel();
  assert.equal(s.mode, 'idle');
  assert.equal(s.held, null);

  // Unsealed bottle drains on slab
  advance(s, 2, {seal: false});
  assert.ok(s.water < midWater);

  // Re-enter and fill to top
  s.action('bottle');
  s.action('stream');
  advance(s, 5, {fire: true, aim: 1, seal: true});
  assert.ok(s.water >= 0.995);
  assert.equal(s.mode, 'idle');
  assertInvariants(s, 'refill invariants');
});

test('GH-08 Screw/Unscrew: explicit supporting ownership, reversibility, cancel and uncap detachment', () => {
  let s = ready({water: 1, bud: 1});

  // Entering screw explicitly sets supporting pipe
  s.action('bottle');
  s.action('pipe');
  assert.equal(s.mode, 'screw');
  assert.equal(s.held, 'bottle');
  assert.equal(s.supporting, 'pipe');
  assert.equal(s.isHeld('pipe'), true);

  // Reversible screwing
  advance(s, 1, {right: true, seal: true});
  const pMid = s.progress;
  assert.ok(pMid > 0.2 && pMid < 0.8);

  advance(s, 0.5, {left: true, seal: true});
  assert.ok(s.progress < pMid);

  // Cancel mid-screw sets down both objects cleanly
  s.cancel();
  assert.equal(s.mode, 'idle');
  assert.equal(s.held, null);
  assert.equal(s.supporting, null);

  // Re-enter and complete screw
  s.action('pipe');
  s.action('bottle');
  advance(s, 2.5, {right: true, seal: true});
  assert.equal(s.cap, true);
  assert.equal(s.mode, 'idle');
  assert.equal(s.supporting, null, 'pipe consumed into bottle');

  // Uncap
  s.action('bottle');
  assert.equal(s.mode, 'uncap');
  advance(s, 2.5, {left: true, seal: true});
  assert.equal(s.cap, false);
  assert.equal(s.mode, 'idle');
  assert.equal(s.held, 'bottle');
  assert.equal(s.supporting, 'pipe', 'uncap must place detached assembly into supporting hand');

  // Verify screw via tilt right sets explicit supporting ownership
  let s2 = ready({water: 1, bud: 1, cap: false, held: 'bottle', supporting: null});
  s2.step(0.1, {right: true});
  assert.equal(s2.mode, 'screw');
  assert.equal(s2.held, 'bottle');
  assert.equal(s2.supporting, 'pipe');
  assert.equal(s2.isHeld('pipe'), true);
  assertInvariants(s, 'screw/unscrew cycle');
});

test('GH-08 Heating and Drainage: Torricelli cutoff, air draft stoking, cancel and reload', () => {
  let s = ready({cap: true, water: 1, bud: 1, held: 'bottle'});
  s.action('lighter');
  assert.equal(s.mode, 'ignite');
  s.angle = 45;

  // Sealed outlet stops drainage and smoke displacement
  advance(s, 3, {fire: true, aim: 1, seal: true});
  assert.equal(s.water, 1);
  assert.equal(s.smoke, 0);
  assert.ok(s.embers > 0.6);

  // Releasing seal draws water out and smoke in; embers stoked by airflow
  advance(s, 4, {fire: false, aim: 1, seal: false});
  assert.ok(s.water < 0.85);
  assert.ok(s.smoke > 0.1);
  assert.ok(s.embers > 0.1);

  // Torricelli cutoff
  advance(s, 30, {fire: false, seal: false});
  assert.ok(Math.abs(s.water - 0.072) < 0.002);
  assert.equal(s.flow, 0);

  // Cancel and reload
  s.cancel();
  const restored = new Simulation(s.snapshot());
  assert.equal(restored.phase, 'free');
  assertInvariants(restored, 'heating/drainage invariants');
});

test('GH-08 Hit and Transition: prerequisites, inhale locking, stock depletion and refill', () => {
  let s = ready({water: 0.15, smoke: 0.5, cap: true, held: 'bottle'});
  assert.equal(s.action('hit'), false, 'cannot hit with cap on');

  s.cap = false;
  s.supporting = 'pipe';
  assert.equal(s.action('hit'), true);
  assert.equal(s.phase, 'inhale');
  assert.equal(s.hits, 1);

  // Inhale locks out cancel and actions
  assert.equal(s.action('hit'), false);
  assert.equal(s.action('bottle'), false);
  assert.equal(s.cancel(), false);

  advance(s, 5);
  assert.equal(s.phase, 'free');
  assert.equal(s.water, 0);
  assert.equal(s.smoke, 0);
  assert.equal(s.held, 'bottle');

  // Complete all 10 charges to verify stock depletion without sleep
  s.stock = 0;
  s.bud = 0;
  s.smoke = 0;
  advance(s, 0.1);
  assert.equal(s.phase, 'free');
  assert.equal(s.stock, 0);

  // Refill restores stock to 10
  assert.equal(s.refill(), true);
  assert.equal(s.stock, 10);
  assertInvariants(s, 'hit and transition invariants');
});

test('GH-08 3D Transforms and Hotspots: camera stability, smooth interpolation, and valid projections', () => {
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(50, 1920 / 1080, 0.05, 100);
  scene.add(camera);

  const home = {
    bottle: new T.Vector3(-0.04, 0.293, 0.84),
    pipe: new T.Vector3(-0.31, 0.323, 0.87),
    lighter: new T.Vector3(0.28, 0.31, 0.79),
    bag: new T.Vector3(0.41, 0.32, 1.05)
  };
  const items = {
    bottle: new T.Group(),
    pipe: new T.Group(),
    lighter: new T.Group(),
    bag: new T.Group()
  };
  for (const [id, g] of Object.entries(items)) {
    scene.add(g);
    g.position.copy(home[id]);
  }
  const trash = new T.Group(); scene.add(trash);
  const capmesh = new T.Mesh(new T.BoxGeometry(0.01, 0.01, 0.01)); items.pipe.add(capmesh);
  const spareCap = new T.Mesh(new T.BoxGeometry(0.01, 0.01, 0.01)); items.bottle.add(spareCap);
  const flame = new T.Mesh(new T.BoxGeometry(0.01, 0.01, 0.01)); items.lighter.add(flame);
  const outlet = new T.Mesh(new T.BoxGeometry(0.005, 0.005, 0.005)); items.bottle.add(outlet);
  const raycaster = new T.Raycaster();

  const world = {
    scene,
    camera,
    baseCam: new T.Vector3(0, 0.68, 1.42),
    bodyPosition: new T.Vector3(0, 0.68, 1.42),
    pitch: -0.26,
    yaw: 0,
    reach: 0,
    home,
    items,
    trash,
    capmesh,
    spareCap,
    flame,
    nozzle: new T.Vector3(-0.003, 0.072, 0.002),
    outlet,
    raycaster,
    target: new T.Vector3(),
    aimScreen: {x: 960, y: 540},
    projected: {},
    streamX(z) { return -0.68 - z * 0.12; },
    screen(point) {
      const v = point.clone().project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * 1920,
        y: (-0.5 * v.y + 0.5) * 1080,
        visible: v.z >= -1 && v.z <= 1
      };
    },
    targetPoint(sim) {
      if (sim.mode === 'heat') return items.pipe.localToWorld(new T.Vector3(0, -0.015, 0));
      if (sim.phase === 'hole' || sim.mode === 'hole') return outlet.getWorldPosition(new T.Vector3());
      if (sim.mode === 'press' || sim.mode === 'fill') return items.bottle.localToWorld(new T.Vector3(0, 0.226, 0));
      if (['ignite', 'auto', 'pack'].includes(sim.mode)) return items.pipe.localToWorld(new T.Vector3(0, 0.060, 0));
      return items.bottle.localToWorld(new T.Vector3(0, 0.12, 0));
    }
  };

  const input = {x: 960, y: 540, fire: false};
  const settings = {motion: true};
  const sim = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false, held: 'bottle'});

  // 1. Settle pose and test camera-relative transform stability under rapid yaw/pitch
  for (let i = 0; i < 30; i++) prepareInteractionFrame(world, 1 / 60, sim, input, settings);
  const initialLocalPos = world.camera.worldToLocal(world.items.bottle.getWorldPosition(new T.Vector3())).clone();

  for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
    world.yaw = Math.sin(angle) * 0.5;
    world.pitch = -0.26 + Math.cos(angle) * 0.3;
    prepareInteractionFrame(world, 1 / 60, sim, input, settings);
    const curLocalPos = world.camera.worldToLocal(world.items.bottle.getWorldPosition(new T.Vector3()));
    assert.ok(curLocalPos.distanceTo(initialLocalPos) < 1e-4, 'Held bottle drifted in camera frame');
  }

  // 2. Stream fill and cancellation continuity (no teleports)
  sim.action('stream');
  let prevPos = world.items.bottle.getWorldPosition(new T.Vector3()).clone();
  for (let i = 0; i < 60; i++) {
    prepareInteractionFrame(world, 1 / 60, sim, input, settings);
    const curPos = world.items.bottle.getWorldPosition(new T.Vector3()).clone();
    assert.ok(curPos.distanceTo(prevPos) < 0.15, 'Bottle teleported during stream transition');
    prevPos = curPos;
  }

  sim.cancel();
  for (let i = 0; i < 60; i++) {
    prepareInteractionFrame(world, 1 / 60, sim, input, settings);
    const curPos = world.items.bottle.getWorldPosition(new T.Vector3()).clone();
    assert.ok(curPos.distanceTo(prevPos) < 0.15, 'Bottle teleported during stream cancel');
    prevPos = curPos;
  }

  // 3. Hotspot screen projections valid and non-divergent
  sim.held = 'lighter';
  sim.supporting = 'bottle';
  sim.cap = true;
  sim.mode = 'ignite';
  prepareInteractionFrame(world, 1 / 60, sim, input, settings);
  assert.ok(Number.isFinite(world.target.x) && Number.isFinite(world.target.y) && Number.isFinite(world.target.z));
  assert.ok(Number.isFinite(world.aimScreen.x) && Number.isFinite(world.aimScreen.y));
  for (const [id, screenPos] of Object.entries(world.projected)) {
    assert.ok(Number.isFinite(screenPos.x) && Number.isFinite(screenPos.y), `Non-finite projected coords for ${id}`);
  }
});

test('GH-08 Randomized Adversarial Stress: 1000 randomized actions, inputs, and reloads', () => {
  const actions = ['pipe', 'lighter', 'bottle', 'bag', 'stream', 'hit', 'cancel', 'pack_true', 'pack_false'];
  let s = new Simulation();

  for (let step = 0; step < 1000; step++) {
    const act = actions[Math.floor(Math.random() * actions.length)];
    if (act === 'cancel') {
      s.cancel();
    } else if (act === 'pack_true') {
      s.pack(true);
    } else if (act === 'pack_false') {
      s.pack(false);
    } else {
      s.action(act);
    }

    const dt = Math.random() * 0.05;
    const input = {
      fire: Math.random() > 0.5,
      left: Math.random() > 0.6,
      right: Math.random() > 0.6,
      seal: Math.random() > 0.5,
      aim: Math.random(),
      hit: Math.random() > 0.95
    };

    s.step(dt, input);
    assertInvariants(s, `random step ${step}`);

    if (Math.random() < 0.05) {
      s = new Simulation(s.snapshot());
      assertInvariants(s, `random reload at step ${step}`);
    }
  }
});
