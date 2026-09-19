import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

const ready = (overrides = {}) => new Simulation({
  phase: 'free', prep: 2, outlet: true, cap: true, water: 1, bud: 1, held: 'lighter', supporting: 'bottle', ...overrides
});

function advanceTime(sim, seconds, input = {}) {
  const dt = 1 / 60;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    sim.step(dt, input);
  }
}

test('GH-04: full contact converts water loss into the requested gradual bowl and smoke progress', () => {
  const s = ready();
  s.mode = 'ignite';
  s.angle = 45;

  assert.equal(s.smoke, 0);
  assert.equal(s.smokeDensity, 0);

  while(s.water>.75) s.step(1/60,{fire:true,aim:1});
  assert.ok(Math.abs(s.bud-.5)<.015, `25% water release should leave half the bowl, got ${s.bud}`);
  assert.ok(Math.abs(s.smoke-.5)<.015, `25% water release should produce half the smoke load, got ${s.smoke}`);
  assert.ok(s.smoke>1-s.water, 'half a charge may be compressed into the smaller headspace');
  assert.ok(s.smokeDensity>.95, 'compressed smoke should read as optically dense');

  while(s.water>.5) s.step(1/60,{fire:true,aim:1});
  assert.ok(s.bud<.015, `50% water release should finish the bowl, got ${s.bud}`);
  assert.ok(s.smoke>.985, `50% water release should produce the full smoke load, got ${s.smoke}`);
});

test('GH-04: heating response distinguishes weak, normal, and strong heating', () => {
  function runProfile(aim, angle) {
    const s = ready();
    s.mode = 'ignite';
    s.angle = angle;
    advanceTime(s, 1.0, {fire: true, aim});
    const early = {smoke: s.smoke, embers: s.embers, density: s.smokeDensity};
    advanceTime(s, 3.5, {fire: true, aim});
    const mid = {smoke: s.smoke, embers: s.embers, density: s.smokeDensity};
    advanceTime(s, 3.5, {fire: true, aim});
    const late = {smoke: s.smoke, embers: s.embers, density: s.smokeDensity};
    return {early, mid, late};
  }

  const strong = runProfile(1.0, 45); // flameQuality = 1.0
  const normal = runProfile(0.8, 40); // flameQuality ~ 0.76
  const weak = runProfile(0.45, 20);  // flameQuality ~ 0.34

  assert.ok(strong.early.embers > normal.early.embers);
  assert.ok(normal.early.embers > weak.early.embers);
  assert.ok(strong.early.smoke > weak.early.smoke);
  assert.ok(strong.mid.smoke > weak.mid.smoke);
  assert.ok(strong.late.smoke >= normal.late.smoke);
  assert.ok(normal.late.smoke >= weak.late.smoke);
});

test('GH-04: partial flame contact scales combustion linearly', () => {
  const half = ready();
  half.mode = 'ignite';
  while (half.water > .5) half.step(1 / 60, {fire: true, aim: .5});
  assert.ok(Math.abs(half.bud - .5) < .02, `half contact should burn half the bowl over 50% water release, got ${half.bud}`);
  assert.ok(Math.abs(half.smoke - .5) < .02, `half contact should produce half smoke load, got ${half.smoke}`);
});

test('GH-04: drain-driven airflow stokes glowing embers even when flame is removed', () => {
  const s = ready();
  s.mode = 'ignite';
  s.angle = 45;

  advanceTime(s, 1.2, {fire: true, aim: 1});
  assert.ok(s.embers > 0.8, 'cherry should be well established');

  advanceTime(s, 2.5, {fire: false, aim: 0});
  assert.ok(s.embers > 0.7, 'airflow draft should sustain embers');
  assert.ok(s.smoke > 0.25, 'smoke should continue generating');

  advanceTime(s, 3.0, {fire: false, aim: 0, seal: true});
  assert.ok(s.embers < 0.55, 'embers should extinguish without airflow draft or flame');
});

test('GH-04: physical causality invariants preserved', () => {
  const empty = ready({bud: 0});
  empty.mode = 'ignite';
  empty.angle = 45;
  advanceTime(empty, 5.0, {fire: true, aim: 1});
  assert.equal(empty.smoke, 0, 'empty bowl must produce 0 smoke');
  assert.equal(empty.embers, 0, 'empty bowl cannot hold embers');

  const dry = ready({water: 0.072});
  dry.mode = 'ignite';
  dry.angle = 45;
  advanceTime(dry, 3.0, {fire: true, aim: 1});
  assert.equal(dry.flow, 0, 'dry bottle cannot flow');
  assert.equal(dry.smoke, 0, 'no airflow draft means no smoke displacement');

  const sealed = ready({water: 1.0});
  sealed.mode = 'ignite';
  sealed.angle = 45;
  advanceTime(sealed, 4.0, {fire: true, aim: 1, seal: true});
  assert.equal(sealed.water, 1.0, 'sealed outlet must prevent water loss');
  assert.equal(sealed.smoke, 0, 'sealed outlet must prevent smoke fill');

  const full = ready();
  full.mode = 'ignite';
  full.angle = 45;
  advanceTime(full, 12.0, {fire: true, aim: 1});
  assert.ok(full.smoke <= 1);
});
