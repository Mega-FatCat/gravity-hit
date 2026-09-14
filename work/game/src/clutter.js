import * as T from 'three';
import { forestHeight, creekX, creekWidth } from './environment.js';

const TAU = Math.PI * 2;
const UP = new T.Vector3(0, 1, 0);
const lerp = T.MathUtils.lerp;

function pseudoRandom(seed) {
  let s = seed | 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 0) / 4294967296);
  };
}

function computeTerrainNormal(x, z, eps = 0.08) {
  const hL = forestHeight(x - eps, z);
  const hR = forestHeight(x + eps, z);
  const hD = forestHeight(x, z - eps);
  const hU = forestHeight(x, z + eps);
  const slopeX = (hR - hL) / (2 * eps);
  const slopeZ = (hU - hD) / (2 * eps);
  return new T.Vector3(-slopeX, 1.0, -slopeZ).normalize();
}

function mergeBufferGeometries(geometries) {
  let totalVerts = 0, totalIndices = 0;
  for (const g of geometries) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : 0;
  }
  const pos = new Float32Array(totalVerts * 3);
  const norm = new Float32Array(totalVerts * 3);
  const uv = new Float32Array(totalVerts * 2);
  const col = new Float32Array(totalVerts * 3);
  const idx = new Uint32Array(totalIndices);

  let vOffset = 0, iOffset = 0;
  for (const g of geometries) {
    const vCount = g.attributes.position.count;
    pos.set(g.attributes.position.array, vOffset * 3);
    if (g.attributes.normal) norm.set(g.attributes.normal.array, vOffset * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, vOffset * 2);
    if (g.attributes.color) col.set(g.attributes.color.array, vOffset * 3);

    if (g.index) {
      for (let i = 0; i < g.index.count; i++) {
        idx[iOffset + i] = g.index.array[i] + vOffset;
      }
      iOffset += g.index.count;
    }
    vOffset += vCount;
    g.dispose();
  }

  const merged = new T.BufferGeometry();
  merged.setAttribute('position', new T.BufferAttribute(pos, 3));
  if (norm.some(v => v !== 0)) merged.setAttribute('normal', new T.BufferAttribute(norm, 3));
  if (uv.some(v => v !== 0)) merged.setAttribute('uv', new T.BufferAttribute(uv, 2));
  if (col.some(v => v !== 0)) merged.setAttribute('color', new T.BufferAttribute(col, 3));
  merged.setIndex(new T.BufferAttribute(idx, 1));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

// Normalized UV sub-rectangles from forrest_ground_01 sampling authentic leaf clusters
const GROUND_LEAF_PATCHES = [
  { u0: 0.635, v0: 0.488, u1: 0.685, v1: 0.538 },
  { u0: 0.488, v0: 0.488, u1: 0.538, v1: 0.538 },
  { u0: 0.562, v0: 0.488, u1: 0.612, v1: 0.538 },
  { u0: 0.854, v0: 0.415, u1: 0.904, v1: 0.465 },
  { u0: 0.635, v0: 0.562, u1: 0.685, v1: 0.612 }
];

/**
 * Procedural curved thick branch geometry with knot swells, fibrous splintered breaks,
 * and high-density UVs for 4K Scots pine bark PBR mapping.
 */
export function createStickGeometry({
  length = 0.38,
  radiusStart = 0.019,
  radiusEnd = 0.012,
  radial = 24,
  segments = 28,
  seed = 4123
} = {}) {
  const r = pseudoRandom(seed);
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const spine = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const bendY = Math.sin(t * Math.PI) * 0.016 + (r() - 0.5) * 0.006;
    const bendZ = (r() - 0.5) * 0.014;
    spine.push(new T.Vector3(t * length - length * 0.5, bendY, bendZ));
  }

  const knot1 = 0.32 + (r() - 0.5) * 0.1;
  const knot2 = 0.68 + (r() - 0.5) * 0.1;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let rad = lerp(radiusStart, radiusEnd, t);

    // Natural knot swell
    const dKnot1 = Math.abs(t - knot1), dKnot2 = Math.abs(t - knot2);
    if (dKnot1 < 0.12) rad *= (1.0 + (1.0 - dKnot1 / 0.12) * 0.35);
    if (dKnot2 < 0.12) rad *= (1.0 + (1.0 - dKnot2 / 0.12) * 0.30);

    const pCenter = spine[i];
    const tangent = (i < segments ? spine[i + 1].clone().sub(pCenter) : pCenter.clone().sub(spine[i - 1])).normalize();
    const up = Math.abs(tangent.y) > 0.88 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(tangent, up).normalize();
    const realUp = new T.Vector3().crossVectors(right, tangent).normalize();

    for (let j = 0; j <= radial; j++) {
      const uFrac = j / radial;
      const angle = uFrac * TAU;
      const radNoise = rad * (0.90 + r() * 0.20);
      const cosA = Math.cos(angle), sinA = Math.sin(angle);
      const offset = right.clone().multiplyScalar(cosA * radNoise).add(realUp.clone().multiplyScalar(sinA * radNoise));
      const pos = pCenter.clone().add(offset);

      positions.push(pos.x, pos.y, pos.z);
      uvs.push(uFrac * 2.5, t * 4.0);

      // Weathered bark tones matching forrest_ground_01 wood clusters
      const isLichen = r() < 0.14;
      const col = isLichen ? new T.Color('#7a8852') : new T.Color('#8a7662').multiplyScalar(0.92 + r() * 0.16);
      colors.push(col.r, col.g, col.b);
    }
  }

  const ringStride = radial + 1;
  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const p0 = i * ringStride + j;
      const p1 = p0 + 1;
      const p2 = (i + 1) * ringStride + j;
      const p3 = p2 + 1;
      indices.push(p0, p2, p1);
      indices.push(p1, p2, p3);
    }
  }

  // Splintered fibrous broken end caps
  const woodFibers = new T.Color('#d4c4ae');

  // Start end cap:
  const startCenterIdx = positions.length / 3;
  positions.push(spine[0].x - 0.012, spine[0].y, spine[0].z);
  uvs.push(0.5, 0.5);
  colors.push(woodFibers.r, woodFibers.g, woodFibers.b);

  for (let j = 0; j < radial; j++) {
    const spikeLen = 0.005 + r() * 0.015;
    const spikeIdx = positions.length / 3;
    const ringP = positions.slice(j * 3, j * 3 + 3);
    positions.push(ringP[0] - spikeLen, ringP[1] + (r() - 0.5) * 0.003, ringP[2] + (r() - 0.5) * 0.003);
    uvs.push(0.5, 0.5);
    colors.push(woodFibers.r * 1.05, woodFibers.g * 1.05, woodFibers.b * 1.02);

    indices.push(startCenterIdx, j, spikeIdx);
    indices.push(spikeIdx, j, j + 1);
  }

  // End end cap:
  const endCenterIdx = positions.length / 3;
  const lastSpine = spine[segments];
  positions.push(lastSpine.x + 0.014, lastSpine.y, lastSpine.z);
  uvs.push(0.5, 0.5);
  colors.push(woodFibers.r, woodFibers.g, woodFibers.b);

  const lastRingStart = segments * ringStride;
  for (let j = 0; j < radial; j++) {
    const spikeLen = 0.005 + r() * 0.016;
    const spikeIdx = positions.length / 3;
    const ringP = positions.slice((lastRingStart + j) * 3, (lastRingStart + j) * 3 + 3);
    positions.push(ringP[0] + spikeLen, ringP[1] + (r() - 0.5) * 0.003, ringP[2] + (r() - 0.5) * 0.003);
    uvs.push(0.5, 0.5);
    colors.push(woodFibers.r * 1.05, woodFibers.g * 1.05, woodFibers.b * 1.02);

    indices.push(endCenterIdx, spikeIdx, lastRingStart + j);
    indices.push(spikeIdx, lastRingStart + j + 1, lastRingStart + j);
  }

  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Procedural Y-forked twig with branch collar swell and splintered tips.
 */
