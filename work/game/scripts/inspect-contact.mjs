import {_electron as electron} from 'playwright-core';
import path from 'node:path';

const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
page.on('pageerror', e => console.error('Page error:', e));
page.on('console', m => console.log('Console:', m.text()));
await page.waitForFunction(() => !!window.__game, null, { timeout: 180000 });
await page.waitForTimeout(2000);

const audit = await page.evaluate(() => {
  const T = window.__game.THREE || window.THREE;
  const w = window.__game.world;
  const camPos = w.camera.position;

  const results = {
    totalChecked: 0,
    floatingCount: 0,
    categories: {},
    pineConeAngles: [],
    details: []
  };

  const m4 = new T.Matrix4();
  const instPos = new T.Vector3();
  const instQuat = new T.Quaternion();
  const instScale = new T.Vector3();

  w.scene.traverse(o => {
    if (!o.isInstancedMesh) return;
    const name = o.name || 'unnamed';
    if (!/clutter|stone|stick|twig|branch|cone|flake|pebble|leaf|needle|grass|shrub|sapling/i.test(name)) return;

    if (!results.categories[name]) {
      results.categories[name] = { count: 0, minEmbed: Infinity, maxEmbed: -Infinity, avgEmbed: 0, sumEmbed: 0 };
    }

    const geom = o.geometry;
    if (!geom || !geom.attributes.position) return;
    geom.computeBoundingBox();
    const bb = geom.boundingBox;

    const posAttr = geom.attributes.position;
    const stride = Math.max(1, Math.floor(posAttr.count / 24));
    const v = new T.Vector3();
    const wp = new T.Vector3();

    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m4);
      m4.decompose(instPos, instQuat, instScale);

      const dist = instPos.distanceTo(camPos);
      if (dist > 3.5) continue; // Focus on near-field player-visible zone

      results.totalChecked++;
      results.categories[name].count++;

      // Compute lowest actual vertex relative to ground
      let lowestWorldY = Infinity;
      let lowestSampleX = instPos.x;
      let lowestSampleZ = instPos.z;
      let maxPenetration = -Infinity;
      let minPenetration = Infinity;

      for (let vi = 0; vi < posAttr.count; vi += stride) {
        v.fromBufferAttribute(posAttr, vi);
        wp.copy(v).applyMatrix4(m4);
        const gy = w.ground(wp.x, wp.z);
        const pen = gy - wp.y; // positive = penetrated into ground, negative = above ground
        if (pen > maxPenetration) maxPenetration = pen;
        if (pen < minPenetration) minPenetration = pen;
      }

      // Pine cone axis check:
      if (/pine cone/i.test(name)) {
        const coneAxis = new T.Vector3(1, 0, 0).applyQuaternion(instQuat).normalize();
        const upDot = Math.abs(coneAxis.y);
        results.pineConeAngles.push({ index: i, upDot, isHorizontal: upDot < 0.40 });
      }

      // Maximum penetration of any vertex into ground:
      const embed = maxPenetration;

      const cat = results.categories[name];
      if (embed < cat.minEmbed) cat.minEmbed = +embed.toFixed(4);
      if (embed > cat.maxEmbed) cat.maxEmbed = +embed.toFixed(4);
      cat.sumEmbed += embed;

      // Allow 3mm margin for displacement/curvature before flagging floating
      if (embed < -0.003) {
        results.floatingCount++;
        results.details.push({
          name,
          index: i,
          pos: { x: +instPos.x.toFixed(3), y: +instPos.y.toFixed(3), z: +instPos.z.toFixed(3) },
          embed: +embed.toFixed(4),
          dist: +dist.toFixed(2)
        });
      }
    }
  });

  for (const [k, v] of Object.entries(results.categories)) {
    if (v.count > 0) {
      v.avgEmbed = +(v.sumEmbed / v.count).toFixed(4);
      delete v.sumEmbed;
    }
  }

  delete results.details;
  return results;
});

console.log('AUDIT SUMMARY:');
console.log(JSON.stringify(audit, null, 2));

await app.close();
