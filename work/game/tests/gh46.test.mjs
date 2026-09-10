import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {Simulation, clamp} from '../src/simulation.js';
import {prepareInteractionFrame} from '../src/interaction-view.js';

const advance = (s, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) s.step(1 / 60, input);
};

function assertInvariants(s, msg = '') {
  s.assert();
  assert.ok(s.water >= 0 && s.water <= 1, `${msg}: water out of bounds: ${s.water}`);
  assert.ok(s.smoke >= 0 && s.smoke <= 1, `${msg}: smoke out of bounds: ${s.smoke}`);
  assert.ok(s.smoke <= 1 - s.water + 1e-6, `${msg}: smoke (${s.smoke}) exceeds available air (${1 - s.water})`);
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

test('GH-46 [1]: Clean start invariants and initial conditions', () => {
  const s = new Simulation();
  assertInvariants(s, 'Clean start');
  assert.equal(s.day, 1);
  assert.equal(s.stock, 10);
  assert.equal(s.hits, 0);
  assert.equal(s.lost, 0);
  assert.equal(s.water, 0);
  assert.equal(s.bud, 0);
  assert.equal(s.embers, 0);
  assert.equal(s.smoke, 0);
  assert.equal(s.prep, 0);
  assert.equal(s.outlet, false);
  assert.equal(s.cap, true);
  assert.equal(s.held, null);
  assert.equal(s.supporting, null);
  assert.equal(s.mode, 'idle');
  assert.equal(s.phase, 'collect');
  assert.equal(s.tutorial, true);
  assert.equal(s.firstHit, true);
});

test('GH-46 [2]: Pipe/bag acquisition in both orders retains both objects', () => {
  // Order 1: pipe then bag
  const s1 = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});
  s1.action('pipe');
  assert.equal(s1.held, 'pipe');
  assert.equal(s1.supporting, null);
  s1.action('bag');
  assert.equal(s1.mode, 'pack');
  assert.equal(s1.held, 'bag');
  assert.equal(s1.supporting, 'pipe');
  assert.ok(s1.isHeld('pipe'));
  assert.ok(s1.isHeld('bag'));
  s1.cancel();
  assert.equal(s1.held, null);
  assert.equal(s1.supporting, null);

  // Order 2: bag then pipe
  const s2 = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});
  s2.action('bag');
  assert.equal(s2.held, 'bag');
  assert.equal(s2.supporting, null);
  s2.action('pipe');
  assert.equal(s2.mode, 'pack');
  assert.equal(s2.held, 'pipe');
  assert.equal(s2.supporting, 'bag');
  assert.ok(s2.isHeld('pipe'));
  assert.ok(s2.isHeld('bag'));
  s2.cancel();
  assert.equal(s2.held, null);
  assert.equal(s2.supporting, null);
});

test('GH-46 [3]: Individual pickup/drop never multi-picks or changes ownership secretly', () => {
  const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});
  for (const item of ['bottle', 'pipe', 'lighter', 'bag']) {
    s.action(item);
    assert.equal(s.held, item);
    assert.equal(s.supporting, null, `Single pickup of ${item} must not acquire companions`);
    s.cancel();
    assert.equal(s.held, null);
    assert.equal(s.supporting, null);
  }
});

test('GH-46 [4]: Wrong target handling prevents softlock and provides feedback', () => {
  const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});
  // Stream without bottle
  assert.equal(s.action('stream'), false);
  assert.ok(s.notice.length > 0);
  assert.equal(s.held, null);

  // Hit with empty smoke
  s.action('bottle');
  assert.equal(s.action('hit'), false);
  assert.ok(s.notice.length > 0);

  // Lighter on un-capped bottle
  assert.equal(s.action('lighter'), false);
  assert.ok(s.notice.length > 0);

  // Refill with cap on
  s.cap = true;
  assert.equal(s.action('stream'), false);
  assert.ok(s.notice.length > 0);
  s.cap = false;

  // Actions before prep is complete
  const sUnprep = new Simulation();
  assert.equal(sUnprep.action('stream'), false);
  assert.equal(sUnprep.action('bag'), false);
  assert.equal(sUnprep.action('hit'), false);
});