export function createForkTwigGeometry({
  stemLength = 0.28,
  forkLength = 0.16,
  radiusStem = 0.014,
  radiusFork = 0.009,
  radial = 20,
  segments = 24,
  seed = 6319
} = {}) {
  const r = pseudoRandom(seed);
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const barkCol = new T.Color('#82705e');

  // Main stem
  const stemSpine = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    stemSpine.push(new T.Vector3(t * stemLength - stemLength * 0.5, Math.sin(t * Math.PI) * 0.012, (r() - 0.5) * 0.008));
  }

  // Fork starts at t=0.48
  const forkStartIdx = 4;
  const forkOrigin = stemSpine[forkStartIdx];
  const forkAngle = 0.82 + (r() - 0.5) * 0.2;
  const forkSpine = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const fx = forkOrigin.x + Math.cos(forkAngle) * t * forkLength;
    const fz = forkOrigin.z + Math.sin(forkAngle) * t * forkLength;
    const fy = forkOrigin.y + Math.sin(t * Math.PI) * 0.008 + (r() - 0.5) * 0.004;
    forkSpine.push(new T.Vector3(fx, fy, fz));
  }

  // Build stem tube
  const ringStride = radial + 1;
  const stemStartVertex = positions.length / 3;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let rad = lerp(radiusStem, radiusStem * 0.65, t);
    if (Math.abs(t - 0.48) < 0.15) rad *= 1.32;
    const pCenter = stemSpine[i];
    const tangent = (i < segments ? stemSpine[i + 1].clone().sub(pCenter) : pCenter.clone().sub(stemSpine[Math.max(0, i - 1)])).normalize();
    const up = Math.abs(tangent.y) > 0.88 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(tangent, up).normalize();
    const realUp = new T.Vector3().crossVectors(right, tangent).normalize();

    for (let j = 0; j <= radial; j++) {
      const uFrac = j / radial;
      const angle = uFrac * TAU;
      const offset = right.clone().multiplyScalar(Math.cos(angle) * rad).add(realUp.clone().multiplyScalar(Math.sin(angle) * rad));
      const pos = pCenter.clone().add(offset);
      positions.push(pos.x, pos.y, pos.z);
      uvs.push(uFrac * 1.8, t * 3.0);
      const col = barkCol.clone().multiplyScalar(0.92 + r() * 0.16);
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const p0 = stemStartVertex + i * ringStride + j;
      const p1 = p0 + 1;
      const p2 = stemStartVertex + (i + 1) * ringStride + j;
      const p3 = p2 + 1;
      indices.push(p0, p2, p1);
      indices.push(p1, p2, p3);
    }
  }

  // Build fork tube
  const forkStartVertex = positions.length / 3;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const rad = lerp(radiusFork * 1.15, radiusFork * 0.55, t);
    const pCenter = forkSpine[i];
    const tangent = (i < segments ? forkSpine[i + 1].clone().sub(pCenter) : pCenter.clone().sub(forkSpine[Math.max(0, i - 1)])).normalize();
    const up = Math.abs(tangent.y) > 0.88 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
    const right = new T.Vector3().crossVectors(tangent, up).normalize();
    const realUp = new T.Vector3().crossVectors(right, tangent).normalize();

    for (let j = 0; j <= radial; j++) {
      const uFrac = j / radial;
      const angle = uFrac * TAU;
      const offset = right.clone().multiplyScalar(Math.cos(angle) * rad).add(realUp.clone().multiplyScalar(Math.sin(angle) * rad));
      const pos = pCenter.clone().add(offset);
      positions.push(pos.x, pos.y, pos.z);
      uvs.push(uFrac * 1.8, t * 2.0);
      const col = barkCol.clone().multiplyScalar(0.88 + r() * 0.20);
      colors.push(col.r, col.g, col.b);
    }
  }

  for (let i = 0; i < segments; i++) {
    for (let j = 0; j < radial; j++) {
      const p0 = forkStartVertex + i * ringStride + j;
      const p1 = p0 + 1;
      const p2 = forkStartVertex + (i + 1) * ringStride + j;
      const p3 = p2 + 1;
      indices.push(p0, p2, p1);
      indices.push(p1, p2, p3);
    }
  }

  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Procedural authentic 3D curved leaf blade with narrow stem (petiole),
 * smooth ovate expansion, acute apex tip, concave V-trough curl along midrib,
 * and ruffled wavy margins.
 * Samples genuine leaf patches directly from forrest_ground_01 for 100% texture & color harmony.
 */
