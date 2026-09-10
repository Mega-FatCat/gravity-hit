import * as T from 'three';
import {createBudGeometry} from './bud.js';

export const BAG = {
  width: 0.092,
  height: 0.132,
  minHalf: 0.0012,
  maxHalf: 0.0185,
  bottom: 0.006,
  top: 0.124,
  contentBottom: 0.016,
  contentTop: 0.104,
  contentHalfWidth: 0.0355,
  count: 35,
  variants: 9,
  seed: 1601
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function pouchHalfDepth(y) {
  const t = clamp((y - BAG.bottom) / (BAG.top - BAG.bottom), 0, 1);
  const profile = Math.pow(Math.sin(Math.PI * t), 0.7);
  return BAG.minHalf + (BAG.maxHalf - BAG.minHalf) * profile;
}

export function contentHalfDepth(y) {
  return Math.max(0, pouchHalfDepth(y) - 0.0025);
}

export function createBagFilmGeometry(options = {}) {
  const width = options.width || BAG.width;
  const height = options.height || BAG.height;
  const depth = options.depth || 0.034;
  const seed = options.seed || 90210;
  const geo = new T.BoxGeometry(width, height, depth, 30, 30, 10);
  geo.translate(0, height / 2, 0);
  const rng = mulberry32(seed);
  const p1 = rng() * Math.PI * 2;
  const p2 = rng() * Math.PI * 2;
  const p3 = rng() * Math.PI * 2;
  const p4 = rng() * Math.PI * 2;
  const p5 = rng() * Math.PI * 2;
  const p6 = rng() * Math.PI * 2;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    const z = pos.getZ(i);
    const u = x / (width / 2);
    const v = (y - height / 2) / (height / 2);
    const edge = Math.min(1 - u * u, 1 - v * v);
    const body = smoothstep(0.02, 0.38, edge);
    const half = pouchHalfDepth(y);
    const target = BAG.minHalf + (half - BAG.minHalf) * body;
    const side = z === 0 ? 0 : Math.sign(z);
    const corner = smoothstep(0.70, 0.98, Math.abs(u)) * smoothstep(0.50, 0.98, Math.abs(v));
    x *= 1 - 0.055 * corner;
    const loose = 1 - body;
    const amp = 0.00045 + 0.00135 * loose;
    const w = (Math.sin(x * 88 + p1) * Math.sin(y * 57 + p2) * 0.48 +
      Math.sin(x * 34 - y * 79 + p3) * 0.34 +
      Math.sin(x * 163 + y * 121 + p4) * 0.18) * amp;
    const zip = smoothstep(0.098, 0.122, y);
    const gather = Math.sin(x * 205 + p5) * 0.00065 * zip * (0.35 + 0.65 * loose);
    const crease = Math.pow(Math.abs(Math.sin(x * 43 + y * 29 + p6)), 10) * 0.0011 * (0.25 + 0.75 * loose);
    let nz = side * target + side * (w + gather + crease);
    y += Math.sin(x * 120 + p2) * 0.00045 * zip * loose;
    pos.setXYZ(i, x, y, nz);
  }
  geo.computeVertexNormals();
  return geo;
}

export function createBagFilmMaterial() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  let s = 4242;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const idx = (y * size + x) * 4;
      const longWave = Math.sin(u * 22.0 + v * 5.0) * 0.5 + Math.sin(u * 7.0 - v * 13.0) * 0.3 + Math.sin(u * 37.0 + v * 29.0) * 0.2;
      const cross = Math.sin((u * 2.0 - v * 9.0) * Math.PI + Math.sin(v * 24.0) * 0.8);
      const crease = Math.pow(Math.abs(Math.sin(u * 19.0 + v * 11.0)), 12);
      const bead = rnd() > 0.985 ? rnd() - 0.5 : 0;
      const nx = Math.max(-127, Math.min(127, (longWave * 0.34 + cross * 0.10 + bead * 0.8) * 90));
      const ny = Math.max(-127, Math.min(127, (Math.cos(u * 17.0 + v * 23.0) * 0.30 + bead * 0.6) * 90));
      data[idx] = Math.round(128 + nx);
      data[idx + 1] = Math.round(128 + ny);
      data[idx + 2] = 255;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = 8;
  return new T.MeshPhysicalMaterial({
    color: '#dfe9dc',
    roughness: 0.30,
    metalness: 0,
    transmission: 0.78,
    thickness: 0.0011,
    ior: 1.46,
    transparent: true,
    opacity: 0.50,
    side: T.DoubleSide,
    depthWrite: false,
    envMapIntensity: 1.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.28,
    normalMap: tex,
    normalScale: new T.Vector2(0.55, 0.55)
  });
}

