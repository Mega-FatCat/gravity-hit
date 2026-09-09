import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('../qa/pass3');
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
  const dest = path.join(out, `${name}.png`);
  await page.screenshot({path: dest});
  console.log(`Captured: ${name}.png`);
}

// 1. Forest Canopy & Dense Vegetation Overview (Clearing facing forward)
await capture('01-dense-forest-overview', () => {
  window.__game.begin();
  window.__game.setView(0, -0.22);
  window.__game.setState({phase: 'collect', mode: 'idle', picked: []});
});

// 2. 360 Forest Pan: Look East toward stream & dense tree tiers
await capture('02-forest-east-stream', () => {
  window.__game.setView(0.78, -0.18);
});

// 3. 360 Forest Pan: Look South (behind player) - dense understory & towering trunks
await capture('03-forest-south-behind', () => {
  window.__game.setView(Math.PI, -0.15);
});

// 4. 360 Forest Pan: Look West - thick shrub/fern layering and mossy boulders
await capture('04-forest-west-woodland', () => {
  window.__game.setView(-1.1, -0.15);
});

// 5. Macro/Meso/Micro Terrain Detail: Close-up on stone slab & forest floor texel density
await capture('05-terrain-texel-and-slab', () => {
  window.__game.setView(0, -0.62);
});

// 6. PET Plastic Bottle Close-Up on Slab: Thin plastic sheen, molded ribs, STILLWATER label, petalloid base
await capture('06-pet-bottle-and-pipe-on-slab', () => {
  window.__game.setView(0, -0.42);
  window.__game.setState({phase: 'free', mode: 'idle', prep: 3, cap: true, water: 0.75, outlet: true});
});

// 7. Borosilicate Chillum Close-Up: Conical bowl, rubber grommet, inner pinch, resin gradient
await capture('07-borosilicate-pipe-detail', () => {
  window.__game.setView(0, -0.35);
  window.__game.setState({phase: 'pack', mode: 'pack', prep: 3, cap: false, residue: 0.45, bud: 1});
});

// 8. Decoupling Check 1: Lighter held in ignite mode. Bottle MUST stay resting on slab!
await capture('08-held-lighter-bottle-on-slab', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'ignite', mode: 'ignite', prep: 3, cap: true, progress: 0.5, angle: 45, water: 0.65});
  window.__game.input.x = innerWidth * 0.50;
  window.__game.input.y = innerHeight * 0.45;
  window.__game.input.fire = true;
});

// 9. Decoupling Check 2: Pipe held in pack mode. Bottle MUST stay resting on slab!
await capture('09-held-pipe-bottle-on-slab', () => {
  window.__game.input.fire = false;
  window.__game.setView(0, -0.32);
  window.__game.setState({phase: 'pack', mode: 'pack', prep: 3, cap: false, water: 0.75});
});

// 10. Decoupling Check 3: Bottle held for hole creation. Lighter aimed at outlet.
await capture('10-held-bottle-hole-mode', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'hole', mode: 'hole', prep: 1, cap: false, progress: 0.35, angle: 45});
  window.__game.input.x = innerWidth * 0.50;
  window.__game.input.y = innerHeight * 0.48;
  window.__game.input.fire = true;
});

// 11. Refill at stream with mouth immersed
await capture('11-refill-at-stream', () => {
  window.__game.input.fire = false;
  window.__game.setState({phase: 'free', mode: 'fill', prep: 2, cap: false, water: 0.55, stock: 9, bud: 1});
});

// 12. Full Active Cycle: Smoke column, water drainage jet, burning cherry
await capture('12-burn-and-drain-jet', () => {
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'free', mode: 'ignite', prep: 3, cap: true, water: 0.45, smoke: 0.65, embers: 0.9, flow: 1, angle: 45});
  window.__game.input.x = innerWidth * 0.50;
  window.__game.input.y = innerHeight * 0.45;
  window.__game.input.fire = true;
});

await app.close();
console.log('Pass 3 verification captures completed successfully.');