export function createOrganicLeafGeometry({
  length = 0.058,
  width = 0.028,
  curl = 0.007,
  seed = 4123,
  patch = GROUND_LEAF_PATCHES[0],
  color = new T.Color('#c29b68')
} = {}) {
  const r = pseudoRandom(seed);
  const segL = 8;
  const segW = 6;
  const halfW = segW / 2;

  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  for (let i = 0; i <= segL; i++) {
    const t = i / segL;
    let wFactor;
    if (t < 0.12) {
      wFactor = 0.12 + (t / 0.12) * 0.15; // petiole stem
    } else {
      const bt = (t - 0.12) / 0.88;
      wFactor = Math.sin(Math.pow(bt, 0.72) * Math.PI) * (1.0 - bt * 0.35);
    }
    const currentW = width * Math.max(0.002, wFactor);

    // Spine elevation: arched in the center, touching ground at ends
    const spineY = Math.sin(t * Math.PI) * 0.0025 + (t > 0.75 ? Math.pow((t - 0.75) / 0.25, 2) * curl * 0.45 : 0);
    const zPos = t * length - length * 0.5;

    for (let j = 0; j <= segW; j++) {
      const u = (j - halfW) / halfW;
      const xPos = u * currentW * 0.5;

      // 3D Transverse trough curl: parabolic upward curl from midrib to margin
      const curlAmount = Math.pow(Math.abs(u), 1.6) * curl;
      // Margin wave crinkle
      const edgeWave = Math.abs(u) > 0.8 ? Math.sin(t * 22.0 + u * 4.0) * curl * 0.22 : 0;
      const yPos = spineY + curlAmount + edgeWave;

      positions.push(xPos, yPos, zPos);

      // Map UV directly into the forrest_ground_01 leaf patch
      const uCoord = lerp(patch.u0, patch.u1, u * 0.5 + 0.5);
      const vCoord = lerp(patch.v0, patch.v1, t);
      uvs.push(uCoord, vCoord);

      // Organic color shading: darker midrib vein, warm amber blade, desiccated edge
      const isVein = Math.abs(u) < 0.25;
      const isEdge = Math.abs(u) > 0.85;
      const tintMult = isVein ? 0.88 : isEdge ? 1.08 : 1.0;
      const col = color.clone().multiplyScalar(tintMult + (r() - 0.5) * 0.04);
      colors.push(col.r, col.g, col.b);
    }
  }

  const stride = segW + 1;
  for (let i = 0; i < segL; i++) {
    for (let j = 0; j < segW; j++) {
      const p0 = i * stride + j;
      const p1 = p0 + 1;
      const p2 = (i + 1) * stride + j;
      const p3 = p2 + 1;
      indices.push(p0, p2, p1);
      indices.push(p1, p2, p3);
    }
  }

  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Natural cluster of 3–4 organic leaves nestled together in ground hollows,
 * layered without z-fighting and matched to the color palette of forrest_ground_01.
 */
export function createLeafClusterGeometry({ count = 4, radius = 0.075, seed = 5102 } = {}) {
  const r = pseudoRandom(seed);
  const geometries = [];

  const leafColors = [
    new T.Color('#d2ab70'), // Warm amber-gold dry leaf
    new T.Color('#be9662'), // Warm ochre-tan leaf
    new T.Color('#a89a6e'), // Olive-tan decaying leaf
    new T.Color('#ddba85')  // Pale birch leaf
  ];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + (r() - 0.5) * 0.4;
    const dist = (0.20 + r() * 0.80) * radius;
    const lx = Math.cos(angle) * dist;
    const lz = Math.sin(angle) * dist;
    const ly = 0.001 + i * 0.0035;

    const leafLen = 0.046 + r() * 0.022;
    const leafWid = 0.022 + r() * 0.012;
    const curl = 0.005 + r() * 0.005;
    const color = leafColors[(i + (r() * 4 | 0)) % leafColors.length];
    const patch = GROUND_LEAF_PATCHES[(i + (r() * 5 | 0)) % GROUND_LEAF_PATCHES.length];

    const leafGeo = createOrganicLeafGeometry({
      length: leafLen,
      width: leafWid,
      curl,
      seed: (seed + i * 719) | 0,
      patch,
      color
    });

    const rotY = (r() - 0.5) * TAU;
    const tiltX = (r() - 0.5) * 0.12;
    const tiltZ = (r() - 0.5) * 0.12;

    leafGeo.rotateX(tiltX);
    leafGeo.rotateZ(tiltZ);
    leafGeo.rotateY(rotY);
    leafGeo.translate(lx, ly, lz);
    geometries.push(leafGeo);
  }

  const merged = mergeBufferGeometries(geometries);
  merged.computeBoundingBox();
  if (merged.boundingBox) {
    merged.translate(0, -merged.boundingBox.min.y, 0);
    merged.computeBoundingBox();
  }
  return merged;
}

/**
 * Scots pine needle tuft (fascicles of paired needles with natural arc and twist).
 * Authentic Scots pine forest-floor litter matching the needle pattern in forrest_ground_01.
 */
