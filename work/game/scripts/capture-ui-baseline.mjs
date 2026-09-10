import {_electron as electron} from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const out = path.resolve('../qa/ui-baseline');
await fs.mkdir(out, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
await page.waitForFunction(() => !!window.__game, {timeout: 180000});
await page.waitForTimeout(1500);

// Enter game
await page.evaluate(() => {
  window.__game.begin();
  window.__game.setView(0, -0.265);
  window.__game.setState({phase: 'collect', mode: 'idle'});
});
await page.waitForTimeout(1000);

// Capture baseline static view
await page.screenshot({path: path.join(out, '01-baseline-clearing-labels-hotbar.png')});

// Capture with bottle held (showing hotbar selected state and right-panel)
await page.evaluate(() => {
  window.__game.setState({phase: 'free', mode: 'idle', held: 'bottle', supporting: null, prep: 2, cap: true, outlet: true, water: 0.6, smoke: 0.4, bud: 0.8});
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(out, '02-baseline-held-bottle-hud.png')});

await app.close();
console.log('Baseline captured in ' + out);
