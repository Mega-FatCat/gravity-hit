import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('../qa/pass1');
await fs.mkdir(out, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
await page.waitForFunction(() => !!window.__game, {timeout: 180000});
await page.waitForTimeout(2000);

async function capture(name, setup) {
  if (setup) await page.evaluate(setup);
  await page.waitForTimeout(1000);
  await page.screenshot({path: path.join(out, `${name}.png`)});
  console.log(`Captured: ${name}.png`);
}

// 1. Clearing view: labels & clearance
await capture('01-clearing-labels-and-clearance', () => {
  window.__game.begin();
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'collect', mode: 'idle', picked: []});
});

// 2. Lighter held orientation in heating mode
await capture('02-lighter-held-orientation', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'heat', mode: 'heat', prep: 0, cap: false, heat: 0.3, angle: 45});
  window.__game.input.x = innerWidth * 0.52;
  window.__game.input.y = innerHeight * 0.48;
});

// 3. Bottle hole framing fix (The critical bug!)
await capture('03-bottle-hole-pose-fixed', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'hole', mode: 'hole', prep: 1, cap: false, progress: 0.2, angle: 45});
  window.__game.input.x = innerWidth * 0.50;
  window.__game.input.y = innerHeight * 0.48;
});

// 4. Refill view
await capture('04-refill-fixed', () => {
  window.__game.setState({phase: 'free', mode: 'fill', prep: 2, cap: false, water: 0.5, stock: 10, bud: 1});
});

// 5. Look left toward stream
await capture('05-look-left-stream', () => {
  window.__game.setView(0.75, -0.2);
  window.__game.setState({phase: 'collect', mode: 'idle'});
});

// 6. Look right toward forest
await capture('06-look-right-forest', () => {
  window.__game.setView(-0.85, -0.15);
  window.__game.setState({phase: 'collect', mode: 'idle'});
});

await app.close();
console.log('Verification pass 1 complete!');