export function createPineNeedleTuftGeometry({ fascicles = 6, seed = 8124 } = {}) {
  const r = pseudoRandom(seed);
  const positions = [];
  const uvs = [];
  const colors = [];
  const indices = [];
  const baseCol = new T.Color('#b2763c'); // Warm Scots pine needle amber-brown

  for (let f = 0; f < fascicles; f++) {
    const angle = (f / fascicles) * TAU + (r() - 0.5) * 0.45;
    const originX = Math.cos(angle) * (r() * 0.012);
    const originZ = Math.sin(angle) * (r() * 0.012);

    for (let n = 0; n < 2; n++) {
      const needleAngle = angle + (n === 0 ? -0.16 : 0.16) + (r() - 0.5) * 0.2;
      const needleLen = 0.055 + r() * 0.024;
      const needleW = 0.0016;
      const segments = 6;
      const arch = 0.004 + r() * 0.005;
      const sideCurve = (r() - 0.5) * 0.012;

      const cosA = Math.cos(needleAngle), sinA = Math.sin(needleAngle);
      const perpX = -sinA, perpZ = cosA;

      const startIdx = positions.length / 3;
      for (let s = 0; s <= segments; s++) {
        const t = s / segments;
        const dist = t * needleLen;
        const curArch = Math.sin(t * Math.PI) * arch;
        const curSide = Math.sin(t * Math.PI * 0.7) * sideCurve;

        const px = originX + cosA * dist + perpX * curSide;
        const pz = originZ + sinA * dist + perpZ * curSide;
        const py = curArch + (1.0 - t) * 0.001;

        const w = needleW * (1.0 - t * 0.5);
        positions.push(px - perpX * w * 0.5, py, pz - perpZ * w * 0.5);
        positions.push(px + perpX * w * 0.5, py, pz + perpZ * w * 0.5);
        uvs.push(0, t, 1, t);

        const col = baseCol.clone().multiplyScalar(0.85 + t * 0.30 + (r() - 0.5) * 0.06);
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      }

      for (let s = 0; s < segments; s++) {
        const p0 = startIdx + s * 2;
        const p1 = p0 + 1;
        const p2 = startIdx + (s + 1) * 2;
        const p3 = p2 + 1;
        indices.push(p0, p2, p1);
        indices.push(p1, p2, p3);
      }
    }
  }

  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  if (geom.boundingBox) {
    geom.translate(0, -geom.boundingBox.min.y, 0);
    geom.computeBoundingBox();
  }
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Chunky Scots pine bark flake with organic 8-sided perimeter, 6mm thickness, and beveled skirts.
 */
export function createBarkFlakeGeometry({ length = 0.075, width = 0.045, thickness = 0.0055, seed = 7129 } = {}) {
  const r = pseudoRandom(seed);
  const numPts = 8;
  const topPts = [];
  const botPts = [];

  for (let i = 0; i < numPts; i++) {
    const angle = (i / numPts) * TAU + (r() - 0.5) * 0.28;
    const radX = (length * 0.5) * (0.75 + r() * 0.45);
    const radZ = (width * 0.5) * (0.72 + r() * 0.48);
    const px = Math.cos(angle) * radX;
    const pz = Math.sin(angle) * radZ;
    const py = (r() - 0.5) * 0.0015;
    topPts.push(new T.Vector3(px, py + thickness, pz));
    botPts.push(new T.Vector3(px, py, pz));
  }

  const topCenter = new T.Vector3(0, thickness * 1.05, 0);
  const botCenter = new T.Vector3(0, 0, 0);

  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const barkTone = new T.Color('#946b4c');
  const edgeTone = new T.Color('#80593e');

  // Top fan
  const topCenterIdx = positions.length / 3;
  positions.push(topCenter.x, topCenter.y, topCenter.z);
  normals.push(0, 1, 0);
  uvs.push(0.5, 0.5);
  colors.push(barkTone.r, barkTone.g, barkTone.b);

  const topStartIdx = positions.length / 3;
  for (let i = 0; i < numPts; i++) {
    const p = topPts[i];
    positions.push(p.x, p.y, p.z);
    normals.push(0, 1, 0);
    uvs.push(0.5 + (p.x / length) * 0.45, 0.5 + (p.z / width) * 0.45);
    const c = barkTone.clone().multiplyScalar(0.92 + r() * 0.16);
    colors.push(c.r, c.g, c.b);
  }
  for (let i = 0; i < numPts; i++) {
    const next = (i + 1) % numPts;
    indices.push(topCenterIdx, topStartIdx + i, topStartIdx + next);
  }

  // Bottom fan
  const botCenterIdx = positions.length / 3;
  positions.push(botCenter.x, botCenter.y, botCenter.z);
  normals.push(0, -1, 0);
  uvs.push(0.5, 0.5);
  colors.push(edgeTone.r, edgeTone.g, edgeTone.b);

  const botStartIdx = positions.length / 3;
  for (let i = 0; i < numPts; i++) {
    const p = botPts[i];
    positions.push(p.x, p.y, p.z);
    normals.push(0, -1, 0);
    uvs.push(0.5 + (p.x / length) * 0.45, 0.5 + (p.z / width) * 0.45);
    colors.push(edgeTone.r, edgeTone.g, edgeTone.b);
  }
  for (let i = 0; i < numPts; i++) {
    const next = (i + 1) % numPts;
    indices.push(botCenterIdx, botStartIdx + next, botStartIdx + i);
  }

  // Edge skirts
  for (let i = 0; i < numPts; i++) {
    const next = (i + 1) % numPts;
    const t0 = topStartIdx + i;
    const t1 = topStartIdx + next;
    const b0 = botStartIdx + i;
    const b1 = botStartIdx + next;
    indices.push(t0, b0, t1);
    indices.push(t1, b0, b1);
  }

  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  // Center thickness so lower perimeter skirt embeds naturally into loam/duff
  geom.translate(0, -thickness * 0.5, 0);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Small river granite / loam pebble textured with sandy_gravel maps and dark moss tones.
 */
export function createPebbleGeometry({ radius = 0.034, heightScale = 0.55, roughness = 0.20, seed = 7123 } = {}) {
  const geom = new T.IcosahedronGeometry(radius, 3);
  const pos = geom.attributes.position;
  const uvs = [];
  const colors = [];
  const r = pseudoRandom(seed);
  const stoneCol = new T.Color('#4e493e'); // Dark damp river granite / loam stone
  const mossCol = new T.Color('#404828');  // Dark olive moss undertone

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i) * heightScale;
    let z = pos.getZ(i);

    const noiseFactor = 1.0 + (r() - 0.5) * roughness;
    if (y < 0) y *= 0.65;
    pos.setXYZ(i, x * noiseFactor, y * noiseFactor, z * noiseFactor);

    const u = 0.5 + Math.atan2(z, x) / TAU;
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, y / radius))) / Math.PI;
    uvs.push(u * 2.0, v * 2.0);

    const isBottom = y < 0.002;
    const col = isBottom ? mossCol.clone().multiplyScalar(0.92 + r() * 0.16) : stoneCol.clone().multiplyScalar(0.92 + r() * 0.16);
    colors.push(col.r, col.g, col.b);
  }

  geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * Scots pine cone with woody scales radiating in Fibonacci spiral phyllotaxis.
 */