export function createBagSeal() {
  const group = new T.Group();
  group.name = 'bag-seal';
  const bandMat = new T.MeshPhysicalMaterial({
    color: '#cfe0d2',
    roughness: 0.34,
    metalness: 0,
    transmission: 0.35,
    thickness: 0.0015,
    transparent: true,
    opacity: 0.78,
    side: T.DoubleSide,
    depthWrite: false,
    envMapIntensity: 0.9
  });
  const band = new T.Mesh(new T.BoxGeometry(BAG.width + 0.003, 0.0055, 0.020), bandMat);
  band.position.set(0, 0.1255, 0);
  band.castShadow = true;
  band.receiveShadow = true;
  band.renderOrder = 3;
  group.add(band);
  const railMat = new T.MeshStandardMaterial({color: '#5f7f66', roughness: 0.5});
  for (const dy of [-0.0014, 0.0014]) {
    const rail = new T.Mesh(new T.BoxGeometry(BAG.width + 0.0022, 0.0011, 0.0215), railMat);
    rail.position.set(0, 0.1255 + dy, 0);
    rail.castShadow = true;
    rail.receiveShadow = true;
    group.add(rail);
  }
  const crimpMat = new T.MeshStandardMaterial({color: '#476b52', roughness: 0.55});
  for (const sx of [-1, 1]) {
    const crimp = new T.Mesh(new T.BoxGeometry(0.004, 0.007, 0.022), crimpMat);
    crimp.position.set(sx * (BAG.width / 2 - 0.001), 0.1255, 0);
    crimp.castShadow = true;
    crimp.receiveShadow = true;
    group.add(crimp);
  }
  return group;
}

export function createBagContentGeometries(count = BAG.variants) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const geo = createBudGeometry({
      seed: 201 + i * 7,
      scale: 0.72,
      calyxCount: 44 + (i % 3) * 2,
      leafCount: 14 + (i % 5),
      pistilCount: 22 + (i % 5)
    });
    geo.computeBoundingSphere();
    geos.push(geo);
  }
  return geos;
}

function relaxPlaced(placed) {
  for (let iter = 0; iter < 60; iter++) {
    let moved = false;
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const rr = a.r + b.r;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < rr * rr && d2 > 1e-12) {
          const d = Math.sqrt(d2);
          const push = (rr - d) / 2;
          a.x -= dx / d * push;
          a.y -= dy / d * push;
          a.z -= dz / d * push;
          b.x += dx / d * push;
          b.y += dy / d * push;
          b.z += dz / d * push;
          moved = true;
        }
      }
    }
    for (const p of placed) {
      const xLim = Math.max(0, BAG.contentHalfWidth - p.r);
      p.x = clamp(p.x, -xLim, xLim);
      const hz = contentHalfDepth(p.y);
      const zLim = Math.max(0, hz - p.r);
      p.z = zLim === 0 ? 0 : clamp(p.z, -zLim, zLim);
      p.y = clamp(p.y, BAG.contentBottom + p.r, BAG.contentTop + p.r + 0.004);
    }
    if (!moved) break;
  }
}

