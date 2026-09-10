import test from 'node:test';
import assert from 'node:assert/strict';
import {BAG, contentHalfDepth, createBagContentGeometries, createBagFilmGeometry, layoutBagContents, pouchHalfDepth} from '../src/weed-bag.js';

function finiteGeometry(geo, name) {
  assert.ok(geo.attributes.position, `${name} needs positions`);
  assert.ok(geo.attributes.normal, `${name} needs normals`);
  assert.ok(geo.attributes.uv, `${name} needs uvs for the film normal map`);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    assert.ok(Number.isFinite(pos.getX(i)), `${name} x is finite`);
    assert.ok(Number.isFinite(pos.getY(i)), `${name} y is finite`);
    assert.ok(Number.isFinite(pos.getZ(i)), `${name} z is finite`);
  }
}

test('GH-16 bag film is a sealed pouch with contents-shaped depth and wrinkles', () => {
  const a = createBagFilmGeometry({seed: 90210});
  const b = createBagFilmGeometry({seed: 90210});
  const c = createBagFilmGeometry({seed: 777});
  finiteGeometry(a, 'bag film');
  a.computeBoundingBox();
  const box = a.boundingBox;
  assert.ok(box.min.x < -BAG.width / 2 * 0.92 && box.max.x > BAG.width / 2 * 0.92, 'film keeps bag width');
  assert.ok(box.min.y >= -0.001 && box.max.y <= BAG.height + 0.002, 'film keeps bag height');
  assert.ok(box.max.z > 0.012, 'film bulges around the settled pile');
  assert.ok(Math.abs(box.max.z + box.min.z) < 0.004, 'front and back panels stay balanced');
  assert.equal(a.attributes.position.count, b.attributes.position.count, 'deterministic film vertex count');
  let same = true;
  for (let i = 0; i < a.attributes.position.count; i += 37) {
    if (Math.abs(a.attributes.position.getZ(i) - c.attributes.position.getZ(i)) > 1e-6) {
      same = false;
      break;
    }
  }
  assert.equal(same, false, 'film wrinkles vary by seed');
  assert.ok(pouchHalfDepth(0.06) > pouchHalfDepth(0.012), 'pouch is fuller over the pile than at the bottom seal');
  assert.ok(pouchHalfDepth(0.06) > pouchHalfDepth(0.118), 'pouch gathers before the zip seal');
});

test('GH-16 bag contents use varied buds in a settled bottom-up pile', () => {
  const geos = createBagContentGeometries();
  assert.equal(geos.length, BAG.variants, 'contents use a wide variant pool, not three repeated balls');
  const first = layoutBagContents(geos);
  const second = layoutBagContents(geos);
  assert.equal(first.length, BAG.count, 'full stock shows the complete settled pile');
  for (let i = 0; i < first.length; i++) {
    const p = first[i].position;
    assert.ok(p.x >= -BAG.contentHalfWidth && p.x <= BAG.contentHalfWidth, 'bud stays inside the pouch width');
    assert.ok(p.y >= BAG.contentBottom && p.y <= BAG.contentTop + 0.012, 'bud stays inside the pouch height');
    assert.ok(Math.abs(p.z) <= contentHalfDepth(p.y) + first[i].nominal * 0.25, 'bud stays inside the film depth');
    assert.ok(first[i].scale.x > 0.5 && first[i].scale.x < 1.5, 'bud scale stays plausible');
    assert.ok(first[i].scale.y > 0.5 && first[i].scale.y < 1.5, 'bud scale stays plausible');
    assert.ok(first[i].scale.z > 0.5 && first[i].scale.z < 1.5, 'bud scale stays plausible');
    if (i > 0) {
      assert.ok(p.y >= first[i - 1].position.y - 1e-9, 'stock depletion removes upper buds before lower buds');
      assert.notEqual(first[i].variant, first[i - 1].variant, 'adjacent settled buds are not the same variant');
    }
    assert.deepEqual(p.toArray(), second[i].position.toArray(), 'bag packing is deterministic');
    assert.equal(first[i].variant, second[i].variant, 'variant assignment is deterministic');
  }
});