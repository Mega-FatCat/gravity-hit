import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {createServer} from 'vite';

const server = await createServer({root: 'work/game', server: {host: '127.0.0.1', port: 0}});
await server.listen();
const address = server.httpServer.address();
const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: false,
  args: ['--enable-gpu', '--use-angle=d3d11']
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto(`http://127.0.0.1:${address.port}/?qa=1&quality=low`, {waitUntil: 'commit'});
  await page.waitForFunction(() => window.__zniczLoading?.done, null, {timeout: 180000});

  // Enter the forest
  await page.click('#begin');
  await page.waitForTimeout(500);

  // Setup state matching free ritual: uncapped, outlet formed, empty pipe held
  await page.evaluate(() => {
    window.__game.setState({
      phase: 'free',
      prep: 2,
      outlet: true,
      cap: false,
      bud: 0,
      stock: 10,
      lost: 0,
      held: 'pipe',
      supporting: null,
      mode: 'idle'
    });
  });
  await page.waitForTimeout(200);

  // 1. Click Weed Bag hotbar slot while pipe is held
  await page.click('#slot-bag');
  await page.waitForTimeout(200);

  const packState1 = await page.evaluate(() => {
    const sim = window.__game.sim;
    const packingEl = document.querySelector('#packing');
    const nugEl = document.querySelector('#nug');
    return {
      mode: sim.mode,
      held: sim.held,
      supporting: sim.supporting,
      isHeldBag: sim.isHeld('bag'),
      isHeldPipe: sim.isHeld('pipe'),
      packingHidden: packingEl.classList.contains('hidden'),
      nugDisplay: window.getComputedStyle(nugEl).display,
      nugWidth: nugEl.offsetWidth,
      nugHeight: nugEl.offsetHeight,
      aimScreen: window.__game.world.aimScreen
    };
  });

  console.log('1. Pack State after clicking Weed Bag:', packState1);
  assert.equal(packState1.mode, 'pack');
  assert.equal(packState1.isHeldBag, true);
  assert.equal(packState1.isHeldPipe, true);
  assert.equal(packState1.packingHidden, false);
  assert.ok(packState1.nugWidth > 20);

  // Take screenshot of spawned bud nugget ready to drag
  await page.screenshot({path: 'work/game/qa/bud-diagnostic/verify-pack-spawned.png'});

  // 2. Test missed drag: drag nugget away and release
  const nugBox = await page.locator('#nug').boundingBox();
  await page.mouse.move(nugBox.x + nugBox.width / 2, nugBox.y + nugBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(100, 100, {steps: 10});
  await page.mouse.up();
  await page.waitForTimeout(200);

  const missedState = await page.evaluate(() => {
    const sim = window.__game.sim;
    const packingEl = document.querySelector('#packing');
    const nugEl = document.querySelector('#nug');
    return {
      mode: sim.mode,
      stock: sim.stock,
      lost: sim.lost,
      bud: sim.bud,
      packingHidden: packingEl.classList.contains('hidden'),
      nugVisible: !packingEl.classList.contains('hidden') && nugEl.offsetWidth > 20
    };
  });

  console.log('2. State after missed drag (should re-arm pack mode):', missedState);
  assert.equal(missedState.stock, 9);
  assert.equal(missedState.lost, 1);
  assert.equal(missedState.bud, 0);
  assert.equal(missedState.mode, 'pack');
  assert.equal(missedState.packingHidden, false);
  assert.equal(missedState.nugVisible, true);

  // 3. Test successful drag: drag nugget onto the pipe bowl opening
  const targetPoint = await page.evaluate(() => window.__game.world.aimScreen);
  const nugBox2 = await page.locator('#nug').boundingBox();
  await page.mouse.move(nugBox2.x + nugBox2.width / 2, nugBox2.y + nugBox2.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetPoint.x, targetPoint.y, {steps: 15});
  await page.mouse.up();
  await page.waitForTimeout(300);

  const loadedState = await page.evaluate(() => {
    const sim = window.__game.sim;
    const world = window.__game.world;
    const packingEl = document.querySelector('#packing');
    return {
      mode: sim.mode,
      stock: sim.stock,
      bud: sim.bud,
      packingHidden: packingEl.classList.contains('hidden'),
      bowlBudVisible: world.bowlBud.visible,
      bowlBudScale: world.bowlBud.scale.x
    };
  });

  console.log('3. State after successful drag into bowl:', loadedState);
  assert.equal(loadedState.bud, 1);
  assert.equal(loadedState.stock, 8);
  assert.equal(loadedState.mode, 'idle');
  assert.equal(loadedState.packingHidden, true);
  assert.equal(loadedState.bowlBudVisible, true);

  // Take screenshot of loaded pipe bowl
  await page.screenshot({path: 'work/game/qa/bud-diagnostic/verify-bowl-loaded.png'});

  const fatalErrors = errors.filter(e => !e.includes('404'));
  assert.deepEqual(fatalErrors, []);
  console.log('All interactive packing checks passed successfully!');
} finally {
  await browser.close();
  await server.close();
}