test('GH-46 [5]: Refill and held continuity (bottle remains held)', () => {
  const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});
  s.action('bottle');
  assert.equal(s.held, 'bottle');
  s.action('stream');
  assert.equal(s.mode, 'fill');
  advance(s, 4, {fire: true, aim: 1, seal: true});
  assert.ok(s.water >= 0.995);
  assert.equal(s.mode, 'idle');
  // Continuity: bottle remains held!
  assert.equal(s.held, 'bottle', 'Bottle must remain held after water collection');
  assert.equal(s.supporting, null);
});

test('GH-46 [6]: Pack, load, and spill mechanics', () => {
  const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});
  s.action('bag');
  assert.equal(s.mode, 'pack');

  // Successful pack
  assert.equal(s.pack(true), true);
  assert.equal(s.bud, 1);
  assert.equal(s.stock, 9);
  assert.equal(s.lost, 0);

  // Cannot pack when already loaded
  s.action('bag');
  assert.equal(s.pack(true), false);
  assert.equal(s.stock, 9);

  // Reset bud to test missed pack (spill)
  s.bud = 0;
  s.action('bag');
  assert.equal(s.pack(false), true);
  assert.equal(s.bud, 0);
  assert.equal(s.stock, 8);
  assert.equal(s.lost, 1, 'Spilled charge must be permanently recorded as lost');
});

test('GH-46 [7]: Heating mechanics require proper lighter tilt', () => {
  const s = new Simulation();
  s.action('pipe');
  s.action('lighter');
  assert.equal(s.phase, 'heat');
  assert.equal(s.mode, 'heat');

  // Wrong tilt (95 deg, outside effective flame range) produces no flame contact
  s.angle = 95;
  advance(s, 2, {fire: true, aim: 1});
  assert.equal(s.heat, 0);

  // Proper tilt (45 deg) heats glass tip
  s.angle = 45;
  advance(s, 2, {fire: true, aim: 1});
  assert.ok(s.heat > 0.3);

  // Releasing flame allows tip to cool
  const heatMid = s.heat;
  advance(s, 1.5, {fire: false});
  assert.ok(s.heat < heatMid);

  // Heat to completion
  advance(s, 5, {fire: true, aim: 1});
  assert.equal(s.heat, 1);
  assert.equal(s.phase, 'press');
});

test('GH-46 [8]: Cap/pipe preparation workflow', () => {
  const s = new Simulation({phase: 'press', heat: 1, held: 'pipe', supporting: null});
  s.action('bottle');
  assert.equal(s.mode, 'press');
  assert.equal(s.held, 'bottle');
  assert.equal(s.supporting, 'pipe');

  advance(s, 3, {fire: true, aim: 1});
  assert.equal(s.phase, 'unscrew');
  assert.equal(s.prep, 1);
  assert.equal(s.supporting, null);

  // Unscrew cap
  advance(s, 3, {left: true});
  assert.equal(s.phase, 'hole');
  assert.equal(s.cap, false);

  // Melt lower outlet
  s.action('lighter');
  s.angle = 45;
  advance(s, 5, {fire: true, aim: 1});
  assert.equal(s.phase, 'free');
  assert.equal(s.outlet, true);
  assert.equal(s.prep, 2);
});

test('GH-46 [9]: Screw and unscrew in both acquisition orders with reversibility', () => {
  for (const order of [['pipe', 'bottle'], ['bottle', 'pipe']]) {
    const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false, water: 1, bud: 1});
    s.action(order[0]);
    s.action(order[1]);
    assert.equal(s.mode, 'screw');
    assert.equal(s.held, 'bottle');
    assert.equal(s.supporting, 'pipe');

    // Screw clockwise partially
    advance(s, 0.8, {right: true, seal: true});
    const pMid = s.progress;
    assert.ok(pMid > 0.2 && pMid < 0.8);

    // Reversible: turn back counter-clockwise
    advance(s, 0.4, {left: true, seal: true});
    assert.ok(s.progress < pMid);

    // Complete screw
    advance(s, 2.5, {right: true, seal: true});
    assert.equal(s.cap, true);
    assert.equal(s.supporting, null, 'Attached cap consumes pipe into bottle');

    // Unscrew
    s.action('bottle');
    assert.equal(s.mode, 'uncap');
    advance(s, 2.5, {left: true, seal: true});
    assert.equal(s.cap, false);
    assert.equal(s.supporting, 'pipe', 'Unscrewing returns assembly to supporting hand');
  }
});

