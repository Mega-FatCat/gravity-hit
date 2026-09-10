import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const out = path.resolve('qa/gh17-stone-fidelity');
await fs.mkdir(out, {recursive: true});

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  cwd: process.cwd(),
  timeout: 90000,
});

const page = await app.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

// Wait for assets to finish loading
await page.waitForFunction(() => {
  return window.__game?.world?.assetErrors !== undefined;
}, null, {timeout: 60000});

// Settle time for detail texture uploads
await page.waitForTimeout(4000);

// 1. Full starting view
await page.screenshot({path: path.join(out, '01-starting-view.png')});
console.log('Starting view captured');

// 2. Close oblique surface — angled look across the stone table and props
await page.evaluate(() => {
  const w = window.__game.world;
  w.baseCam.set(0.12, 0.38, 1.32);
  w.bodyPosition.copy(w.baseCam);
  w.pitch = -0.62;
  w.yaw = -0.18;
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(out, '02-close-oblique-surface.png')});
console.log('Close oblique surface view captured');

// 3. Very close macro — top-down close-range inspection of stone grain and micro-relief
await page.evaluate(() => {
  const w = window.__game.world;
  w.baseCam.set(0.0, 0.42, 0.85);
  w.bodyPosition.copy(w.baseCam);
  w.pitch = -1.30;
  w.yaw = 0.0;
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(out, '03-macro-surface-detail.png')});
console.log('Macro surface detail captured');

const stats = await page.evaluate(() => {
  const w = window.__game.world;
  const info = w.renderer.info;
  return {
    triangles: info.render.triangles,
    drawCalls: info.render.calls,
    assetErrors: w.assetErrors,
    slabMaterial: {
      hasMap: !!w.slab.material.map,
      hasNormalMap: !!w.slab.material.normalMap,
      hasRoughnessMap: !!w.slab.material.roughnessMap,
      roughness: w.slab.material.roughness,
      normalScale: w.slab.material.normalScale ? [w.slab.material.normalScale.x, w.slab.material.normalScale.y] : null,
      hasCustomShader: !!w.slab.material.onBeforeCompile,
    }
  };
});

console.log('\n=== GH-17 Stone Fidelity Report ===');
console.log(JSON.stringify(stats, null, 2));
console.log('Errors:', JSON.stringify(errors));

await app.close();
process.exit(errors.length > 0 ? 1 : 0);
