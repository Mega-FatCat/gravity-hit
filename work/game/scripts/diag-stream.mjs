import {_electron as electron} from 'playwright-core';
import path from 'node:path';

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
await page.waitForFunction(() => !!window.__game, {timeout: 180000});

const diag = await page.evaluate(() => {
  const w = window.__game.world;
  w.stream.geometry.computeBoundingBox();
  const sbb = w.stream.geometry.boundingBox;
  const swpos = w.stream.getWorldPosition(new (w.stream.position.constructor)());
  
  // Sample stream vertices at z = 0, z = 0.8, z = 2
  const pos = w.stream.geometry.attributes.position;
  const samples = [];
  for (let i = 0; i < pos.count; i += 20) {
    samples.push({
      i,
      localX: pos.getX(i),
      localY: pos.getY(i),
      localZ: pos.getZ(i)
    });
  }
  
  return {
    streamPos: swpos,
    streamRot: {x: w.stream.rotation.x, y: w.stream.rotation.y, z: w.stream.rotation.z},
    streamVisible: w.stream.visible,
    streamParent: w.stream.parent ? w.stream.parent.type : null,
    streamBox: sbb,
    samples: samples.slice(0, 8),
    groundAtStream08: w.ground(w.streamX(0.8), 0.8),
    streamX08: w.streamX(0.8),
    streamWidth08: w.streamWidth(0.8)
  };
});

console.log('DIAGNOSTICS:', JSON.stringify(diag, null, 2));
await app.close();
