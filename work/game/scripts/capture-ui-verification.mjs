import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('../qa/ui-restyle-verification');
await fs.mkdir(out, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
await page.waitForFunction(() => !!window.__game, {timeout: 180000});
await page.waitForTimeout(1500);

// 1. Static view: initial clearing with world labels and hotbar buttons 1-5
await page.evaluate(() => {
  window.__game.begin();
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'collect', mode: 'idle', held: null, supporting: null});
});
await page.waitForTimeout(1000);
await page.screenshot({path: path.join(out, '01-static-clearing-labels-and-hotbar.png')});
console.log('Captured 01-static-clearing-labels-and-hotbar.png');

// 2. Hover state on world label (Bottle label)
const labelBottle = await page.locator('#label-bottle');
const labelBox = await labelBottle.boundingBox();
if (labelBox) {
  await page.mouse.move(labelBox.x + labelBox.width / 2, labelBox.y + labelBox.height / 2);
  await page.waitForTimeout(400);
  await page.screenshot({path: path.join(out, '02-hover-object-label.png')});
  console.log('Captured 02-hover-object-label.png');
}

// 3. Hover state on hotbar button (Lighter button)
const slotLighter = await page.locator('#slot-lighter');
const slotBox = await slotLighter.boundingBox();
if (slotBox) {
  await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
  await page.waitForTimeout(400);
  await page.screenshot({path: path.join(out, '03-hover-hotbar-button.png')});
  console.log('Captured 03-hover-hotbar-button.png');
}

// Move mouse away to clear hover
await page.mouse.move(100, 100);
await page.waitForTimeout(200);

// 4. Selected / Active state on hotbar (Holding bottle with water & smoke, showing HUD harmony)
await page.evaluate(() => {
  window.__game.setState({phase: 'free', mode: 'idle', held: 'bottle', supporting: null, prep: 2, cap: true, outlet: true, water: 0.55, smoke: 0.85, bud: 1.0});
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(out, '04-active-hotbar-and-right-hud.png')});
console.log('Captured 04-active-hotbar-and-right-hud.png');

// 5. Slow RMB pan verification (moving viewpoint slowly while labels track)
await page.evaluate(() => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'collect', mode: 'idle', held: null, supporting: null});
});
await page.waitForTimeout(400);
await page.mouse.move(600, 400);
await page.mouse.down({button: 'right'});
for (let step = 1; step <= 3; step++) {
  await page.mouse.move(600 + step * 25, 400 + step * 10);
  await page.waitForTimeout(100);
  await page.screenshot({path: path.join(out, `05-slow-rmb-pan-step-${step}.png`)});
}
await page.mouse.up({button: 'right'});
console.log('Captured slow RMB pan frames');

// 6. Fast RMB pan verification (sweeping camera rapidly)
await page.mouse.move(600, 400);
await page.mouse.down({button: 'right'});
await page.mouse.move(300, 450); // fast wide delta
await page.waitForTimeout(80);
await page.screenshot({path: path.join(out, '06-fast-rmb-pan-frame1.png')});
await page.mouse.move(850, 360); // fast reversal
await page.waitForTimeout(80);
await page.screenshot({path: path.join(out, '06-fast-rmb-pan-frame2.png')});
await page.mouse.up({button: 'right'});
console.log('Captured fast RMB pan frames');

// 7. Normal gameplay interaction (Holding lighter in heating mode, showing reticle, labels, controls)
await page.evaluate(() => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'heat', mode: 'heat', held: 'lighter', supporting: 'pipe', prep: 0, cap: false, heat: 0.35, angle: 45});
  window.__game.input.x = innerWidth * 0.52;
  window.__game.input.y = innerHeight * 0.48;
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(out, '07-gameplay-heating-interaction.png')});
console.log('Captured 07-gameplay-heating-interaction.png');

await app.close();
console.log('All verification captures completed at ' + out);