export function createPineConeGeometry({ length = 0.065, radius = 0.026, radial = 8, tiers = 7, seed = 8923 } = {}) {
  const r = pseudoRandom(seed);
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const indices = [];

  const baseCol = new T.Color('#856344');
  const innerCol = new T.Color('#58402a');

  const spindleStride = radial + 1;
  const startSpindleIdx = positions.length / 3;
  for (let i = 0; i <= tiers; i++) {
    const t = i / tiers;
    const rad = Math.sin(t * Math.PI) * radius * 0.45 + 0.003;
    const py = t * length;
    for (let j = 0; j <= radial; j++) {
      const uFrac = j / radial;
      const angle = uFrac * TAU;
      positions.push(Math.cos(angle) * rad, py, Math.sin(angle) * rad);
      normals.push(Math.cos(angle), 0, Math.sin(angle));
      uvs.push(uFrac, t);
      colors.push(innerCol.r, innerCol.g, innerCol.b);
    }
  }

  for (let i = 0; i < tiers; i++) {
    for (let j = 0; j < radial; j++) {
      const p0 = startSpindleIdx + i * spindleStride + j;
      const p1 = p0 + 1;
      const p2 = startSpindleIdx + (i + 1) * spindleStride + j;
      const p3 = p2 + 1;
      indices.push(p0, p2, p1);
      indices.push(p1, p2, p3);
    }
  }

  const goldenAngle = 2.399963;
  const scaleCount = 36;
  for (let s = 0; s < scaleCount; s++) {
    const t = (s + 2) / (scaleCount + 4);
    const angle = s * goldenAngle;
    const radProfile = Math.sin(t * Math.PI) * radius;
    const py = t * length;

    const scaleLen = radProfile * (0.85 + r() * 0.30);
    const scaleWid = radProfile * 0.45;
    const cosA = Math.cos(angle), sinA = Math.sin(angle);
    const perpX = -sinA, perpZ = cosA;

    const startIdx = positions.length / 3;
    const bx = cosA * (radProfile * 0.35), bz = sinA * (radProfile * 0.35);
    const tx = cosA * (radProfile * 0.35 + scaleLen), tz = sinA * (radProfile * 0.35 + scaleLen);
    const ty = py + scaleLen * 0.28;

    positions.push(bx - perpX * scaleWid * 0.5, py, bz - perpZ * scaleWid * 0.5);
    positions.push(bx + perpX * scaleWid * 0.5, py, bz + perpZ * scaleWid * 0.5);
    positions.push(tx, ty, tz);

    normals.push(cosA, 0.4, sinA);
    normals.push(cosA, 0.4, sinA);
    normals.push(cosA, 0.4, sinA);

    uvs.push(0, 0, 1, 0, 0.5, 1);

    const c = baseCol.clone().multiplyScalar(0.88 + t * 0.25 + (r() - 0.5) * 0.08);
    colors.push(c.r, c.g, c.b, c.r, c.g, c.b, c.r * 1.05, c.g * 1.05, c.b * 1.05);

    indices.push(startIdx, startIdx + 1, startIdx + 2);
  }

  const geom = new T.BufferGeometry();
  geom.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geom.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));
  geom.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geom.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  // Natural fallen orientation: rotate cone to lie horizontally along the X axis
  geom.rotateZ(-Math.PI * 0.5);
  geom.translate(length * 0.5, 0, 0);
  geom.computeBoundingBox();
  // Settle cone so lowest scales are partially embedded below ground plane
  const bb = geom.boundingBox;
  geom.translate(0, -bb.min.y - radius * 0.36, 0);
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

function sourceMeshes(model) {
  const meshes = [];
  model.traverse(o => { if (o.isMesh) meshes.push(o); });
  return meshes;
}

function groundedGeometry(source) {
  const g = source.geometry.clone();
  g.computeBoundingBox();
  const b = g.boundingBox, c = b.getCenter(new T.Vector3());
  g.translate(-c.x, -b.min.y, -c.z);
  g.computeBoundingBox();
  return g;
}

function scanMaterial(source, world) {
  const m = source.clone();
  // Preserve the photogrammetry albedo instead of bleaching the scan.  Ground
  // wood in the reference is rough, low-contrast and locally varied rather
  // than a bright, normal-map-sharpened prop.
  m.color.setRGB(0.96, 0.94, 0.90);
  m.roughness = 0.96;
  m.metalness = 0;
  m.side = T.DoubleSide;
  m.envMapIntensity = 0.46;
  m.normalScale?.set(1.05, 1.05);
  if (m.map) { m.map.anisotropy = 16; m.map.needsUpdate = true; }
  if (m.normalMap) { m.normalMap.anisotropy = 16; m.normalMap.needsUpdate = true; }
  return m;
}

/**
 * Natural organic placement generator strictly enforcing gameplay clearances.
 */
