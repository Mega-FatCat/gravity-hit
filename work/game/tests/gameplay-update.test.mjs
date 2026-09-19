import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

const advance = (s, seconds, input = {}) => {
  for (let i = 0; i < seconds * 60; i++) s.step(1 / 60, input);
};

describe('Gameplay Logic Updates (2026-09-18)', () => {
  it('1. Auto-stows cap with pipe after piercing and unscrewing so lighter can be picked up', () => {
    const s = new Simulation();
    // Advance to press phase
    s.phase = 'press';
    s.mode = 'press';
    s.held = 'bottle';
    s.supporting = 'pipe';
    s.progress = 0.99;
    advance(s, 0.1, {fire: true, aim: 1});
    assert.equal(s.phase, 'unscrew');
    assert.equal(s.mode, 'unscrew');
    assert.equal(s.prep, 1);
    assert.equal(s.held, 'bottle');

    // Complete unscrew
    advance(s, 2.5, {left: true});
    assert.equal(s.phase, 'hole');
    assert.equal(s.cap, false);
    // Cap with pipe was automatically stowed/set down!
    assert.equal(s.supporting, null, 'Pipe is stowed on the slab');
    assert.equal(s.held, 'bottle', 'Bottle remains in hand');

    // Picking up lighter now seamlessly pairs with held bottle
    s.action('lighter');
    assert.equal(s.held, 'lighter');
    assert.equal(s.supporting, 'bottle');
    assert.equal(s.mode, 'hole');
  });

  it('2. Toggle items: number key allows both picking up and setting down', () => {
    const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false});

    // Toggle bottle
    assert.equal(s.held, null);
    s.toggle('bottle');
    assert.equal(s.held, 'bottle');
    s.toggle('bottle');
    assert.equal(s.held, null, 'Bottle stowed on second toggle');

    // Toggle pipe
    s.toggle('pipe');
    assert.equal(s.held, 'pipe');
    s.toggle('pipe');
    assert.equal(s.held, null, 'Pipe stowed on second toggle');

    // Toggle lighter
    s.toggle('lighter');
    assert.equal(s.held, 'lighter');
    s.toggle('lighter');
    assert.equal(s.held, null, 'Lighter stowed on second toggle');

    // Toggle bag
    s.toggle('bag');
    assert.equal(s.held, 'bag');
    s.toggle('bag');
    assert.equal(s.held, null, 'Bag stowed on second toggle');

    // Toggle stream (stops fill)
    s.action('bottle');
    s.action('stream');
    assert.equal(s.mode, 'fill');
    s.toggle('stream');
    assert.equal(s.mode, 'idle', 'Stream fill stopped on toggle');
  });

  it('3. Lighter tilt is removed; A and D do not tilt lighter', () => {
    const s = new Simulation();
    s.action('lighter');
    advance(s, 0.1);
    assert.equal(s.angle, 0);
    advance(s, 0.5, {left: true, fire: true, aim: 1});
    assert.equal(s.angle, 0);
    assert.ok(s.flameQuality > 0);
    advance(s, 0.5, {right: true, fire: true, aim: 1});
    assert.equal(s.angle, 0);
    assert.ok(s.flameQuality > 0);
  });

  it('4. Free phase: pressing A while holding lighter after hit immediately begins unscrewing bottle cap', () => {
    const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: true, water: 0.15, bud: 0, smoke: 0.8});
    s.held = 'lighter';
    s.mode = 'idle';

    // Player presses A to unscrew
    s.step(1 / 60, {left: true});
    assert.equal(s.held, 'bottle', 'Holding switches to bottle');
    assert.equal(s.mode, 'uncap', 'Mode switches to uncap');
    assert.ok(s.progress < 1.0);

    // Hold A until unscrewed
    advance(s, 2.5, {left: true});
    assert.equal(s.cap, false, 'Cap is off');
    assert.equal(s.held, 'bottle', 'Bottle in hand');

    // Now player can immediately take the hit with action('hit') / space
    const hitOk = s.action('hit');
    assert.equal(hitOk, true, 'Hit is taken without manual item switching');
    assert.equal(s.phase, 'inhale');
  });

  it('5. Dedicated A and D controls screw and unscrew cap when held', () => {
    const s = new Simulation({phase: 'free', prep: 2, outlet: true, cap: false, water: 1, bud: 1});
    s.action('bottle');
    assert.equal(s.cap, false);

    // Press D to screw
    s.step(1 / 60, {right: true});
    assert.equal(s.mode, 'screw');
    assert.equal(s.supporting, 'pipe');
    advance(s, 2.5, {right: true});
    assert.equal(s.cap, true);

    // Press A to unscrew
    s.step(1 / 60, {left: true});
    assert.equal(s.mode, 'uncap');
    advance(s, 2.5, {left: true});
    assert.equal(s.cap, false);
  });
});
