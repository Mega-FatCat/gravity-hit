import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('../qa/pass2');
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

// 1. Clearing view: labels & clearance & slab integration
await capture('01-clearing-overview', () => {
  window.__game.begin();
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'collect', mode: 'idle', picked: []});
});

// 2. Stream view: organic channel & bed & stones
await capture('02-stream-channel-and-bed', () => {
  window.__game.setView(0.78, -0.22);
  window.__game.setState({phase: 'collect', mode: 'idle'});
});

// 3. Close up on slab and roots
await capture('03-slab-roots-detail', () => {
  window.__game.setView(0, -0.58);
  window.__game.setState({phase: 'collect', mode: 'idle'});
});

// 4. Look right at woodland clearing and natural clusters
await capture('04-woodland-vegetation-clusters', () => {
  window.__game.setView(-0.85, -0.15);
  window.__game.setState({phase: 'collect', mode: 'idle'});
});

// 5. Look behind (360 view)
await capture('05-look-behind-forest', () => {
  window.__game.setView(Math.PI, -0.15);
  window.__game.setState({phase: 'collect', mode: 'idle'});
});

// 6. Bottle hole-creation interaction framing
await capture('06-bottle-hole-pose', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'hole', mode: 'hole', prep: 1, cap: false, progress: 0.2, angle: 45});
  window.__game.input.x = innerWidth * 0.50;
  window.__game.input.y = innerHeight * 0.48;
});

// 7. Lighter flame & angle in heat mode
await capture('07-lighter-flame-heat', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'heat', mode: 'heat', prep: 0, cap: false, heat: 0.35, angle: 35});
  window.__game.input.x = innerWidth * 0.52;
  window.__game.input.y = innerHeight * 0.48;
  window.__game.input.fire = true;
});

// 8. Refill view at stream
await capture('08-refill-stream-view', () => {
  window.__game.input.fire = false;
  window.__game.setState({phase: 'free', mode: 'fill', prep: 2, cap: false, water: 0.5, stock: 10, bud: 1});
});

// 9. Lighter multi-angle in ignite mode with active flame
await capture('09-lighter-multi-angle', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'ignite', mode: 'ignite', prep: 3, cap: true, progress: 0.5, angle: 55});
  window.__game.input.x = innerWidth * 0.50;
  window.__game.input.y = innerHeight * 0.45;
  window.__game.input.fire = true;
});

await app.close();
console.log('Pass 2 capture complete!');
