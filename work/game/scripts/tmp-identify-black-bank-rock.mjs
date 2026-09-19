import {_electron as electron} from 'playwright-core';
import path from 'node:path';

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

  const nearest = await page.evaluate(() => {
    const world = window.__game.world;
    const camera = world.camera;
    camera.updateMatrixWorld(true);
    world.scene.updateMatrixWorld(true);
    const targets = [
      {x: 1260, y: 780},
      {x: 1320, y: 820},
      {x: 1180, y: 760}
    ];
    const rows = [];
    const p = camera.position.clone();
    const m = camera.matrixWorld.clone();
    const worldMatrix = camera.matrixWorld.clone();

    world.scene.traverse(o => {
      if (!o.visible || (!o.isMesh && !o.isInstancedMesh)) return;
      const name = String(o.name || '');
      if (!/Streambed|Scanned|Ritual stone/i.test(name)) return;

      const record = (instance, matrix) => {
        p.setFromMatrixPosition(matrix).project(camera);
        const sx = (p.x * 0.5 + 0.5) * 1920;
        const sy = (-p.y * 0.5 + 0.5) * 1080;
        const distances = targets.map(t => Math.hypot(sx - t.x, sy - t.y));
        rows.push({name, instance, sx, sy, distance: Math.min(...distances)});
      };

      if (o.isInstancedMesh) {
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m);
          worldMatrix.multiplyMatrices(o.matrixWorld, m);
          record(i, worldMatrix);
        }
      } else {
        record(null, o.matrixWorld);
      }
    });

    return rows.sort((a, b) => a.distance - b.distance).slice(0, 40);
  });
  console.log(JSON.stringify(nearest, null, 2));
} finally {
  await app.close();
}