test('GH-46 [10]: Drainage, Torricelli cutoff, and smoke vacuum invariants', () => {
  const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: true, water: 1, bud: 1, held: 'bottle'});
  s.action('lighter');
  s.angle = 45;

  // Sealed outlet: zero drainage, zero smoke
  advance(s, 3, {fire: true, aim: 1, seal: true});
  assert.equal(s.water, 1);
  assert.equal(s.smoke, 0);

  // Unsealed outlet: water drains, airflow + flame ignites embers, smoke fills
  advance(s, 4, {fire: true, aim: 1, seal: false});
  assert.ok(s.water < 0.85);
  assert.ok(s.smoke > 0.1);
  assert.ok(s.smoke <= 1 - s.water + 1e-6);

  // Empty pipe scenario: water drains, but zero smoke
  const sEmpty = new Simulation({phase: 'free', prep: 2, outlet: true, cap: true, water: 1, bud: 0, held: 'bottle'});
  sEmpty.action('lighter');
  sEmpty.angle = 45;
  advance(sEmpty, 5, {fire: true, aim: 1, seal: false});
  assert.ok(sEmpty.water < 0.7);
  assert.equal(sEmpty.smoke, 0, 'Empty pipe must never generate smoke');

  // Torricelli cutoff stops at outlet height (~0.072)
  advance(s, 30, {fire: false, seal: false});
  assert.ok(Math.abs(s.water - 0.072) < 0.002);
  assert.equal(s.flow, 0);
});

test('GH-46 [11]: Hit mechanics, water filtration, cough, and residue', () => {
  // Water filtered hit (water ~0.15)
  const sFiltered = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false, water: 0.15, smoke: 0.6, held: 'bottle'});
  assert.equal(sFiltered.action('hit'), true);
  assert.equal(sFiltered.phase, 'inhale');
  assert.equal(sFiltered.hits, 1);
  assert.equal(sFiltered.cough, 0.28, 'Water filtered hit must produce mild cough');
  assert.ok(sFiltered.lastQuality > 0.8);
  advance(sFiltered, 5);
  assert.equal(sFiltered.phase, 'free');
  assert.equal(sFiltered.water, 0);
  assert.equal(sFiltered.smoke, 0);

  // Harsh dry hit (water = 0)
  const sDry = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false, water: 0, smoke: 0.6, held: 'bottle'});
  assert.equal(sDry.action('hit'), true);
  assert.equal(sDry.cough, 1.0, 'Dry hit must produce harsh cough');
});

test('GH-46 [12] & [13]: Repeated cycles, Day 1 depletion, and sleep transition', () => {
  const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});
  for (let i = 0; i < 9; i++) {
    s.action('bag');
    s.pack(true);
    s.action('bottle');
    s.action('stream');
    advance(s, 4, {fire: true, aim: 1, seal: true});
    s.action('pipe');
    advance(s, 2.5, {right: true, seal: true});
    s.action('lighter');
    s.angle = 45;
    advance(s, 5, {fire: true, aim: 1, seal: false});
    s.action('bottle');
    advance(s, 2.5, {left: true, seal: true});
    s.action('hit');
    advance(s, 5);
    assertInvariants(s, `Cycle ${i + 1}`);
  }
  assert.equal(s.hits, 9);
  assert.equal(s.stock, 1);

  // 10th charge lost via spill
  s.action('bag');
  s.pack(false);
  assert.equal(s.stock, 0);
  assert.equal(s.lost, 1);

  // Day 1 depletion triggers sleep
  advance(s, 0.5);
  assert.equal(s.phase, 'sleep', 'Exhausting all 10 charges must trigger sleep phase');
});