export function layoutBagContents(geometries, options = {}) {
  const count = options.count || BAG.count;
  const seed = options.seed || BAG.seed;
  const rng = mulberry32(seed);
  const bases = geometries.map((g) => {
    if (!g.boundingSphere) g.computeBoundingSphere();
    return g.boundingSphere.radius;
  });
  if (bases.length < 3) throw new Error('Bag contents need at least three bud variants.');
  const slots = [];
  for (let i = 0; i < count; i++) {
    const nominal = 0.0052 * (0.94 + 0.24 * rng());
    const x = (((rng() + rng() + rng() + rng()) / 4) * 2 - 1) * Math.max(0.004, BAG.contentHalfWidth - nominal * 1.06);
    slots.push({
      nominal,
      x,
      zBias: rng() * 2 - 1,
      z: 0
    });
  }
  const order = slots.map((s, i) => i).sort((a, b) => slots[b].nominal - slots[a].nominal);
  const placed = [];
  for (const idx of order) {
    const s = slots[idx];
    const r = s.nominal * 1.06;
    let y = BAG.contentTop + r + 0.004;
    s.z = 0;
    for (let guard = 0; guard < 240; guard++) {
      const nextY = y - 0.0012;
      const floorY = BAG.contentBottom + r;
      if (nextY <= floorY) {
        y = floorY;
        break;
      }
      const hz = contentHalfDepth(nextY);
      const allow = Math.max(0, hz - r);
      const z = allow === 0 ? 0 : clamp(s.zBias * hz * 0.78, -allow, allow);
      let hit = false;
      for (const q of placed) {
        const dx = s.x - q.x;
        const dy = nextY - q.y;
        const dz = z - q.z;
        const rr = r + q.r;
        if (dx * dx + dy * dy + dz * dz < rr * rr) {
          hit = true;
          break;
        }
      }
      if (hit) break;
      y = nextY;
      s.z = z;
    }
    placed.push({x: s.x, y, z: s.z, r, nominal: s.nominal});
  }
  relaxPlaced(placed);
  placed.sort((a, b) => a.y - b.y || a.x - b.x);
  const items = [];
  let k = 0;
  let prev = -1;
  for (const p of placed) {
    let v = k % bases.length;
    let guard = 0;
    while (v === prev && guard < bases.length) {
      k++;
      v = k % bases.length;
      guard++;
    }
    const base = bases[v];
    const fit = clamp(p.nominal / base, 0.82, 1.22);
    const scale = new T.Vector3(
      fit * (0.94 + rng() * 0.12),
      fit * (0.88 + rng() * 0.14),
      fit * (0.94 + rng() * 0.12)
    );
    const maxRX = Math.max(0.0012, BAG.contentHalfWidth - Math.abs(p.x) - 0.001);
    if (base * scale.x > maxRX) scale.x = Math.max(0.55, maxRX / base);
    const maxRZ = Math.max(0.0012, pouchHalfDepth(p.y) - Math.abs(p.z) - 0.0003);
    if (base * scale.z > maxRZ) scale.z = Math.max(0.55, maxRZ / base);
    const rotation = new T.Euler(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2);
    items.push({
      variant: v,
      nominal: p.nominal,
      position: new T.Vector3(p.x, p.y, p.z),
      rotation,
      scale
    });
    prev = v;
    k++;
  }
  return items;
}

export function createWeedBag(budMaterial, options = {}) {
  const group = new T.Group();
  group.name = 'weed-bag';
  const film = new T.Mesh(createBagFilmGeometry(options.film), createBagFilmMaterial());
  film.name = 'bag-film';
  film.castShadow = false;
  film.receiveShadow = false;
  film.renderOrder = 4;
  group.add(film);
  group.add(createBagSeal());
  const geometries = options.geometries || createBagContentGeometries(options.variants);
  const layout = layoutBagContents(geometries, {count: options.count, seed: options.seed});
  const contents = layout.map((item) => {
    const bud = new T.Mesh(geometries[item.variant], budMaterial);
    bud.position.copy(item.position);
    bud.rotation.copy(item.rotation);
    bud.scale.copy(item.scale);
    bud.castShadow = true;
    bud.receiveShadow = true;
    group.add(bud);
    return bud;
  });
  return {group, film, contents, geometries, layout};
}