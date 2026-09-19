import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import fs from 'node:fs/promises';

const out = path.resolve('qa/stream-edge-diagnostic');
await fs.mkdir(out, {recursive: true});
const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});
const page = await app.firstWindow();

try {
  await page.waitForFunction(() => !!window.__game, {timeout: 30000});
  await page.waitForTimeout(2500);
  await app.evaluate(({BrowserWindow}) => {
    const w = BrowserWindow.getAllWindows()[0];
    w.setContentSize(1920, 1080);
    if (w.showInactive) w.showInactive();
  });
  await page.evaluate(() => {
    window.__game.begin();
    window.__game.setState({phase: 'free', mode: 'idle', held: null, supporting: null, prep: 2, stock: 10, water: 0.3, cap: true, tutorial: false});
    window.__game.world.setQuality('high');
    window.__game.setView(0.96, -0.43);
  });
  await page.waitForTimeout(3500);

  const info = await page.evaluate(() => {
    const world = window.__game.world;
    const rows = [];
    world.scene.traverse(o => {
      if (!o.isMesh && !o.isInstancedMesh) return;
      const name = String(o.name || '');
      if (/Streambed|Scanned creek|Scanned clearing|Stream debris|Forest floor .*stick|Forked twig/i.test(name)) {
        rows.push({name, count: o.count ?? 1, visible: o.visible, matColor: o.material?.color?.getHexString?.() ?? null});
      }
    });
    const debris = [];
    world.scene.traverse(o => {
      if (!o.isInstancedMesh || !String(o.name || '').startsWith('Stream debris')) return;
      const matrix = o.matrix.clone();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        const e = matrix.elements;
        debris.push({name: o.name, i, pos: [e[12], e[13], e[14]]});
      }
    });
    return {rows, debris, clutter: world.clutterCounts, stream: world.streambed?.counts};
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({path: path.join(out, 'all.png')});

  const variants = [
    ['no-streambed.png', 'streambed'],
    ['no-authored-rocks.png', 'authored'],
    ['no-clutter.png', 'clutter'],
    ['no-cobbles.png', 'cobbles'],
    ['no-medium.png', 'medium'],
    ['no-upper.png', 'upper'],
    ['no-fines.png', 'fines']
  ];
  for (const [name, kind] of variants) {
    await page.evaluate(kind => {
      window.__game.world.scene.traverse(o => {
        const name = String(o.name || '');
        const hide = kind === 'streambed'
          ? name.startsWith('Streambed ')
          : kind === 'authored'
            ? name.startsWith('Scanned creek') || name.startsWith('Scanned clearing') || name.startsWith('Scanned refill-bank')
            : kind === 'clutter'
              ? name.startsWith('Forest floor') || name.startsWith('Stream debris')
              : kind === 'cobbles'
                ? name.startsWith('Streambed Class 2 River Cobble')
                : kind === 'medium'
                  ? name.startsWith('Streambed Class 2b Medium')
                  : kind === 'upper'
                    ? name.startsWith('Streambed Class 2c Upper Cobble')
                    : /^Streambed Class (3|3b|4|5)/.test(name);
        if (hide) o.visible = false;
      });
    }, kind);
    await page.waitForTimeout(100);
    await page.screenshot({path: path.join(out, name)});
    await page.evaluate(() => window.__game.world.scene.traverse(o => { o.visible = true; }));
  }
} finally {
  await app.close();
}
