import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

const outDir = path.resolve('qa/gh06-verification');
await fs.mkdir(outDir, {recursive: true});

async function captureCanvas(page, filename) {
  const dataUrl = await page.evaluate(() => {
    window.__game.world.render();
    return window.__game.world.renderer.domElement.toDataURL('image/png');
  });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  await fs.writeFile(path.join(outDir, filename), Buffer.from(base64, 'base64'));
  console.log('Saved', filename);
}

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 120000
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

await page.waitForFunction(() => !!window.__game, {timeout: 180000});
await page.waitForTimeout(1000);

await page.evaluate(() => {
  window.__game.begin();
  window.__game.setView(0, -0.2);
});
await page.waitForTimeout(600);

console.log('1. Holding lighter alone...');
await page.click('#slot-lighter');
await page.waitForTimeout(400);

const s1 = await page.evaluate(() => {
  const {sim, world} = window.__game;
  return {
    held: sim.held,
    supporting: sim.supporting,
    mode: sim.mode,
    flameQuality: sim.flameQuality,
    flameVisible: world.flame.visible,
    nozzlePos: world.nozzle,
    flamePos: world.flame.position
  };
});
assert.equal(s1.held, 'lighter', 'Lighter must be held');
assert.equal(s1.supporting, null, 'No supporting item');
assert.equal(s1.mode, 'idle', 'Mode must be idle');
assert.equal(s1.flameVisible, false, 'Flame must initially be unlit');
assert.equal(s1.flameQuality, 0, 'Flame quality must be 0 before strike');

console.log('2. Igniting lighter alone (LMB down)...');
const elem = await page.evaluate(() => {
  const el = document.elementFromPoint(400, 300);
  return el ? el.tagName + '#' + el.id + '.' + el.className : 'null';
});
console.log('Element at (400, 300):', elem);
await page.mouse.move(400, 300);
await page.mouse.down();
await page.waitForTimeout(300);

const s2 = await page.evaluate(() => {
  const {sim, world, input} = window.__game;
  return {
    inputFire: input.fire,
    flameVisible: world.flame.visible,
    flameLightIntensity: world.flameLight.intensity,
    flameQuality: sim.flameQuality,
    nozzlePos: world.nozzle,
    flamePos: world.flame.position,
    distToNozzle: world.flame.position.distanceTo(world.nozzle),
    phase: sim.phase,
    heat: sim.heat,
    progress: sim.progress,
    held: sim.held,
    supporting: sim.supporting,
    mode: sim.mode
  };
});
console.log('s2 state:', s2);
assert.equal(s2.flameVisible, true, 'Flame must be visible when holding LMB');
assert.ok(s2.flameLightIntensity > 0, 'Flame point light must illuminate');
assert.ok(s2.flameQuality > 0, 'Flame quality must be positive');
assert.ok(s2.distToNozzle < 0.001, 'Flame must originate at nozzle');
assert.equal(s2.phase, 'collect', 'Phase must not advance');
assert.equal(s2.heat, 0, 'Heat must remain 0');

await captureCanvas(page, '01-lighter-ignited.png');

console.log('3. Camera movement while holding lighter...');
const camBefore = await page.evaluate(() => ({yaw: window.__game.world.yaw, pitch: window.__game.world.pitch}));
await page.evaluate(() => {
  window.__game.world.look(40, -20);
});
await page.waitForTimeout(200);

const camAfter = await page.evaluate(() => {
  const {world, sim} = window.__game;
  return {
    yaw: world.yaw,
    pitch: world.pitch,
    flameVisible: world.flame.visible,
    held: sim.held
  };
});
assert.notEqual(camAfter.yaw, camBefore.yaw, 'Camera yaw must have changed');
assert.equal(camAfter.flameVisible, true, 'Flame remains ignited during camera movement');
assert.equal(camAfter.held, 'lighter', 'Lighter remains held during camera movement');

console.log('4. Extinguishing lighter (LMB up)...');
await page.mouse.up();
await page.waitForTimeout(200);

const s3 = await page.evaluate(() => {
  const {sim, world} = window.__game;
  return {
    flameVisible: world.flame.visible,
    flameLightIntensity: world.flameLight.intensity,
    flameQuality: sim.flameQuality
  };
});
assert.equal(s3.flameVisible, false, 'Flame must extinguish on LMB release');
assert.equal(s3.flameLightIntensity, 0, 'Flame light must be 0');
assert.equal(s3.flameQuality, 0, 'Flame quality must be 0');

await captureCanvas(page, '02-lighter-extinguished.png');

console.log('5. Picking another object (pipe)...');
await page.click('#slot-pipe');
await page.waitForTimeout(400);

const s4 = await page.evaluate(() => {
  const {sim} = window.__game;
  return {
    phase: sim.phase,
    held: sim.held,
    supporting: sim.supporting,
    mode: sim.mode
  };
});
assert.equal(s4.phase, 'heat', 'Picking pipe while holding lighter enters heat phase');
assert.equal(s4.held, 'lighter');
assert.equal(s4.supporting, 'pipe');
assert.equal(s4.mode, 'heat', 'Must enter dedicated heat interaction');

console.log('6. Dedicated heating interaction (warming glass)...');
// Move to aimScreen of pipeTip to aim flame
const aimPos = await page.evaluate(() => {
  window.__game.sim.angle = 45;
  return window.__game.world.aimScreen;
});
await page.mouse.move(aimPos.x, aimPos.y);
await page.mouse.down();
await page.waitForTimeout(1000);

const heatProgress = await page.evaluate(() => window.__game.sim.heat);
assert.ok(heatProgress > 0, 'Dedicated heating interaction heats pipe tip');
await page.mouse.up();
await page.waitForTimeout(200);

console.log('7. Leaving heating interaction (cancelling with KeyE)...');
await page.keyboard.press('KeyE');
await page.waitForTimeout(300);

const s5 = await page.evaluate(() => {
  const {sim} = window.__game;
  return {held: sim.held, supporting: sim.supporting, mode: sim.mode};
});
assert.equal(s5.held, null, 'Items set down');
assert.equal(s5.supporting, null);
assert.equal(s5.mode, 'idle');

console.log('8. Re-selecting lighter alone to verify standalone recovery...');
await page.evaluate(() => {
  window.__game.setView(0, -0.2);
});
await page.click('#slot-lighter');
await page.waitForTimeout(500);
await page.mouse.move(400, 300);
await page.mouse.down();
await page.waitForTimeout(500);

const s6 = await page.evaluate(() => {
  const {sim, world} = window.__game;
  return {
    held: sim.held,
    supporting: sim.supporting,
    mode: sim.mode,
    flameVisible: world.flame.visible,
    flameQuality: sim.flameQuality
  };
});
assert.equal(s6.held, 'lighter');
assert.equal(s6.supporting, null);
assert.equal(s6.mode, 'idle');
assert.equal(s6.flameVisible, true, 'Standalone lighter re-ignites after leaving heating');
assert.ok(s6.flameQuality > 0);

await captureCanvas(page, '03-standalone-recovered.png');

await page.mouse.up();
await page.waitForTimeout(200);

assert.equal(errors.length, 0, 'No console/page errors allowed: ' + errors.join('; '));
console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
await app.close();
