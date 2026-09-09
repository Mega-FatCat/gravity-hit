import {_electron as electron} from 'playwright-core';
import path from 'node:path';

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
await page.waitForFunction(() => !!window.__game, {timeout: 180000});

const nearObjects = await page.evaluate(() => {
  const T = window.__game.THREE || window.THREE;
  const w = window.__game.world;
  const camPos = w.camera.position;
  const results = [];
  
  w.scene.traverse(o => {
    if (o.isInstancedMesh) {
      const m = new (w.slab.matrix.constructor)();
      const pos = new (w.slab.position.constructor)();
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        const dist = pos.distanceTo(camPos);
        if (dist < 3.0) {
          results.push({
            type: 'instanced',
            parent: o.name || (o.material ? o.material.name : 'unknown'),
            matColor: o.material?.color?.getHexString(),
            index: i,
            pos: {x: +pos.x.toFixed(3), y: +pos.y.toFixed(3), z: +pos.z.toFixed(3)},
            dist: +dist.toFixed(3)
          });
        }
      }
    } else if (o.isMesh && o !== w.groundMesh && o !== w.stream && o !== w.slab) {
      const pos = o.getWorldPosition(new (w.slab.position.constructor)());
      const dist = pos.distanceTo(camPos);
      if (dist < 3.0) {
        results.push({
          type: 'mesh',
          name: o.name,
          userData: o.userData,
          pos: {x: +pos.x.toFixed(3), y: +pos.y.toFixed(3), z: +pos.z.toFixed(3)},
          dist: +dist.toFixed(3)
        });
      }
    }
  });
  return results;
});

console.log('NEAR OBJECTS (<3m from camera):', JSON.stringify(nearObjects, null, 2));
await app.close();