test('GH-46 [14] & [15]: Sleep duration and Day 2 automatic state upgrade', () => {
  const s = new Simulation({phase: 'sleep', stock: 0, hits: 9, lost: 1, prep: 2, outlet: true});
  advance(s, 3);
  assert.equal(s.phase, 'sleep');

  advance(s, 5);
  assert.equal(s.phase, 'free');
  assert.equal(s.day, 2);
  assert.equal(s.stock, 1000, 'Day 2 contractor bag must provide 1000 charges');

  // Automated Day 2 actions (single clicks)
  s.action('bag');
  assert.equal(s.bud, 1);
  assert.equal(s.stock, 999);

  s.action('bottle');
  s.action('stream');
  assert.equal(s.water, 1);
  assert.equal(s.seal, true);

  s.action('bottle');
  assert.equal(s.cap, true);

  s.action('lighter');
  assert.equal(s.mode, 'auto');
  advance(s, 20);
  assert.equal(s.hits, 10);
  assert.equal(s.phase, 'free');
});

test('GH-46 [16], [17], [18]: Tutorial, settings, and full save/restore parity', () => {
  const s = new Simulation({
    phase: 'free',
    prep: 2,
    outlet: true,
    cap: false,
    water: 0.15,
    bud: 1,
    embers: 0.5,
    smoke: 0.4,
    stock: 5,
    lost: 2,
    hits: 3,
    day: 1,
    residue: 0.25,
    held: 'bottle',
    supporting: 'pipe',
    tutorial: false,
    angle: 45
  });

  const snap = s.snapshot();
  const restored = new Simulation(snap);
  const snap2 = restored.snapshot();
  assert.deepEqual(snap, snap2, 'Snapshot must be perfectly round-trip equivalent');

  // Tutorial toggle
  s.tutorial = !s.tutorial;
  assert.equal(s.tutorial, true);
  s.tutorial = !s.tutorial;
  assert.equal(s.tutorial, false);
});

test('GH-46 [19]: Rapid click spam cannot softlock or restart cap turns', () => {
  const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false, water: 1, bud: 1});
  s.action('bottle');
  s.action('pipe');
  assert.equal(s.mode, 'screw');
  advance(s, 0.5, {right: true, seal: true});
  const progressMid = s.progress;

  // Spam various clicks during screwing
  for (let i = 0; i < 50; i++) {
    for (const act of ['bottle', 'pipe', 'lighter', 'bag', 'stream', 'hit']) {
      assert.equal(s.action(act), false, `Clicking ${act} during screw must be rejected`);
    }
  }
  assert.equal(s.mode, 'screw');
  assert.equal(s.progress, progressMid);
  assert.equal(s.held, 'bottle');
  assert.equal(s.supporting, 'pipe');
});

test('GH-46 [20]: Camera movement and 3D transform stability', () => {
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
      return {x: (v.x * 0.5 + 0.5) * 1920, y: (-0.5 * v.y + 0.5) * 1080, visible: v.z >= -1 && v.z <= 1};
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

  for (let i = 0; i < 30; i++) prepareInteractionFrame(world, 1 / 60, sim, input, settings);
  const initialLocalPos = world.camera.worldToLocal(world.items.bottle.getWorldPosition(new T.Vector3())).clone();

  // Test full 360 yaw and pitch sweeps
  for (let yaw = -Math.PI; yaw <= Math.PI; yaw += 0.3) {
    for (let pitch = -0.8; pitch <= 0.6; pitch += 0.3) {
      world.yaw = yaw;
      world.pitch = pitch;
      prepareInteractionFrame(world, 1 / 60, sim, input, settings);
      const curLocalPos = world.camera.worldToLocal(world.items.bottle.getWorldPosition(new T.Vector3()));
      assert.ok(curLocalPos.distanceTo(initialLocalPos) < 1e-4, 'Held bottle drifted in camera space under rotation');
    }
  }
});