export function generateClutterPlacements({ seed = 91402 } = {}) {
  const r = pseudoRandom(seed);

  const scannedBranches = [];
  const sticks = [];
  const forks = [];
  const leafClusters = [];
  const needleTufts = [];
  const barkFlakes = [];
  const pebbles = [];
  const pineCones = [];

  function isAllowed(x, z) {
    // 1. Ritual slab top is strictly protected:
    if (Math.hypot(x, z - 0.83) < 0.78) return false;
    // 2. Player feet stance protected:
    if (Math.hypot(x, z - 2.65) < 0.52) return false;
    // 3. Central view corridor between player and bottle stream:
    if (Math.abs(x) < 0.22 && z > 0.45 && z < 2.30) return false;
    return true;
  }

  function addInstance(list, x, z, sMin, sMax, yOffset = 0, tintMult = 1.0) {
    if (!isAllowed(x, z)) return;
    const y = forestHeight(x, z) + yOffset;
    const n = computeTerrainNormal(x, z);
    const rot = r() * TAU;
    const jx = (r() - 0.5) * 0.08;
    const jz = (r() - 0.5) * 0.08;
    const s = lerp(sMin, sMax, r());
    const tint = (0.94 + r() * 0.12) * tintMult;

    // Physical orientation: yaw around local Y, then align local Y to surface normal n
    const qYaw = new T.Quaternion().setFromAxisAngle(UP, rot);
    const qAlign = new T.Quaternion().setFromUnitVectors(UP, n);
    const qWobble = new T.Quaternion().setFromEuler(new T.Euler(jx * 0.5, 0, jz * 0.5));
    const quaternion = new T.Quaternion().copy(qAlign).multiply(qYaw).multiply(qWobble);

    list.push({ x, y, z, s, rot, quaternion, tint });
  }

  function addElongatedInstance(list, x, z, sMin, sMax, nominalLength, embedDepth = 0.009, tintMult = 1.0) {
    if (!isAllowed(x, z)) return;
    const rot = r() * TAU;
    const jx = (r() - 0.5) * 0.08;
    const jz = (r() - 0.5) * 0.08;
    const s = lerp(sMin, sMax, r());
    const tint = (0.94 + r() * 0.12) * tintMult;

    const halfLen = (nominalLength * s) * 0.5;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    // Sample terrain along longitudinal axis so both ends make solid ground contact
    const x1 = x - cosR * halfLen, z1 = z - sinR * halfLen;
    const x2 = x + cosR * halfLen, z2 = z + sinR * halfLen;
    const h1 = forestHeight(x1, z1);
    const h2 = forestHeight(x2, z2);
    const hMid = forestHeight(x, z);

    const p1 = new T.Vector3(x1, h1 - embedDepth, z1);
    const p2 = new T.Vector3(x2, h2 - embedDepth, z2);

    const dir = new T.Vector3().subVectors(p2, p1);
    if (dir.lengthSq() < 1e-6) dir.set(cosR, 0, sinR);
    dir.normalize();

    const n = computeTerrainNormal(x, z);
    const up = new T.Vector3().subVectors(n, dir.clone().multiplyScalar(n.dot(dir))).normalize();
    const right = new T.Vector3().crossVectors(dir, up).normalize();

    const mat = new T.Matrix4().makeBasis(dir, up, right);
    const quaternion = new T.Quaternion().setFromRotationMatrix(mat);

    // Prevent mid-span floating on convex knolls
    let midY = (p1.y + p2.y) * 0.5;
    if (hMid - embedDepth > midY) {
      midY = hMid - embedDepth;
    }

    list.push({
      x,
      y: midY,
      z,
      s,
      rot,
      quaternion,
      tint
    });
  }

  // 1. Scanned photogrammetry branch placements in foreground/near-field & river reach
  const fgBranchCoords = [
    [0.82, 1.38, 0.32],
    [-0.82, 1.25, 0.35],
    [1.15, 0.62, 0.38],
    [-1.22, 0.48, 0.42],
    [0.98, 2.05, 0.34],
    [-0.75, 2.12, 0.36],
    [1.35, 1.75, 0.40],
    [-1.42, 1.65, 0.38],
    // Photorealistic scanned driftwood along river banks and channel:
    [-1.25, 1.15, 0.45],
    [-1.35, -0.65, 0.48],
    [-1.65, 0.15, 0.40],
    [-2.15, 0.85, 0.50],
    [-2.25, -1.25, 0.46],
    [-1.05, 2.35, 0.42]
  ];
  for (const [bx, bz, bs] of fgBranchCoords) {
    if (isAllowed(bx, bz)) {
      const rot = r() * TAU;
      const tint = 0.92 + r() * 0.12;
      const s = bs;
      const nominalLength = 0.65;
      const halfLen = (nominalLength * s) * 0.5;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const x1 = bx - cosR * halfLen, z1 = bz - sinR * halfLen;
      const x2 = bx + cosR * halfLen, z2 = bz + sinR * halfLen;
      const h1 = forestHeight(x1, z1);
      const h2 = forestHeight(x2, z2);
      const hMid = forestHeight(bx, bz);
      const embedDepth = 0.018;

      const p1 = new T.Vector3(x1, h1 - embedDepth, z1);
      const p2 = new T.Vector3(x2, h2 - embedDepth, z2);
      const dir = new T.Vector3().subVectors(p2, p1);
      if (dir.lengthSq() < 1e-6) dir.set(cosR, 0, sinR);
      dir.normalize();

      const n = computeTerrainNormal(bx, bz);
      const up = new T.Vector3().subVectors(n, dir.clone().multiplyScalar(n.dot(dir))).normalize();
      const right = new T.Vector3().crossVectors(dir, up).normalize();
      const mat = new T.Matrix4().makeBasis(dir, up, right);
      const quaternion = new T.Quaternion().setFromRotationMatrix(mat);

      let midY = (p1.y + p2.y) * 0.5;
      if (hMid - embedDepth > midY) midY = hMid - embedDepth;

      scannedBranches.push({
        x: bx, y: midY, z: bz, s,
        rot,
        quaternion,
        tint
      });
    }
  }

  // 2. Boulder Perimeter Collar (r = 0.85m to 1.70m)
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * TAU + (r() - 0.5) * 0.15;
    const dist = 0.88 + r() * 0.72;
    const x = Math.cos(angle) * dist;
    const z = 0.83 + Math.sin(angle) * (dist * 0.82);

    if (i % 6 === 0) addElongatedInstance(sticks, x, z, 0.85, 1.15, 0.38, 0.012);
    else if (i % 6 === 1) addElongatedInstance(forks, x, z, 0.80, 1.10, 0.28, 0.010);
    else if (i % 6 === 2) addInstance(leafClusters, x, z, 0.85, 1.20, -0.007);
    else if (i % 6 === 3) addInstance(needleTufts, x, z, 0.85, 1.25, -0.007);
    else if (i % 6 === 4) addInstance(barkFlakes, x, z, 0.80, 1.30, -0.005);
    else addInstance(pebbles, x, z, 0.75, 1.25, -0.012, 0.72);
  }

  // 3. Root Berm Anchors
  const ROOT_BERMS = [
    [1.45, 2.15, 1.10, 2.05],
    [1.10, 2.05, 0.75, 1.95],
    [-1.25, 1.95, -0.90, 1.85],
    [-0.90, 1.85, -0.65, 1.80],
    [1.85, 0.95, 1.45, 0.85],
    [-1.75, 0.85, -1.35, 0.80]
  ];
  for (const [x1, z1, x2, z2] of ROOT_BERMS) {
    for (let s = 0; s <= 4; s++) {
      const u = s / 4;
      const bx = lerp(x1, x2, u) + (r() - 0.5) * 0.18;
      const bz = lerp(z1, z2, u) + (r() - 0.5) * 0.18;

      if (s % 3 === 0) addElongatedInstance(sticks, bx, bz, 0.90, 1.20, 0.38, 0.012);
      else if (s % 3 === 1) addInstance(leafClusters, bx, bz, 0.90, 1.25, -0.007);
      else addInstance(needleTufts, bx, bz, 0.85, 1.20, -0.007);

      if (r() < 0.65) addInstance(barkFlakes, bx + (r() - 0.5) * 0.12, bz + (r() - 0.5) * 0.12, 0.85, 1.25, -0.005);
    }
  }

  // 4. Nurse Logs & Dead Wood Bases
  const WOOD_BASES = [
    [1.9, 3.4],
    [3.2, 1.2],
    [-3.8, 1.8],
    [2.6, -1.8],
    [-0.6, 3.6],
    [1.8, -0.95],
    [2.3, -1.5],
    [-3.6, 2.8]
  ];
  for (const [wx, wz] of WOOD_BASES) {
    for (let k = 0; k < 7; k++) {
      const ang = r() * TAU;
      const dist = 0.35 + r() * 0.85;
      const px = wx + Math.cos(ang) * dist;
      const pz = wz + Math.sin(ang) * dist;

      if (k % 4 === 0) addElongatedInstance(sticks, px, pz, 0.85, 1.25, 0.38, 0.012);
      else if (k % 4 === 1) addElongatedInstance(forks, px, pz, 0.80, 1.15, 0.28, 0.010);
      else if (k % 4 === 2) addInstance(barkFlakes, px, pz, 0.90, 1.45, -0.005);
      else addElongatedInstance(pineCones, px, pz, 0.85, 1.20, 0.065, 0.006);

      if (r() < 0.60) addInstance(leafClusters, px + 0.05, pz + 0.05, 0.85, 1.25, -0.007);
    }
  }

  // 5. Creek Bank Wrack Line
  for (let z = -6.0; z <= 6.0; z += 0.85) {
    const half = creekWidth(z) * 0.5;
    const cx = creekX(z);

    const rightBankX = cx + half + 0.18 + (r() - 0.5) * 0.15;
    const leftBankX = cx - half - 0.18 + (r() - 0.5) * 0.15;

    addInstance(pebbles, rightBankX, z, 0.80, 1.40, -0.014, 0.72);
    addInstance(pebbles, leftBankX, z, 0.80, 1.40, -0.014, 0.72);

    if (r() < 0.55) addElongatedInstance(sticks, rightBankX + 0.12, z + (r() - 0.5) * 0.25, 0.85, 1.20, 0.38, 0.012);
    if (r() < 0.50) addElongatedInstance(forks, leftBankX - 0.12, z + (r() - 0.5) * 0.25, 0.80, 1.10, 0.28, 0.010);
    if (r() < 0.40) addInstance(leafClusters, rightBankX + 0.25, z, 0.80, 1.15, -0.007);
  }

  // 6. Near-field Loam Hollows & Drifts
  const LOAM_DRIFTS = [
    [0.92, 1.95],
    [-0.55, 2.25],
    [1.35, 1.45],
    [-1.25, 1.55],
    [0.65, 0.25],
    [-0.85, 0.35],
    [1.65, 0.45],
    [-1.45, 0.55]
  ];
  for (const [lx, lz] of LOAM_DRIFTS) {
    addInstance(leafClusters, lx, lz, 0.90, 1.30, -0.007);
    addInstance(needleTufts, lx + 0.08, lz + 0.06, 0.85, 1.25, -0.007);
    if (r() < 0.50) addInstance(barkFlakes, lx - 0.06, lz + 0.08, 0.80, 1.20, -0.005);
    if (r() < 0.40) addInstance(pebbles, lx + 0.12, lz - 0.05, 0.75, 1.15, -0.012, 0.72);
    if (r() < 0.35) addElongatedInstance(pineCones, lx - 0.10, lz - 0.08, 0.80, 1.15, 0.065, 0.006);
  }

  return {
    scannedBranches,
    sticks,
    forks,
    leafClusters,
    needleTufts,
    barkFlakes,
    pebbles,
    pineCones
  };
}

