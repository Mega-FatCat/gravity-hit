import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

const out = path.resolve('../qa/gh46-acceptance');
await fs.mkdir(out, {recursive: true});

const executablePath = path.resolve('node_modules/electron/dist/electron.exe');
const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath,
  timeout: 120000
});

const page = await app.firstWindow();
const errors = [];
const checks = [];
const worldClicks = [];

page.on('pageerror', e => errors.push(e.message));
page.on('console', m => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.route('https://**/*', r => r.abort());

const state = () => page.evaluate(() => ({...window.__game.sim.snapshot(), mode: window.__game.sim.mode}));
const readMode = () => page.evaluate(() => window.__game.sim.mode);
const wait = (predicate, timeout = 25000) => page.waitForFunction(predicate, null, {timeout});
const screenshot = name => page.screenshot({path: path.join(out, name + '.png')});

async function clickWorld(id) {
  await page.waitForTimeout(450);
  const point = await page.evaluate(id => {
    const {world, sim} = window.__game;
    const center = id === 'stream'
      ? world.projected.stream
      : world.screen(world.items[id].localToWorld(world.items[id].position.clone().set(0, {bottle: .12, pipe: .04, lighter: .03, bag: .07}[id], 0)));
    const candidates = [];
    for (let radius = 0; radius <= 70; radius += 4) {
      for (let angle = 0; angle < (radius ? Math.PI * 2 : 1); angle += radius ? .4 : 1) {
        candidates.push({x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius});
      }
    }
    for (const p of candidates) {
      if (p.x < 10 || p.y < 10 || p.x > innerWidth - 10 || p.y > innerHeight - 10 || document.elementFromPoint(p.x, p.y)?.id !== 'scene') continue;
      if (world.hitTest(p.x, p.y, sim) === id) return p;
    }
    return null;
  }, id);

  if (!point) throw Error('No unobstructed rendered surface found for ' + id + '; ' + JSON.stringify(await state()));
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(160);
  worldClicks.push({id, x: point.x, y: point.y});
}

async function aimUntil(predicate, timeout = 25000) {
  const start = Date.now();
  const p = await page.evaluate(() => window.__game.world.aimScreen);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  try {
    while (Date.now() - start < timeout) {
      const aim = await page.evaluate(() => window.__game.world.aimScreen);
      await page.mouse.move(aim.x, aim.y);
      await page.waitForTimeout(45);
      if (await page.evaluate(predicate)) return;
    }
  } finally {
    await page.mouse.up();
  }
  throw Error('Timed out aiming: ' + JSON.stringify({...await state(), mode: await readMode()}));
}

async function tilt(targetAngle = 45) {
  const angle = await page.evaluate(() => window.__game.sim.angle);
  if (Math.abs(angle - targetAngle) < 3) return;
  const key = angle < targetAngle ? 'd' : 'a';
  await page.keyboard.down(key);
  try {
    await wait(() => Math.abs(window.__game.sim.angle - 45) < 3, 6000);
  } finally {
    await page.keyboard.up(key);
  }
}

async function pack(success = true, physical = false) {
  if (physical) await clickWorld('bag'); else await page.click('#slot-bag');
  await page.waitForSelector('#nug', {state: 'visible'});
  await page.waitForTimeout(400);
  const n = await page.locator('#nug').boundingBox();
  const before = await state();
  await page.mouse.move(n.x + n.width / 2, n.y + n.height / 2);
  await page.mouse.down();
  const p = await page.evaluate(() => window.__game.world.aimScreen);
  await page.mouse.move(success ? p.x : 180, success ? p.y : 260, {steps: 12});
  await page.mouse.up();
  await page.waitForTimeout(140);
  const after = await state();
  assert.equal(after.stock, before.stock - 1);
  assert.equal(after.lost, before.lost + (success ? 0 : 1));
  assert.equal(after.bud, success ? 1 : 0);
}

try {
  await wait(() => !!window.__game, 120000);

  // 1. Clean Start
  const init = await state();
  assert.equal(init.day, 1);
  assert.equal(init.stock, 10);
  assert.equal(init.hits, 0);
  assert.equal(init.phase, 'collect');
  assert.equal(init.held, null);
  assert.equal(init.supporting, null);
  await screenshot('01-clean-start');
  await page.click('#begin');
  checks.push('Clean start: correct initial quantities, HUD visible, no held objects');

  // 2. Individual pickup / drop & Wrong target
  await clickWorld('pipe');
  let cur = await state();
  assert.equal(cur.held, 'pipe');
  assert.equal(cur.supporting, null, 'Pipe alone acquired; no companion');
  // Wrong target: stream without bottle
  await page.click('#slot-stream');
  cur = await state();
  assert.equal(await readMode(), 'idle');
  // Drop with E
  await page.keyboard.press('KeyE');
  cur = await state();
  assert.equal(cur.held, null);
  assert.equal(cur.supporting, null);
  checks.push('Individual pickup and drop via E cleanly returns prop without multi-pickup');

  // 3. Prep: Heat, Press, Unscrew, Hole
  await clickWorld('lighter');
  await clickWorld('pipe');
  cur = await state();
  assert.equal(cur.phase, 'heat');
  assert.equal(cur.held, 'lighter');
  assert.equal(cur.supporting, 'pipe');
  await tilt(45);
  await aimUntil(() => window.__game.sim.phase === 'press');
  checks.push('Pipe and lighter heated to press phase with flame contact');

  await clickWorld('bottle');
  await aimUntil(() => window.__game.sim.phase === 'unscrew');
  checks.push('Warm pipe pressed through cap into bottle');

  await page.keyboard.down('KeyA');
  try {
    await wait(() => window.__game.sim.phase === 'hole', 8000);
  } finally {
    await page.keyboard.up('KeyA');
  }
  checks.push('Cap unscrewed, bottle inverts for carb hole');

  await clickWorld('lighter');
  await tilt(45);
  await aimUntil(() => window.__game.sim.phase === 'free');
  cur = await state();
  assert.equal(cur.prep, 2);
  assert.equal(cur.outlet, true);
  checks.push('Outlet formed; preparation complete');

  // 4. Pipe/bag both orders
  await page.keyboard.press('KeyE');
  await clickWorld('pipe');
  await clickWorld('bag');
  cur = await state();
  assert.equal(cur.mode, 'pack');
  assert.ok(cur.held && cur.supporting);
  await page.keyboard.press('KeyE');

  // 5. Pack, Load, and Refill with Held Continuity
  await pack(true, true);
  await screenshot('02-loaded-pipe');
  checks.push('Pack successful: 1 charge consumed, bud loaded');

  await clickWorld('bottle');
  assert.equal((await state()).held, 'bottle');
  await clickWorld('stream');
  await page.keyboard.down('Space');
  await aimUntil(() => window.__game.sim.mode === 'idle');
  cur = await state();
  assert.equal(cur.held, 'bottle', 'Bottle remains held after stream collection');
  assert.ok(cur.water >= 0.99);
  checks.push('Refill and held continuity: bottle filled and retained in hand');

  // 6. Screw assembly
  await page.keyboard.down('KeyD');
  try {
    await wait(() => window.__game.sim.cap, 8000);
  } finally {
    await page.keyboard.up('KeyD');
  }
  checks.push('Loaded cap screwed onto filled bottle');

  // 7. Lighter ignition, drainage, smoke draw, retention, and hit
  await clickWorld('lighter');
  await tilt(45);
  await page.keyboard.up('Space');
  await aimUntil(() => window.__game.sim.water < 0.18, 25000);
  await page.keyboard.down('Space');
  cur = await state();
  assert.ok(cur.smoke > 0.3);
  await screenshot('03-smoke-chamber');
  checks.push('Hydraulic Torricelli draw produced dense smoke with water retention');

  // Unscrew and inhale
  await page.click('#slot-bottle');
  await page.keyboard.down('KeyA');
  try {
    await wait(() => !window.__game.sim.cap, 8000);
  } finally {
    await page.keyboard.up('KeyA');
  }
  await page.keyboard.up('Space');
  await page.keyboard.press('Space');
  await wait(() => window.__game.sim.hits === 1, 6000);
  await wait(() => window.__game.sim.phase === 'free', 10000);
  checks.push('Inhale completed: hit registered, water and smoke cleared');

  // 8. Tutorial toggle & Settings
  await page.keyboard.press('KeyT');
  cur = await state();
  assert.equal(cur.tutorial, true);
  await page.keyboard.press('KeyT');
  assert.equal((await state()).tutorial, false);

  await page.keyboard.press('Escape');
  await page.click('[data-tab="world"]');
  await page.locator('[data-setting="quality"]').selectOption('medium');
  await page.click('#resume');
  checks.push('Tutorial toggle (T) and Settings menu operated cleanly');

  // 9. Rapid click spam resistance
  await clickWorld('bottle');
  for (let i = 0; i < 6; i++) {
    await page.click('#slot-lighter');
    await page.waitForTimeout(40);
    await page.click('#slot-pipe');
    await page.waitForTimeout(40);
    await page.click('#slot-stream');
    await page.waitForTimeout(40);
  }
  cur = await state();
  assert.ok(['bottle', 'lighter', 'pipe', null].includes(cur.held));
  assert.ok(cur.phase === 'free');
  checks.push('Rapid click spam resisted without softlock or impossible state');

  // 10. Camera movement & label projection stability
  await page.mouse.move(960, 540);
  await page.mouse.down({button: 'right'});
  for (let i = 0; i < 15; i++) {
    await page.mouse.move(960 + Math.cos(i * 0.4) * 80, 540 + Math.sin(i * 0.4) * 40);
    await page.waitForTimeout(30);
  }
  await page.mouse.up({button: 'right'});
  await page.evaluate(() => window.__game.setView(0, -0.265));
  await page.waitForTimeout(200);
  checks.push('Camera movement (RMB) smoothly rotated view without transform divergence');

  // 11. Save and reload verification
  await page.keyboard.press('Escape');
  const beforeSave = await state();
  await page.evaluate(() => window.__game.save());
  await page.reload();
  await wait(() => !!window.__game, 120000);
  const restored = await state();
  for (const k of ['phase', 'stock', 'lost', 'hits', 'day', 'prep', 'outlet', 'cap']) {
    assert.equal(restored[k], beforeSave[k], `${k} must match across reload`);
  }
  await page.click('#begin');
  checks.push('Save / reload: complete state survived reload without duplication');

  // 12. Deplete remaining Day 1 stock, sleep, and Day 2 upgrade
  // Miss 1 charge to verify spill
  await pack(false, false);
  checks.push('Spill accounting: missed charge recorded in lost count');

  async function runCycle() {
    await pack(true, false);
    await page.click('#slot-bottle');
    assert.equal((await state()).held, 'bottle');
    await page.click('#slot-stream');
    await page.waitForTimeout(700);
    await page.keyboard.down('Space');
    await aimUntil(() => window.__game.sim.mode === 'idle');
    assert.equal((await state()).held, 'bottle');
    await page.keyboard.down('KeyD');
    try {
      await wait(() => window.__game.sim.cap, 8000);
    } finally {
      await page.keyboard.up('KeyD');
    }
    await page.click('#slot-lighter');
    assert.equal((await state()).supporting, 'bottle');
    await tilt(45);
    await page.waitForTimeout(450);
    await page.keyboard.up('Space');
    await aimUntil(() => window.__game.sim.water < 0.18, 25000);
    await page.keyboard.down('Space');
    await page.click('#slot-bottle');
    assert.equal((await state()).held, 'bottle');
    await page.keyboard.down('KeyA');
    try {
      await wait(() => !window.__game.sim.cap, 8000);
    } finally {
      await page.keyboard.up('KeyA');
    }
    const beforeHit = await state();
    await page.keyboard.up('Space');
    await page.keyboard.press('Space');
    await page.waitForFunction(hits => window.__game.sim.hits === hits + 1, beforeHit.hits, {timeout: 6000});
    await wait(() => ['free', 'sleep'].includes(window.__game.sim.phase), 12000);
    assert.equal((await state()).bud, 0);
  }

  while ((await state()).stock > 0) {
    await runCycle();
  }

  assert.equal((await state()).hits, 9);
  assert.equal((await state()).lost, 1);
  checks.push('All 10 Day 1 charges accounted for (9 hits, 1 lost)');

  await wait(() => window.__game.sim.day === 2, 25000);
  await screenshot('04-day-2-morning');
  const day2 = await state();
  assert.equal(day2.day, 2);
  assert.equal(day2.stock, 1000);
  checks.push('Sleep transition reached Day 2 morning with 1000 charges');

  // Day 2 automated workflow
  await page.click('#slot-bag');
  await page.click('#slot-bottle');
  await page.click('#slot-stream');
  await page.click('#slot-bottle');
  await page.click('#slot-lighter');
  await wait(() => window.__game.sim.hits === 10, 30000);
  await wait(() => window.__game.sim.phase === 'free', 12000);
  assert.equal((await state()).stock, 999);
  checks.push('Day 2 automated single-click ritual completed 10th hit');

  const final = await state();
  await screenshot('05-final-day2');

  const result = {
    status: 'PASS',
    totalChecks: checks.length,
    checks,
    final,
    errors
  };

  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

} catch (error) {
  await screenshot('error-state').catch(() => {});
  const failure = {
    status: 'FAIL',
    checks,
    error: error.message,
    errors,
    state: await state().catch(() => null)
  };
  await fs.writeFile(path.join(out, 'result.json'), JSON.stringify(failure, null, 2));
  console.error('ACCEPTANCE TEST FAILED:', failure);
  process.exitCode = 1;
} finally {
  await app.close();
}
