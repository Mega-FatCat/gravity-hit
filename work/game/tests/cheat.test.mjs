import {describe, it} from 'node:test';
import assert from 'node:assert/strict';
import {Simulation} from '../src/simulation.js';

describe('prepareTestState (2137 cheat)', () => {
  it('sets canonical prepared state from fresh game', () => {
    const sim = new Simulation();
    assert.equal(sim.phase, 'collect');
    sim.prepareTestState();
    assert.equal(sim.phase, 'free');
    assert.equal(sim.mode, 'idle');
    assert.equal(sim.held, null);
    assert.equal(sim.supporting, null);
    assert.equal(sim.prep, 2);
    assert.equal(sim.outlet, true);
    assert.equal(sim.cap, false);
    assert.equal(sim.bud, 1);
    assert.equal(sim.water, 0);
    assert.equal(sim.embers, 0);
    assert.equal(sim.smoke, 0);
    assert.equal(sim.stock, 9); // consumed 1 from initial 10
  });

  it('fills water with fullWater option', () => {
    const sim = new Simulation();
    sim.prepareTestState({ fullWater: true });
    assert.equal(sim.water, 1.0);
    assert.equal(sim.stock, 9);
  });

  it('does not consume another charge when invoked twice', () => {
    const sim = new Simulation();
    sim.prepareTestState();
    const stock = sim.stock;
    sim.prepareTestState({ fullWater: true });
    assert.equal(sim.stock, stock);
    assert.equal(sim.bud, 1);
    assert.equal(sim.water, 1);
  });

  it('refills stock if empty before consuming', () => {
    const sim = new Simulation();
    sim.stock = 0;
    sim.prepareTestState();
    assert.equal(sim.stock, 9); // refilled to 10, consumed 1
    assert.equal(sim.bud, 1);
  });

  it('resets from mid-interaction state', () => {
    const sim = new Simulation();
    sim.phase = 'heat';
    sim.mode = 'heat';
    sim.held = 'lighter';
    sim.supporting = 'pipe';
    sim.heat = 0.7;
    sim.prepareTestState();
    assert.equal(sim.phase, 'free');
    assert.equal(sim.mode, 'idle');
    assert.equal(sim.held, null);
    assert.equal(sim.heat, 0);
  });

  it('resets from inhale phase', () => {
    const sim = new Simulation();
    // Manually set up inhale state
    Object.assign(sim, { phase: 'free', prep: 2, outlet: true });
    sim.prepareTestState();
    assert.equal(sim.phase, 'free');
    assert.equal(sim.transition, 0);
  });

  it('preserves hits, lost, day, residue counters', () => {
    const sim = new Simulation();
    sim.hits = 5;
    sim.lost = 2;
    sim.day = 3;
    sim.residue = 0.1;
    sim.prepareTestState();
    assert.equal(sim.hits, 5);
    assert.equal(sim.lost, 2);
    assert.equal(sim.day, 3);
    assert.ok(Math.abs(sim.residue - 0.1) < 0.001);
  });

  it('passes assert() invariants', () => {
    const sim = new Simulation();
    sim.prepareTestState();
    // assert() is called internally; if it didn't throw, invariants hold
    assert.equal(sim.phase, 'free');
    sim.prepareTestState({ fullWater: true });
    assert.equal(sim.phase, 'free');
  });

  it('allows normal gameplay after cheat', () => {
    const sim = new Simulation();
    sim.prepareTestState();
    // Should be able to fill water
    sim.action('bottle');
    assert.equal(sim.held, 'bottle');
    sim.action('stream');
    assert.equal(sim.mode, 'fill');
  });

  it('allows pack after cheat with cap off', () => {
    const sim = new Simulation();
    sim.prepareTestState();
    // bud is already loaded, so pack should say already loaded
    sim.action('bag');
    assert.equal(sim.notice, 'The pipe is already loaded.');
  });

  it('detects Ctrl + 2137 cheat sequence and suppresses normal item actions', () => {
    const CHEAT_SEQ = ['Digit2', 'Digit1', 'Digit3', 'Digit7'];
    let cheatIdx = 0;
    let cheatExecuted = false;
    let itemsActivated = [];
    const sim = new Simulation();

    function handleKey(e) {
      if (e.ctrlKey) {
        if (e.code === CHEAT_SEQ[cheatIdx]) {
          cheatIdx++;
          if (cheatIdx === CHEAT_SEQ.length) {
            sim.prepareTestState({ fullWater: e.shiftKey });
            cheatExecuted = true;
            cheatIdx = 0;
          }
          return;
        } else if (cheatIdx > 0 && !CHEAT_SEQ.includes(e.code)) {
          cheatIdx = 0;
        }
        return;
      }
      if (cheatIdx > 0) cheatIdx = 0;
      const index = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (index >= 0) itemsActivated.push(['pipe', 'lighter', 'bottle', 'bag', 'stream'][index]);
    }

    // Typing without Ctrl does NOT advance cheat and DOES activate items
    handleKey({ code: 'Digit2', ctrlKey: false, shiftKey: false });
    assert.equal(cheatExecuted, false);
    assert.deepEqual(itemsActivated, ['lighter']);
    assert.equal(cheatIdx, 0);

    itemsActivated = [];

    // Typing with Ctrl (2, 1, 3, 7) executes cheat and activates NO items
    handleKey({ code: 'Digit2', ctrlKey: true, shiftKey: false });
    handleKey({ code: 'Digit1', ctrlKey: true, shiftKey: false });
    handleKey({ code: 'Digit3', ctrlKey: true, shiftKey: false });
    handleKey({ code: 'Digit7', ctrlKey: true, shiftKey: false });
    assert.equal(cheatExecuted, true);
    assert.deepEqual(itemsActivated, [], 'No items were activated when typing cheat with Ctrl');
    assert.equal(sim.water, 0);

    // Typing with Ctrl + Shift (2, 1, 3, 7) sets full water
    cheatExecuted = false;
    handleKey({ code: 'Digit2', ctrlKey: true, shiftKey: true });
    handleKey({ code: 'Digit1', ctrlKey: true, shiftKey: true });
    handleKey({ code: 'Digit3', ctrlKey: true, shiftKey: true });
    handleKey({ code: 'Digit7', ctrlKey: true, shiftKey: true });
    assert.equal(cheatExecuted, true);
    assert.deepEqual(itemsActivated, []);
    assert.equal(sim.water, 1.0, 'fullWater preserved with Shift key');
  });
});