/**
 * Builds all forest-floor clutter systems, batching into InstancedMesh nodes.
 */
export async function buildForestClutter(world, texture, gl) {
  world.clutterVersion = 'gh33-high-resolution-v4';

  // 1. Load PBR Scots pine bark textures for realistic branches and bark flakes
  let stickMat, barkFlakeMat;
  try {
    const [pineBarkDiff, pineBarkNor, pineBarkRough] = await Promise.all([
      texture('pine_bark_4k/pine_bark_diff_4k.jpg', true, 1),
      texture('pine_bark_4k/pine_bark_nor_gl_4k.jpg', false, 1),
      texture('pine_bark_4k/pine_bark_rough_4k.jpg', false, 1)
    ]);
    pineBarkDiff.wrapS = pineBarkDiff.wrapT = T.RepeatWrapping;
    pineBarkNor.wrapS = pineBarkNor.wrapT = T.RepeatWrapping;
    pineBarkRough.wrapS = pineBarkRough.wrapT = T.RepeatWrapping;

    stickMat = new T.MeshStandardMaterial({
      map: pineBarkDiff,
      normalMap: pineBarkNor,
      roughnessMap: pineBarkRough,
      normalScale: new T.Vector2(1.08, 1.08),
      roughness: 0.95,
      metalness: 0,
      vertexColors: true,
      color: '#b7a48d',
      envMapIntensity: 0.46
    });

    barkFlakeMat = new T.MeshStandardMaterial({
      map: pineBarkDiff,
      normalMap: pineBarkNor,
      roughnessMap: pineBarkRough,
      normalScale: new T.Vector2(1.3, 1.3),
      roughness: 0.95,
      metalness: 0,
      vertexColors: true,
      color: '#ffffff',
      envMapIntensity: 0.50
    });
  } catch {
    stickMat = new T.MeshStandardMaterial({
      color: '#8a7662',
      roughness: 0.94,
      metalness: 0,
      vertexColors: true
    });
    barkFlakeMat = new T.MeshStandardMaterial({
      color: '#946b4c',
      roughness: 0.94,
      metalness: 0,
      vertexColors: true
    });
  }

  // 2. High-resolution double-sided leaf material sampling forrest_ground_01 directly
  let leafMat;
  try {
    const [groundDiff, groundNor, groundRough] = await Promise.all([
      texture('forrest_ground_01/diff.jpg', true, 1),
      texture('forrest_ground_01/nor_gl.jpg', false, 1),
      texture('forrest_ground_01/rough.jpg', false, 1)
    ]);
    leafMat = new T.MeshStandardMaterial({
      map: groundDiff,
      normalMap: groundNor,
      roughnessMap: groundRough,
      normalScale: new T.Vector2(0.9, 0.9),
      roughness: 0.88,
      metalness: 0,
      side: T.DoubleSide,
      vertexColors: true,
      color: '#ffffff',
      envMapIntensity: 0.45
    });
  } catch {
    leafMat = new T.MeshStandardMaterial({
      color: '#d2ab70',
      vertexColors: true,
      roughness: 0.88,
      metalness: 0,
      side: T.DoubleSide,
      envMapIntensity: 0.45
    });
  }

  // 3. Scots pine needle material
  const needleMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.90,
    metalness: 0,
    side: T.DoubleSide,
    envMapIntensity: 0.40
  });

  // 4. Loam pebble and stone material textured with sandy_gravel
  let pebbleMat;
  try {
    const [gravelDiff, gravelNor, gravelRough] = await Promise.all([
      texture('sandy_gravel/diff.jpg', true, 1),
      texture('sandy_gravel/nor_gl.jpg', false, 1),
      texture('sandy_gravel/rough.jpg', false, 1)
    ]);
    pebbleMat = new T.MeshStandardMaterial({
      map: gravelDiff,
      normalMap: gravelNor,
      roughnessMap: gravelRough,
      normalScale: new T.Vector2(1.2, 1.2),
      roughness: 0.92,
      metalness: 0,
      vertexColors: true,
      color: '#ffffff',
      envMapIntensity: 0.45
    });
  } catch {
    pebbleMat = new T.MeshStandardMaterial({
      color: '#9c9688',
      vertexColors: true,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.45
    });
  }

  // 5. Pine cone material
  const coneMat = new T.MeshStandardMaterial({
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.92,
    metalness: 0,
    envMapIntensity: 0.50
  });

  // Generate non-uniform placements
  const placements = generateClutterPlacements({ seed: 91402 });

  function createInstancedBatch(geometry, material, list, name, shadow = false) {
    if (!list.length) return null;
    const mesh = new T.InstancedMesh(geometry, material, list.length);
    mesh.name = name;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.userData = { noPick: true, pickable: false };

    const dummy = new T.Object3D();
    const color = new T.Color();

    list.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      if (p.quaternion) {
        dummy.quaternion.copy(p.quaternion);
      } else {
        dummy.rotation.set(p.rx || 0, p.rot || 0, p.rz || 0);
      }
      dummy.scale.set(p.sx ?? p.s, p.sy ?? p.s, p.sz ?? p.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      const light = p.tint ?? 1.0;
      color.setRGB(light, light, light);
      mesh.setColorAt(i, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.computeBoundingBox();
    world.scene.add(mesh);
    return mesh;
  }

  // 6. Photogrammetry Scanned Branches in near-field/foreground
  if (gl && placements.scannedBranches.length > 0) {
    try {
      const branchModel = (await gl.loadAsync('./assets/dry_branches_medium_01/dry_branches_medium_01.gltf')).scene;
      const branchSources = sourceMeshes(branchModel);
      branchSources.forEach((src, i) => {
        const g = groundedGeometry(src);
        const m = scanMaterial(src.material, world);
        const sz = g.boundingBox.getSize(new T.Vector3());
        const maxDim = Math.max(sz.x, sz.z);
        const subset = placements.scannedBranches.filter((_, j) => j % branchSources.length === i);
        if (subset.length > 0) {
          const scaledPlacements = subset.map(p => ({
            ...p,
            s: p.s / Math.max(0.1, maxDim)
          }));
          createInstancedBatch(g, m, scaledPlacements, `Forest floor • Photogrammetry branch ${i + 1}`, true);
        }
      });
    } catch {
      // Graceful fallback to procedural sticks
    }
  }

  // 7. Procedural Clutter Batches.  Three geometry families keep repeated
  // sticks from reading as cloned props while retaining one shared PBR set.
  const stickFamilies = [
    createStickGeometry({ seed: 4123, length: 0.36, radiusStart: 0.018, radiusEnd: 0.011 }),
    createStickGeometry({ seed: 4199, length: 0.41, radiusStart: 0.016, radiusEnd: 0.0085, segments: 30 }),
    createStickGeometry({ seed: 4271, length: 0.33, radiusStart: 0.022, radiusEnd: 0.0135, segments: 25 })
  ];
  const forkFamilies = [
    createForkTwigGeometry({ seed: 6319, stemLength: 0.27, forkLength: 0.15 }),
    createForkTwigGeometry({ seed: 6397, stemLength: 0.31, forkLength: 0.13, radiusStem: 0.0125, radiusFork: 0.0075 }),
    createForkTwigGeometry({ seed: 6469, stemLength: 0.25, forkLength: 0.18, radiusStem: 0.0155, radiusFork: 0.0095 })
  ];
  stickFamilies.forEach((geometry, i) => {
    const subset = placements.sticks.filter((_, j) => j % stickFamilies.length === i);
    createInstancedBatch(geometry, stickMat, subset, `Forest floor • Weathered stick variant ${i + 1}`, true);
  });
  forkFamilies.forEach((geometry, i) => {
    const subset = placements.forks.filter((_, j) => j % forkFamilies.length === i);
    createInstancedBatch(geometry, stickMat, subset, `Forest floor • Forked twig variant ${i + 1}`, true);
  });
  createInstancedBatch(createLeafClusterGeometry({ seed: 5102 }), leafMat, placements.leafClusters, 'Forest floor • Organic leaf cluster', false);
  createInstancedBatch(createPineNeedleTuftGeometry({ seed: 8124 }), needleMat, placements.needleTufts, 'Forest floor • Pine needle tuft', false);
  createInstancedBatch(createBarkFlakeGeometry({ seed: 7129 }), barkFlakeMat, placements.barkFlakes, 'Forest floor • Pine bark scale', true);
  createInstancedBatch(createPebbleGeometry({ seed: 7123 }), pebbleMat, placements.pebbles, 'Forest floor • Loam pebble', false);
  createInstancedBatch(createPineConeGeometry({ seed: 8923 }), coneMat, placements.pineCones, 'Forest floor • Scots pine cone', true);

  world.clutterCounts = {
    scannedBranches: placements.scannedBranches.length,
    sticks: placements.sticks.length,
    forks: placements.forks.length,
    leafClusters: placements.leafClusters.length,
    needleTufts: placements.needleTufts.length,
    barkFlakes: placements.barkFlakes.length,
    pebbles: placements.pebbles.length,
    pineCones: placements.pineCones.length
  };
}
