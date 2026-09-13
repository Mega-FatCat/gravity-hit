import * as T from 'three';
import {specularAntialiasing} from './edge-quality.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { creekX, creekWidth, forestHeight, creekBankMeander } from './environment.js';

const TAU = Math.PI * 2;
const V = (x = 0, y = 0, z = 0) => new T.Vector3(x, y, z);
const W = -0.065; // Stream water surface level
const channelX = (z) => creekX(z) + creekBankMeander(z);

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) | 0;
    return ((s >>> 0) / 4294967296);
  };
}

function hash2D(x, y) {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const a = x - ix, b = y - iy;
  const u = a * a * (3 - 2 * a), v = b * b * (3 - 2 * b);
  const h00 = hash2D(ix, iy), h10 = hash2D(ix + 1, iy);
  const h01 = hash2D(ix, iy + 1), h11 = hash2D(ix + 1, iy + 1);
  return T.MathUtils.lerp(
    T.MathUtils.lerp(h00, h10, u),
    T.MathUtils.lerp(h01, h11, u),
    v
  );
}

/**
 * Procedural water-worn river stone geometry generator.
 * Uses BufferGeometryUtils.mergeVertices to ensure shared vertex normals,
 * giving smooth, natural, water-sculpted river stone curvature instead of flat facets.
 */
function createFluvialGeometry({
  radius = 1.0,
  heightScale = 0.44,
  aspectRatio = 0.82,
  detail = 2,
  faceting = 0.08,
  seed = 4127
} = {}) {
  const rawGeom = new T.IcosahedronGeometry(1.0, detail);
  const geom = BufferGeometryUtils.mergeVertices(rawGeom, 0.0001);
  const pos = geom.attributes.position;
  const r = seededRandom(seed);
  const pOffset = r() * 100;

  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);

    // Fluvial downstream elongation and gentle taper
    const taper = 1.0 - z * 0.16 + x * 0.08;
    x *= taper;

    // Multi-octave water-worn displacement: macro form + sedimentary planar cleavage + micro chips
    const broadNoise = (noise2D(x * 1.8 + pOffset, z * 1.8 + y * 1.2 + pOffset) - 0.5) * 0.18;
    const planarCleavage = Math.abs(y * 1.4 + (noise2D(x * 2.8 + pOffset, z * 2.8) - 0.5) * 0.22) * faceting;
    const microRelief = (noise2D(x * 5.2 - pOffset, z * 5.2 + y * 3.4) - 0.5) * 0.06;
    const disp = 1.0 + broadNoise - planarCleavage + microRelief;

    // Flattened fluvial bedding plane on underside
    let fy = y * disp * heightScale;
    if (fy < 0) fy *= 0.82;

    const fx = x * disp;
    const fz = z * disp * aspectRatio;

    pos.setXYZ(i, fx, fy, fz);
  }

  geom.computeVertexNormals();
  geom.computeBoundingBox();
  const bb = geom.boundingBox;
  const center = bb.getCenter(new T.Vector3());
  geom.translate(-center.x, -center.y, -center.z);
  geom.scale(radius, radius, radius);

  // Generate spherical UVs for photographic rock texture mapping
  const uvs = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    const u = 0.5 + Math.atan2(pz, px) / TAU;
    const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, py / (radius * heightScale + 0.001)))) / Math.PI;
    uvs.setXY(i, u * 2.0, v * 2.0);
  }
  uvs.needsUpdate = true;

  geom.computeVertexNormals();
  geom.computeBoundingBox();
  geom.computeBoundingSphere();
  return geom;
}

/**
 * GH-36 restrained native stream mineral palette.
 * The scanned rock texture supplies shared geological detail; these instance colors
 * provide broad mineral families so the bed reads as a mixed deposit.
 */
const MINERAL_CLASSES = [
  // 1. Cool weathered granite: the dominant gray river stone family.
  { color: new T.Color('#c2c4bd'), weight: 0.28, roughMod: 0.98 },
  // 2. Brown-gray siltstone: warmth without orange garden gravel.
  { color: new T.Color('#a69580'), weight: 0.24, roughMod: 1.02 },
  // 3. Dark slate/basalt: sparse contrast in the mixed deposit.
  { color: new T.Color('#828887'), weight: 0.18, roughMod: 0.94 },
  // 4. Lighter quartz/gravel: reserved for occasional pale facets.
  { color: new T.Color('#d5cdbc'), weight: 0.13, roughMod: 0.96 },
  // 5. Moss/biofilm patina: deliberately a minority mineral family.
  { color: new T.Color('#8f9a74'), weight: 0.10, roughMod: 0.92 },
  // 6. Deep river mud stain.
  { color: new T.Color('#70685d'), weight: 0.07, roughMod: 1.08 }
];

function pickMineralColor(r) {
  let roll = r();
  for (const m of MINERAL_CLASSES) {
    if (roll < m.weight) {
      const jitter = 0.93 + r() * 0.14;
      const c = m.color.clone().multiplyScalar(jitter);
      return { color: c, roughMod: m.roughMod };
    }
    roll -= m.weight;
  }
  return { color: new T.Color('#b8ab96'), roughMod: 1.0 };
}

// STREAM-BED-01 correction: the dominant medium tier uses a warmer, more
// neutral river-stone family than the full-bed palette. The shared 4K scan still
// supplies the geological detail; these restrained tints prevent a dense bed
// from collapsing into near-black rubble once submerged.
const MEDIUM_MINERAL_CLASSES = [
  { color: new T.Color('#c8b9a3'), weight: 0.22 },
  { color: new T.Color('#bd9f7c'), weight: 0.20 },
  { color: new T.Color('#bec0ba'), weight: 0.18 },
  { color: new T.Color('#a8b1ae'), weight: 0.14 },
  { color: new T.Color('#717875'), weight: 0.10 },
  { color: new T.Color('#d7cbb8'), weight: 0.08 },
  { color: new T.Color('#929c7c'), weight: 0.08 }
];

function pickMediumColor(r) {
  let roll = r();
  for (const m of MEDIUM_MINERAL_CLASSES) {
    if (roll < m.weight) {
      return m.color.clone().multiplyScalar(0.96 + r() * 0.09);
    }
    roll -= m.weight;
  }
  return new T.Color('#aaa194');
}

// The submerged bed-forming classes need more separation than the anchor
// palette provides after water absorption. Keep the same restrained geological
// families, but reserve a little more chroma/value distance between warm brown,
// neutral/cool gray, slate and moss so the 3D mosaic survives the water layer.
// This picker consumes the same two RNG draws as pickMineralColor(), preserving
// every downstream deterministic placement sequence when substituted below.
const BED_CLAST_MINERAL_CLASSES = [
  { color: new T.Color('#c2bdb1'), weight: 0.22, roughMod: 0.99 },
  { color: new T.Color('#c0a17e'), weight: 0.22, roughMod: 1.03 },
  { color: new T.Color('#b3bbb7'), weight: 0.18, roughMod: 0.97 },
  { color: new T.Color('#707875'), weight: 0.14, roughMod: 0.94 },
  { color: new T.Color('#d6c9b5'), weight: 0.10, roughMod: 0.97 },
  { color: new T.Color('#929d79'), weight: 0.08, roughMod: 0.94 },
  { color: new T.Color('#78695c'), weight: 0.06, roughMod: 1.06 }
];

function pickBedClastColor(r) {
  let roll = r();
  for (const m of BED_CLAST_MINERAL_CLASSES) {
    if (roll < m.weight) {
      const jitter = 0.94 + r() * 0.12;
      return { color: m.color.clone().multiplyScalar(jitter), roughMod: m.roughMod };
    }
    roll -= m.weight;
  }
  return { color: new T.Color('#aaa194'), roughMod: 1.0 };
}

function restrainPaleAnchorColor(color) {
  const luma = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
  // Keep sparse anchors in a water-worn gray/brown/moss range. Compress the
  // occasional chalky quartz cap, but also lift only the very darkest instances
  // enough that their scanned grain survives as mottled rock instead of black
  // silhouette. Mid-tone anchors remain unchanged.
  if (luma > 0.48) color.lerp(new T.Color('#69665f'), 0.84);
  else if (luma > 0.38) color.lerp(new T.Color('#77736a'), 0.32);
  else if (luma < 0.12) color.lerp(new T.Color('#716d60'), 0.28);
  return color;
}

function partitionPlacements(placements, familyCount, seed, weights = null) {
  const groups = Array.from({ length: familyCount }, () => []);
  const pr = seededRandom(seed);
  const normalizedWeights = weights?.length === familyCount ? weights : null;
  const totalWeight = normalizedWeights ? normalizedWeights.reduce((n, w) => n + Math.max(0, w), 0) : 0;
  for (const placement of placements) {
    let family;
    if (normalizedWeights && totalWeight > 0) {
      let roll = pr() * totalWeight;
      family = familyCount - 1;
      for (let i = 0; i < familyCount; i++) {
        roll -= Math.max(0, normalizedWeights[i]);
        if (roll <= 0) {
          family = i;
          break;
        }
      }
    } else {
      family = Math.min(familyCount - 1, Math.floor(pr() * familyCount));
    }
    groups[family].push(placement);
  }
  return groups;
}

/**
 * Spatial Grid for Physical Non-Phasing Collision & Multi-Tier Stacking.
 * Tracks all placed stones in the riverbed so upper-tier stones nest
 * realistically on top of underlying rocks without geometry penetration.
 */
class RiverbedSpatialGrid {
  constructor(cellSize = 0.08) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  _key(cx, cz) {
    return `${cx},${cz}`;
  }

  insert(stone) {
    const minCx = Math.floor((stone.x - stone.r) / this.cellSize);
    const maxCx = Math.floor((stone.x + stone.r) / this.cellSize);
    const minCz = Math.floor((stone.z - stone.r) / this.cellSize);
    const maxCz = Math.floor((stone.z + stone.r) / this.cellSize);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const k = this._key(cx, cz);
        let list = this.grid.get(k);
        if (!list) {
          list = [];
          this.grid.set(k, list);
        }
        list.push(stone);
      }
    }
  }

  findOverlaps(x, z, r) {
    const minCx = Math.floor((x - r) / this.cellSize);
    const maxCx = Math.floor((x + r) / this.cellSize);
    const minCz = Math.floor((z - r) / this.cellSize);
    const maxCz = Math.floor((z + r) / this.cellSize);
    const seen = new Set();
    const result = [];
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const list = this.grid.get(this._key(cx, cz));
        if (!list) continue;
        for (const s of list) {
          if (!seen.has(s)) {
            seen.add(s);
            const d = Math.hypot(x - s.x, z - s.z);
            if (d < s.r + r) {
              result.push({ stone: s, dist: d });
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Check if placement collides horizontally with a same-tier stone.
   * Enforces physical non-penetration between stones of similar size.
   */
  hasSameTierCollision(x, z, r, tier, minDistanceRatio = 0.90) {
    const overlaps = this.findOverlaps(x, z, r);
    for (const { stone, dist } of overlaps) {
      if (stone.tier === tier) {
        if (dist < (stone.r + r) * minDistanceRatio) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Calculate exact physical contact elevation for a new stone resting on the bed
   * or nestled beside underlying larger stones.
   */
  computeContactElevation(x, z, r, halfH, groundY, currentTier = 1, embedRatio = 0.52) {
    const defaultY = groundY + (1.0 - 2.0 * embedRatio) * halfH;
    const overlaps = this.findOverlaps(x, z, r);
    if (overlaps.length === 0) {
      return { yCenter: defaultY, isStacked: false, primaryBase: null, normalOffset: null };
    }

    let maxStackY = -Infinity;
    let primaryBase = null;

    for (const { stone: base, dist } of overlaps) {
      if (base.isStacked) continue;

      // Strict size hierarchy: can only nest beside a significantly larger base stone from an earlier tier
      if (base.tier < currentTier && base.r >= r * 1.40) {
        const normDist = dist / Math.max(0.001, base.r);
        // Fluvial rule: pebbles can NEVER balance on the top crown of a boulder;
        // they only nestle into the flank crevices and hollows (normDist between 0.62 and 1.15)
        if (normDist >= 0.62 && dist < base.r + r * 0.80) {
          const clampedNormDist = Math.min(0.999, normDist);
          const surfHeight = base.y + base.h * Math.sqrt(1.0 - clampedNormDist * clampedNormDist);
          // Nestled into the crevice: sits lower against the flank
          const stackY = Math.min(surfHeight + halfH * 0.35, defaultY + halfH * 0.40);

          if (stackY <= groundY + base.h * 0.85 && stackY > maxStackY) {
            maxStackY = stackY;
            primaryBase = base;
          }
        }
      }
    }

    if (maxStackY > defaultY && primaryBase) {
      const dx = (x - primaryBase.x) / Math.max(0.001, primaryBase.r);
      const dz = (z - primaryBase.z) / Math.max(0.001, primaryBase.r);
      const normalOffset = new T.Vector3(dx * 0.60, 1.0, dz * 0.60).normalize();
      return { yCenter: maxStackY, isStacked: true, primaryBase, normalOffset };
    }

    return { yCenter: defaultY, isStacked: false, primaryBase: null, normalOffset: null };
  }
}

// Shared 4K PBR rock textures across all streambed materials
// Uses the EXACT photogrammetry textures from rock_moss_set_01 (matching the ritual rock slab!)
// plus micro-normal grain from rock_boulder_dry for sub-millimeter crystalline sharpness.
let sharedPbrTextures = null;
function getSharedRockPbr() {
  if (sharedPbrTextures) return sharedPbrTextures;
  const tl = new T.TextureLoader();
  const loadT = (path, srgb = false) => {
    const t = tl.load(path, tex => {
      tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
      tex.flipY = false;
      tex.anisotropy = 16;
      tex.minFilter = T.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      t.needsUpdate = true;
    });
    t.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    t.flipY = false;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 16;
    return t;
  };
  sharedPbrTextures = {
    diff: loadT('./assets/rock_moss_set_01/textures/diff_4k.jpg', true),
    nor: loadT('./assets/rock_moss_set_01/textures/nor_gl_4k.jpg', false),
    rough: loadT('./assets/rock_moss_set_01/textures/rough_4k.jpg', false),
    ao: loadT('./assets/rock_moss_set_01/textures/ao_4k.jpg', false),
    microDiff: loadT('./assets/rock_boulder_dry/diff_4k.jpg', true),
    microNor: loadT('./assets/rock_boulder_dry/nor_gl_4k.jpg', false),
    microRough: loadT('./assets/rock_boulder_dry/rough_4k.jpg', false),
    microAO: loadT('./assets/rock_boulder_dry/ao_4k.jpg', false)
  };
  return sharedPbrTextures;
}

/**
 * Configure 4K Photogrammetric Rock Material with World-Space Triplanar Micro-Detail Shader.
 * Matches the ritual rock slab in quality, micro-grain, normal relief, and wetness response.
 */
function createStreambedMaterial(name, { baseRoughness = 0.88, sFreq = 16.0, materialClass = 0 } = {}) {
  const pbr = getSharedRockPbr();
  const uMicroDiff = { value: pbr.microDiff };
  const uMicroNormal = { value: pbr.microNor };
  const uMicroRough = { value: pbr.microRough };
  const uMicroAO = { value: pbr.microAO };
  const uViewRotation = { value: new T.Matrix3() };
  const uMaterialClass = { value: materialClass };
  uViewRotation.value.identity();

  const mat = new T.MeshStandardMaterial({
    map: pbr.diff,
    normalMap: pbr.nor,
    roughnessMap: pbr.rough,
    aoMap: pbr.ao,
    color: '#ffffff',
    vertexColors: true,
    roughness: baseRoughness,
    metalness: 0.0,
    // Keep exposed bank stones readable against the darker wet channel.
    envMapIntensity: 0.90
  });
  // Anchor boulders use the same visible relief standard as the ritual slab;
  // smaller submerged classes retain their calmer response.
  mat.normalScale.set(materialClass === 0 ? 1.36 : 1.25, materialClass === 0 ? 1.36 : 1.25);

  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uMicroDiff, uMicroNormal, uMicroRough, uMicroAO, uViewRotation, uMaterialClass });

    // Vertex shader: compute world position, world normal, and local stone height for contact AO
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vStoneWorldPos;\nvarying vec3 vStoneWorldNorm;\nvarying float vStoneLocalY;'
    ).replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vStoneLocalY = position.y;
      #ifdef USE_INSTANCING
        mat4 instModel = modelMatrix * instanceMatrix;
        vStoneWorldPos = (instModel * vec4(transformed, 1.0)).xyz;
        vec3 scaleSq = vec3(dot(instModel[0].xyz, instModel[0].xyz), dot(instModel[1].xyz, instModel[1].xyz), dot(instModel[2].xyz, instModel[2].xyz));
        vec3 invScaleSq = 1.0 / max(vec3(0.0001), scaleSq);
        vStoneWorldNorm = normalize(mat3(instModel) * (normal * invScaleSq));
      #else
        vStoneWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vec3 scaleSq = vec3(dot(modelMatrix[0].xyz, modelMatrix[0].xyz), dot(modelMatrix[1].xyz, modelMatrix[1].xyz), dot(modelMatrix[2].xyz, modelMatrix[2].xyz));
        vec3 invScaleSq = 1.0 / max(vec3(0.0001), scaleSq);
        vStoneWorldNorm = normalize(mat3(modelMatrix) * (normal * invScaleSq));
      #endif`
    );

    // Fragment shader: Triplanar 4K rock textures, dual-frequency micro-normals, capillary wetness, and grounding AO
    shader.fragmentShader =
      'varying vec3 vStoneWorldPos;\n' +
      'varying vec3 vStoneWorldNorm;\n' +
      'varying float vStoneLocalY;\n' +
      'uniform sampler2D uMicroDiff;\n' +
      'uniform sampler2D uMicroNormal;\n' +
      'uniform sampler2D uMicroRough;\n' +
      'uniform sampler2D uMicroAO;\n' +
      'uniform float uMaterialClass;\n' +
      'uniform mat3 uViewRotation;\n' +
      'float gh36Hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+34.345);return fract(p.x*p.y);}\n' +
      'float gh36Noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);float a=gh36Hash(i),b=gh36Hash(i+vec2(1.0,0.0)),c=gh36Hash(i+vec2(0.0,1.0)),d=gh36Hash(i+vec2(1.0,1.0));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}\n' +
      'float gh36Fbm(vec2 p){return gh36Noise(p)*0.58+gh36Noise(p*2.03+7.1)*0.28+gh36Noise(p*4.17-3.8)*0.14;}\n' +
      shader.fragmentShader;

    const triChunk = `
      vec3 sNorm = normalize(vStoneWorldNorm);
      if (!gl_FrontFacing) sNorm = -sNorm;
      vec3 sWeights = pow(abs(sNorm), vec3(4.0));
      sWeights /= max(0.0001, sWeights.x + sWeights.y + sWeights.z);
      float slope = 1.0 - abs(sNorm.y);
      float anchorQuality = 1.0 - smoothstep(0.0, 1.0, uMaterialClass);
      // The large waterline boulders need the same readable texel density as
      // the ritual slab. Keep the smaller classes at their established scale.
      float sFreqMacro = ${sFreq.toFixed(1)} * mix(0.45, 0.88, anchorQuality);
      float sFreqMicro = ${sFreq.toFixed(1)} * 2.2;

      // Macro-texture coordinates
      vec2 sUvY1 = vStoneWorldPos.xz * sFreqMacro;
      vec2 sUvX1 = vStoneWorldPos.zy * sFreqMacro;
      vec2 sUvZ1 = vStoneWorldPos.xy * sFreqMacro;
      vec3 mDiff = texture2D(uMicroDiff, sUvX1).rgb * sWeights.x + texture2D(uMicroDiff, sUvY1).rgb * sWeights.y + texture2D(uMicroDiff, sUvZ1).rgb * sWeights.z;

      // Micro-texture coordinates (crystalline sub-millimeter sharpness)
      vec2 sUvY2 = vStoneWorldPos.xz * sFreqMicro;
      vec2 sUvX2 = vStoneWorldPos.zy * sFreqMicro;
      vec2 sUvZ2 = vStoneWorldPos.xy * sFreqMicro;
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      triChunk +
      T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',
        `diffuseColor *= sampledDiffuseColor;
         vec3 grain = mDiff / vec3(0.658, 0.609, 0.550);
         float grainBlend = mix(0.42, 0.48, anchorQuality);
         diffuseColor.rgb *= mix(vec3(1.0), grain, grainBlend);
         // Match the slab's extra slope breakup on anchor-boulder facets.
         float antiStretch = smoothstep(0.20, 0.50, slope);
         vec3 slopeDetail = diffuseColor.rgb * mix(vec3(1.0), grain, 0.50);
         diffuseColor.rgb = mix(diffuseColor.rgb, slopeDetail, antiStretch * 0.75 * anchorQuality);

         // GH-36: broad, low-frequency bed variation. It stays below the
         // scanned micro-detail so the surface remains readable, not noisy.
         float bedTone = gh36Fbm(vStoneWorldPos.xz * 0.82 + vec2(4.7, -8.1));
         float fleck = smoothstep(0.68, 0.90, gh36Noise(vStoneWorldPos.xz * 3.1 + vec2(11.0, 2.4)));
         float lightGravel = smoothstep(2.3, 3.8, uMaterialClass) * fleck * 0.16;
         float sedimentStain = smoothstep(0.60, 0.88, bedTone) * (0.06 + 0.08 * (1.0 - smoothstep(0.0, 0.55, slope)));
         diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.74, 0.67), sedimentStain);
         diffuseColor.rgb *= mix(vec3(1.0), vec3(1.08, 1.05, 0.95), lightGravel);

         // Fluvial Capillary Moisture Dynamics:
         float depth = -0.065 - vStoneWorldPos.y;
         float isSubmerged = clamp((depth + 0.012) / 0.024, 0.0, 1.0);
         float capillary = clamp((vStoneWorldPos.y - (-0.065) + 0.024) / 0.024, 0.0, 1.0);
         float moistureFringe = 1.0 - capillary;

         // Submerged rock darkening & saturation boost. Medium pebbles / small
         // cobbles must remain readable through the water instead of collapsing
         // into the near-black silhouettes used by the larger anchor family.
         // Keep this class-selective so the established anchor response survives.
         // Cobble through shingle are all bed-forming clasts. The previous mask
         // did not fully engage until materialClass ~1.35, leaving class-1
         // cobbles almost on the anchor darkening path and making the submerged
         // center read blue-black. Keep anchors (class 0) excluded while giving
         // every coarse/small clast family a restrained readable wet response.
         float mediumReadability = smoothstep(0.72, 0.98, uMaterialClass) * (1.0 - smoothstep(2.95, 3.45, uMaterialClass));
         float gravelReadability = smoothstep(3.45, 3.95, uMaterialClass) * (1.0 - smoothstep(4.45, 4.90, uMaterialClass)) * 0.48;
         float readableBedClast = max(mediumReadability, gravelReadability);
         vec3 wetMultiplier = mix(vec3(0.78, 0.74, 0.68), vec3(1.22, 1.15, 1.06), readableBedClast);
         vec3 wetColor = diffuseColor.rgb * wetMultiplier;
         float luma = dot(wetColor, vec3(0.299, 0.587, 0.114));
         vec3 satWetColor = mix(vec3(luma), wetColor, mix(1.25, 1.46, readableBedClast));
         float wetFactor = max(isSubmerged, moistureFringe * 0.40);
         diffuseColor.rgb = mix(diffuseColor.rgb, satWetColor, wetFactor);
         diffuseColor.rgb *= mix(vec3(1.10, 1.08, 1.04), mix(vec3(1.0), vec3(1.34, 1.27, 1.17), readableBedClast), isSubmerged);

         // Sparse anchors remain darker than the bed-forming clasts, but should
         // resolve as wet gray-brown/mossy rock rather than featureless black.
         // Use low-frequency mottling plus the scan grain; this is anchor-only
         // and therefore does not bleach the stream or the dominant clast bed.
         float anchorWet = isSubmerged * anchorQuality;
         float anchorMottleNoise = gh36Fbm(vStoneWorldPos.xz * 0.72 + vec2(19.0, -6.0));
         vec3 anchorMottle = mix(vec3(0.235, 0.215, 0.190), vec3(0.190, 0.245, 0.180), smoothstep(0.32, 0.76, anchorMottleNoise));
         vec3 anchorWetReadable = max(diffuseColor.rgb * vec3(1.18, 1.15, 1.08), anchorMottle * mix(vec3(0.94), grain, 0.28));
         diffuseColor.rgb = mix(diffuseColor.rgb, anchorWetReadable, anchorWet * 0.52);

         // Dry-face response: the same scanned rock family as the ritual slab,
         // but with a restrained air-side lift so exposed stones read as
         // weathered gray/brown rock instead of charred silhouettes. The lift
         // fades through the meniscus and does not change fully submerged rock.
         // Start the air-side lift just below the surface so a stone that is
         // only a few centimetres exposed does not remain a black silhouette.
         // Fully submerged faces below this narrow fringe keep the wet look.
         float dryFace = smoothstep(-0.082, -0.006, vStoneWorldPos.y);
         float airFacet = mix(0.68, 1.0, smoothstep(-0.30, 0.24, sNorm.y));
         float dryWeight = dryFace * airFacet;
         // Keep the air-side surface recognizably dry and mineral-rich: lift
         // the base tone while retaining a restrained amount of scanned grain.
         vec3 dryGrain = mix(vec3(1.0), grain, mix(0.12, 0.22, anchorQuality));
         vec3 liftedDry = diffuseColor.rgb * vec3(1.20, 1.17, 1.10) * dryGrain;
         float dryPale = smoothstep(0.34, 0.78, dot(liftedDry, vec3(0.299, 0.587, 0.114)));
         dryPale *= 1.0 - anchorQuality * 0.96;
         // Compress only bright air-side facets toward weathered gray/brown;
         // this prevents a pale mineral scan from reading as a white stone.
         liftedDry *= mix(vec3(1.0), vec3(0.58, 0.56, 0.52), dryPale * 0.88);
         vec3 dryReference = mix(vec3(0.22, 0.20, 0.17), grain * vec3(0.42, 0.40, 0.36), mix(0.62, 0.70, anchorQuality));
         liftedDry = mix(liftedDry, dryReference, dryPale * 0.86);
         // Lift deep facets without hard-clamping the albedo, so the 4K rock
         // grain and mineral variation remain visible like on the ritual slab.
         float dryLuma = dot(liftedDry, vec3(0.299, 0.587, 0.114));
         float dryShadow = 1.0 - smoothstep(0.08, 0.28, dryLuma);
         liftedDry += vec3(0.055, 0.050, 0.042) * dryShadow;
         diffuseColor.rgb = mix(diffuseColor.rgb, liftedDry, dryWeight * 0.94);
         // A final, broad mineral compression prevents the exposed cap of a
         // pale scan from reading as chalk-white while leaving the submerged
         // part and its waterline response untouched.
         float exposedPale = dryWeight * smoothstep(0.30, 0.62, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
         exposedPale *= 1.0 - anchorQuality * 0.96;
         diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(0.30, 0.285, 0.25), grain * vec3(0.48, 0.45, 0.40), 0.48), exposedPale * mix(0.58, 0.72, anchorQuality));
         // Anchor-boulder caps must keep mineral structure at game distance;
         // add restrained contrast from the scanned grain instead of a flat
         // beige lift. This is air-side only and leaves wet faces unchanged.
         vec3 anchorMineral = mix(diffuseColor.rgb * vec3(0.44, 0.42, 0.38), grain * vec3(0.47, 0.44, 0.39), 0.68);
         anchorMineral = mix(anchorMineral, anchorMottle * vec3(1.10, 1.08, 1.02), 0.18);
         float anchorMineralLuma = dot(anchorMineral, vec3(0.299, 0.587, 0.114));
         anchorMineral *= mix(1.0, 0.72, smoothstep(0.30, 0.52, anchorMineralLuma));
         diffuseColor.rgb = mix(diffuseColor.rgb, anchorMineral, dryWeight * anchorQuality * 0.76);

         // Moss/biofilm stays in a few damp, upward-facing pockets.
         float shoreBand = 1.0 - smoothstep(0.012, 0.085, abs(vStoneWorldPos.y - (-0.065)));
         float mossPatch = smoothstep(0.78, 0.93, gh36Noise(vStoneWorldPos.xz * 1.18 + vec2(-5.0, 13.0)));
         mossPatch *= smoothstep(0.22, 0.72, sNorm.y) * (0.30 + shoreBand * 0.70) * (1.0 - isSubmerged * 0.72);
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.34, 0.40, 0.25), mossPatch * 0.16);

         // Leaf/debris stain is sparse and mostly confined to exposed tops;
         // it reads as accumulation in crevices, not a noisy coating.
         float litterPocket = smoothstep(0.84, 0.95, gh36Noise(vStoneWorldPos.xz * 2.05 + vec2(17.0, -4.0)));
         float litter = litterPocket * smoothstep(0.18, 0.68, sNorm.y) * (1.0 - isSubmerged) * 0.10;
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.27, 0.20, 0.14), litter);`
      )
    );

    // Give the bank-facing facets a little forest bounce light. This keeps
    // the scanned texture's contrast while preventing shaded edge stones from
    // collapsing into black silhouettes under the translucent water plane.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
       vec3 bankBounce = mix(vec3(0.105, 0.115, 0.095), vec3(0.070, 0.078, 0.066), isSubmerged);
       float dryBounce = smoothstep(-0.078, -0.028, vStoneWorldPos.y);
       reflectedLight.indirectDiffuse += diffuseColor.rgb * bankBounce;
       // Preserve per-instance mineral color under the translucent green water
       // instead of replacing it with a generic brightness lift. This is class-
       // gated, so the established dark anchor treatment stays untouched.
       float submergedClastBounce = isSubmerged * readableBedClast;
       reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.30, 0.28, 0.23) * submergedClastBounce;
       reflectedLight.indirectDiffuse += vec3(0.13, 0.12, 0.095) * dryBounce;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      T.ShaderChunk.normal_fragment_maps + `
       vec3 mNY = texture2D(uMicroNormal, sUvY1).xyz * 2.0 - 1.0;
       vec3 mNX = texture2D(uMicroNormal, sUvX1).xyz * 2.0 - 1.0;
       vec3 mNZ = texture2D(uMicroNormal, sUvZ1).xyz * 2.0 - 1.0;
       vec3 dMacro = vec3(0.0, mNX.y, mNX.x) * sWeights.x + vec3(mNY.x, 0.0, mNY.y) * sWeights.y + vec3(mNZ.x, mNZ.y, 0.0) * sWeights.z;

       vec3 cNY = texture2D(uMicroNormal, sUvY2).xyz * 2.0 - 1.0;
       vec3 cNX = texture2D(uMicroNormal, sUvX2).xyz * 2.0 - 1.0;
       vec3 cNZ = texture2D(uMicroNormal, sUvZ2).xyz * 2.0 - 1.0;
       vec3 dMicro = vec3(0.0, cNX.y, cNX.x) * sWeights.x + vec3(cNY.x, 0.0, cNY.y) * sWeights.y + vec3(cNZ.x, cNZ.y, 0.0) * sWeights.z;

       vec3 dNw = dMacro * 0.65 + dMicro * 0.70;
       float nStr = mix(0.80, 1.50, smoothstep(0.18, 0.48, slope));
       nStr *= mix(1.0, 1.18, anchorQuality);
       // Tangential relief cannot flip a surface normal or pin it toward the
       // camera. The former view-Z clamp made wet facets pop during rotation.
       vec3 detailView = uViewRotation * dNw;
       detailView -= normal * dot(normal, detailView);
       normal = normalize(normal + detailView * nStr);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      T.ShaderChunk.roughnessmap_fragment + `
       float mRough = texture2D(uMicroRough, sUvX1).g * sWeights.x + texture2D(uMicroRough, sUvY1).g * sWeights.y + texture2D(uMicroRough, sUvZ1).g * sWeights.z;
       float rMod = mix(mRough, mRough * 1.15, smoothstep(0.18, 0.48, slope));
       roughnessFactor = clamp(roughnessFactor * mix(0.85, 1.25, rMod), 0.15, 0.96);

       // Larger anchors keep the established glossy wet response. The dominant
       // medium/pebble bed remains a little rougher under water so its scanned
       // albedo and normals stay legible through the transparent stream plane.
       float wetTargetRoughness = mix(0.10, 0.24, readableBedClast);
       float wetRoughnessWeight = mix(0.92, 0.74, readableBedClast);
       roughnessFactor = mix(roughnessFactor, wetTargetRoughness, isSubmerged * wetRoughnessWeight);

       // Waterline meniscus: damp ultra-glossy rim
       float meniscus = smoothstep(0.016, 0.0, abs(vStoneWorldPos.y - (-0.065)));
       roughnessFactor = mix(roughnessFactor, 0.05, meniscus * (1.0 - isSubmerged) * 0.85);

       // Dry exposed tops: upper facets exposed to air are completely matte matching ritual slab
       float exposedTop = max(0.0, sNorm.y) * (1.0 - isSubmerged);
       roughnessFactor = mix(roughnessFactor, 0.88, exposedTop * 0.85);
       roughnessFactor = mix(roughnessFactor, 0.72, mossPatch * 0.22);
       roughnessFactor = mix(roughnessFactor, 0.92, litter * 0.45);
       roughnessFactor = clamp(roughnessFactor, 0.05, 0.96);
      `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <aomap_fragment>',
      T.ShaderChunk.aomap_fragment + `
       float mAO = texture2D(uMicroAO, sUvX1).r * sWeights.x + texture2D(uMicroAO, sUvY1).r * sWeights.y + texture2D(uMicroAO, sUvZ1).r * sWeights.z;
       reflectedLight.indirectDiffuse *= mix(1.0, mAO, 0.45);

       // Local stone contact AO: bottom of stone nestled into bed receives heavy grounding shadow
       float contactAO = smoothstep(-0.85, -0.15, vStoneLocalY);
       reflectedLight.indirectDiffuse *= mix(0.45, 1.0, contactAO);
       reflectedLight.directDiffuse *= mix(0.60, 1.0, contactAO);
      `
    );

    // Final air-side safeguard: deep shadow and the translucent water edge
    // can still crush a genuinely exposed facet after the lighting pass. Keep
    // a muted stone floor only above the waterline; submerged rock is untouched.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <output_fragment>',
       `float submergedReadableWeight = isSubmerged * readableBedClast;
       vec3 submergedMineralFloor = min(vec3(0.98), diffuseColor.rgb * vec3(1.62, 1.50, 1.34) + vec3(0.055, 0.048, 0.038));
       float submergedFloorLuma = dot(submergedMineralFloor, vec3(0.299, 0.587, 0.114));
       submergedMineralFloor = mix(vec3(submergedFloorLuma), submergedMineralFloor, 1.44);
       submergedMineralFloor *= vec3(1.035, 1.00, 0.955);
       vec3 submergedReadable = max(outgoingLight, submergedMineralFloor);
       outgoingLight = mix(outgoingLight, submergedReadable, submergedReadableWeight * 0.94);
       float farBedWeight = smoothstep(2.6, 8.5, abs(vStoneWorldPos.z - 0.784));
       float coarseClast = smoothstep(0.72, 0.98, uMaterialClass) * (1.0 - smoothstep(2.65, 3.10, uMaterialClass));
       float farCoarseWeight = isSubmerged * farBedWeight * coarseClast;
       vec3 farCoarseReadable = min(vec3(0.97), diffuseColor.rgb * vec3(1.35, 1.28, 1.17) + vec3(0.032, 0.026, 0.019));
       float farCoarseLuma = dot(farCoarseReadable, vec3(0.299, 0.587, 0.114));
       farCoarseReadable = mix(vec3(farCoarseLuma), farCoarseReadable, 1.30);
       farCoarseReadable *= vec3(1.055, 1.00, 0.94);
       outgoingLight = mix(outgoingLight, max(outgoingLight, farCoarseReadable), farCoarseWeight * 0.88);
       float dryOutput = smoothstep(-0.078, -0.028, vStoneWorldPos.y);
       vec3 dryReadable = max(outgoingLight * 1.12, vec3(0.085, 0.078, 0.066));
       outgoingLight = mix(outgoingLight, dryReadable, dryOutput * 0.58);
       float paleOutput = dryOutput * smoothstep(0.34, 0.68, dot(outgoingLight, vec3(0.299, 0.587, 0.114)));
       vec3 weatheredOutput = mix(outgoingLight * vec3(0.56, 0.53, 0.48), outgoingLight * vec3(0.72, 0.69, 0.63), 0.45);
       outgoingLight = mix(outgoingLight, weatheredOutput, paleOutput * 0.64);
       // The exposed caps of the large anchor boulders are the only surfaces
       // needing this extra anti-chalk pass. Use the scanned grain to carry
       // the variation through lighting, while fully submerged faces remain
       // on their existing wet path.
       vec3 anchorDetail = min(vec3(0.46, 0.43, 0.38), grain * vec3(0.41, 0.38, 0.33) + vec3(0.055, 0.050, 0.041));
       anchorDetail = mix(anchorDetail, anchorMottle, 0.22);
       vec3 anchorLit = mix(outgoingLight * vec3(0.58, 0.55, 0.50), anchorDetail, 0.78);
       outgoingLight = mix(outgoingLight, anchorLit, dryOutput * anchorQuality * 0.90);
       #include <output_fragment>`
    );
  };

  mat.uViewRotation = uViewRotation;
  mat.uMaterialClass = uMaterialClass;
  // sFreq is injected as a compile-time literal above, while materialClass is
  // also part of the class-specific wet/dry response. Keep shader programs
  // distinct across classes but shared by roughness variants of the same class.
  mat.customProgramCacheKey = () => `streambed-pbr-${sFreq.toFixed(1)}-${materialClass.toFixed(2)}`;
  specularAntialiasing(mat);
  return mat;
}

/**
 * Build the complete 3D streambed structure:
 * - Scanned & sculpted multi-class 3D geometries
 * - 4K photogrammetry materials + world-space triplanar micro-detail
 * - Real multi-tier physical stacking with ZERO mesh phasing
 * - Organic flow-field distribution with zero repeating patterns or lines
 * - Clear refill bottle corridor framed with rich 3D pebbles
 */
export function buildStreambed(world) {
  const r = seededRandom(84291);
  const spatialGrid = new RiverbedSpatialGrid(0.14);

  // 1. Procedural water-sculpted river geometries with shared smooth normals
  // Class 1: Anchor Boulders (28cm - 46cm)
  const anchorGeoms = [
    createFluvialGeometry({ radius: 0.18, heightScale: 0.46, aspectRatio: 0.84, detail: 2, faceting: 0.10, seed: 1042 }),
    createFluvialGeometry({ radius: 0.18, heightScale: 0.42, aspectRatio: 0.98, detail: 2, faceting: 0.08, seed: 1061 }),
    createFluvialGeometry({ radius: 0.18, heightScale: 0.38, aspectRatio: 0.72, detail: 2, faceting: 0.09, seed: 1087 }),
    createFluvialGeometry({ radius: 0.18, heightScale: 0.43, aspectRatio: 0.80, detail: 2, faceting: 0.10, seed: 1103 })
  ];

  // Class 2: River Cobbles (7cm - 16cm). Six fallback silhouettes mirror the
  // six scan families used after asset load so even startup frames avoid clones.
  const cobbleGeoms = [
    createFluvialGeometry({ radius: 0.058, heightScale: 0.42, aspectRatio: 0.68, detail: 2, faceting: 0.018, seed: 2084 }),
    createFluvialGeometry({ radius: 0.058, heightScale: 0.38, aspectRatio: 0.82, detail: 2, faceting: 0.016, seed: 2111 }),
    createFluvialGeometry({ radius: 0.058, heightScale: 0.44, aspectRatio: 0.98, detail: 2, faceting: 0.012, seed: 2143 }),
    createFluvialGeometry({ radius: 0.058, heightScale: 0.31, aspectRatio: 0.82, detail: 2, faceting: 0.012, seed: 2179 }),
    createFluvialGeometry({ radius: 0.058, heightScale: 0.36, aspectRatio: 0.62, detail: 2, faceting: 0.014, seed: 2203 }),
    createFluvialGeometry({ radius: 0.058, heightScale: 0.41, aspectRatio: 0.77, detail: 2, faceting: 0.020, seed: 2237 })
  ];

  // Class 2b: dominant medium deposit (roughly 6cm - 12cm footprint).
  // Eight silhouettes preserve the four physical seating profiles while giving
  // each profile two genuinely different visible stone families.
  const mediumGeoms = [
    createFluvialGeometry({ radius: 0.045, heightScale: 0.30, aspectRatio: 0.68, detail: 2, faceting: 0.012, seed: 2241 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.30, aspectRatio: 0.98, detail: 2, faceting: 0.010, seed: 2269 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.25, aspectRatio: 0.82, detail: 2, faceting: 0.016, seed: 2297 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.25, aspectRatio: 0.61, detail: 2, faceting: 0.014, seed: 2329 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.32, aspectRatio: 0.77, detail: 2, faceting: 0.010, seed: 2357 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.23, aspectRatio: 0.82, detail: 2, faceting: 0.012, seed: 2389 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.23, aspectRatio: 0.96, detail: 2, faceting: 0.012, seed: 2417 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.23, aspectRatio: 0.70, detail: 2, faceting: 0.016, seed: 2447 })
  ];

  // Iteration-3 upper-cobble render tier. These remain the same accepted
  // physical medium stones in the spatial grid; only a bounded center/far
  // subset is rendered ~20-28% broader so the reference's 14-24cm secondary
  // hierarchy remains legible through water and distance. The three fallback
  // silhouettes are intentionally rounded/sub-rounded rather than blocky.
  const upperCobbleGeoms = [
    createFluvialGeometry({ radius: 0.045, heightScale: 0.29, aspectRatio: 0.98, detail: 2, faceting: 0.008, seed: 2473 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.28, aspectRatio: 0.76, detail: 2, faceting: 0.010, seed: 2503 }),
    createFluvialGeometry({ radius: 0.045, heightScale: 0.30, aspectRatio: 0.84, detail: 2, faceting: 0.010, seed: 2531 })
  ];

  // Class 3: Medium River Pebbles (3.0cm - 6.0cm). Five visible families stop
  // the 4k+ accepted pebbles/gap-fill stones from sharing one silhouette.
  const pebbleGeoms = [
    createFluvialGeometry({ radius: 0.028, heightScale: 0.38, aspectRatio: 0.62, detail: 2, faceting: 0.012, seed: 3126 }),
    createFluvialGeometry({ radius: 0.028, heightScale: 0.36, aspectRatio: 0.82, detail: 2, faceting: 0.014, seed: 3157 }),
    createFluvialGeometry({ radius: 0.028, heightScale: 0.40, aspectRatio: 0.77, detail: 2, faceting: 0.018, seed: 3187 }),
    createFluvialGeometry({ radius: 0.028, heightScale: 0.39, aspectRatio: 0.98, detail: 2, faceting: 0.010, seed: 3217 }),
    createFluvialGeometry({ radius: 0.028, heightScale: 0.35, aspectRatio: 0.68, detail: 2, faceting: 0.016, seed: 3251 })
  ];

  // Class 3b: River Shingle Discs (flat skipping stone discs, 2.8cm - 5.5cm)
  const shingleGeoms = [
    createFluvialGeometry({ radius: 0.026, heightScale: 0.27, aspectRatio: 0.82, detail: 2, faceting: 0.014, seed: 4168 }),
    createFluvialGeometry({ radius: 0.026, heightScale: 0.24, aspectRatio: 0.64, detail: 2, faceting: 0.012, seed: 4199 }),
    createFluvialGeometry({ radius: 0.026, heightScale: 0.28, aspectRatio: 0.76, detail: 2, faceting: 0.016, seed: 4229 })
  ];

  // Class 4: Dense Gravel Layer & Pea Shingle (1.2cm - 2.8cm) - Rounded water-worn gravel
  const gravelGeom = createFluvialGeometry({
    radius: 0.013,
    heightScale: 0.42,
    aspectRatio: 0.82,
    detail: 2,
    faceting: 0.02,
    seed: 5210
  });

  // Class 5: Interstitial River Grit & Sediment Matrix (0.35cm - 0.75cm)
  const gritGeom = createFluvialGeometry({
    radius: 0.0050,
    heightScale: 0.45,
    aspectRatio: 0.80,
    detail: 1,
    faceting: 0.02,
    seed: 6250
  });

  // 2. High-resolution PBR Materials matching ritual rock slab
  const boulderMat = createStreambedMaterial('boulder', { baseRoughness: 0.88, sFreq: 16.0, materialClass: 0 });
  const cobbleMats = [
    createStreambedMaterial('cobble-neutral', { baseRoughness: 0.83, sFreq: 28.0, materialClass: 1 }),
    createStreambedMaterial('cobble-matte', { baseRoughness: 0.87, sFreq: 28.0, materialClass: 1 }),
    createStreambedMaterial('cobble-satin', { baseRoughness: 0.80, sFreq: 28.0, materialClass: 1 })
  ];
  const mediumMats = [
    createStreambedMaterial('medium-neutral', { baseRoughness: 0.83, sFreq: 36.0, materialClass: 1.5 }),
    createStreambedMaterial('medium-matte', { baseRoughness: 0.87, sFreq: 36.0, materialClass: 1.5 }),
    createStreambedMaterial('medium-satin', { baseRoughness: 0.79, sFreq: 36.0, materialClass: 1.5 }),
    createStreambedMaterial('medium-weathered', { baseRoughness: 0.85, sFreq: 36.0, materialClass: 1.5 })
  ];
  const pebbleMats = [
    createStreambedMaterial('pebble-neutral', { baseRoughness: 0.82, sFreq: 52.0, materialClass: 2 }),
    createStreambedMaterial('pebble-matte', { baseRoughness: 0.86, sFreq: 52.0, materialClass: 2 }),
    createStreambedMaterial('pebble-satin', { baseRoughness: 0.79, sFreq: 52.0, materialClass: 2 })
  ];
  const shingleMats = [
    createStreambedMaterial('shingle-neutral', { baseRoughness: 0.81, sFreq: 56.0, materialClass: 2.5 }),
    createStreambedMaterial('shingle-matte', { baseRoughness: 0.86, sFreq: 56.0, materialClass: 2.5 })
  ];
  const gravelMat = createStreambedMaterial('gravel', { baseRoughness: 0.82, sFreq: 95.0, materialClass: 4 });
  const gritMat = createStreambedMaterial('grit', { baseRoughness: 0.84, sFreq: 160.0, materialClass: 5 });

  world.streambedMaterials = {
    boulderMat,
    cobbleMat: cobbleMats[0], cobbleMats,
    mediumMat: mediumMats[0], mediumMats,
    pebbleMat: pebbleMats[0], pebbleMats,
    shingleMat: shingleMats[0], shingleMats,
    gravelMat, gritMat
  };

  // 3. Placement arrays
  const anchorPlacements = [];
  const cobblePlacements = [];
  const mediumNearPlacements = Array.from({ length: 4 }, () => []);
  const mediumFarPlacements = Array.from({ length: 4 }, () => []);
  const pebblePlacements = [];
  const shinglePlacements = [];
  const gravelPlacements = [];
  const gritPlacements = [];

  const eps = 0.08;
  function getGroundNormal(x, z) {
    const slopeX = (forestHeight(x + eps, z) - forestHeight(x - eps, z)) / (2 * eps);
    const slopeZ = (forestHeight(x, z + eps) - forestHeight(x, z - eps)) / (2 * eps);
    return new T.Vector3(-slopeX, 1.0, -slopeZ).normalize();
  }

  // Refill bottle interaction corridor (center around x = channelX(0.8) + 0.112, z = 0.784)
  const refillX = channelX(0.8) + 0.112;
  const refillZ = 0.784;
  function isRefillCore(x, z, radius) {
    return Math.hypot(x - refillX, z - refillZ) < (0.32 + radius);
  }

  function refillMediumDensity(x, z) {
    const d = Math.hypot(x - refillX, z - refillZ);
    // The refill area must read as the same packed streambed, just with lower
    // relief. Keep most candidates even at the interaction center and feather
    // smoothly back to full density with no circular exclusion ring.
    return T.MathUtils.lerp(0.80, 1.0, T.MathUtils.smoothstep(d, 0.18, 0.82));
  }

  function flowYawAt(z) {
    const dz = 0.12;
    const dx = channelX(z + dz) - channelX(z - dz);
    return Math.atan2(dx, dz * 2.0);
  }

  // --- TIER 0: Class 1 Anchor Boulders (28cm - 46cm) ---
  // Prominent authored anchor boulders placed evenly along the channel reach
  const authoredAnchors = [
    // 1. Far bank deflection boulder: half-submerged on far bank
    { side: -0.68, z: 0.45, scale: 1.15, buried: 0.55 },
    // 2. Central riffle boulder: protruding smoothly through stream current
    { side: -0.08, z: 1.25, scale: 1.10, buried: 0.58 },
    // 3. Upstream channel anchor: deflecting stream run
    { side: -0.25, z: -0.50, scale: 1.05, buried: 0.55 },
    // 4. Downstream riffle boulder: creating depth looking downstream
    { side: -0.55, z: 2.30, scale: 1.15, buried: 0.55 },
    // 5. Near-bank gravel bar anchor: grounding the pebble spit near the player
    { side: 0.55, z: 1.95, scale: 1.05, buried: 0.58 },
    // 6. Shoreline anchor: near water's edge in view 01
    { side: 0.65, z: 0.18, scale: 1.05, buried: 0.56 },
    // 7. Left-reach far bank anchor: natural far bank rock
    { side: -0.65, z: -1.60, scale: 1.15, buried: 0.55 },
    // 8. Left-reach mid-stream anchor: mid-channel rock
    { side: 0.05, z: -1.20, scale: 1.10, buried: 0.56 },
    // 9. Downstream bank anchor
    { side: -0.60, z: -2.80, scale: 1.18, buried: 0.55 },
    // 10. Mid-reach center anchor: grounding the channel center
    { side: -0.05, z: 0.15, scale: 1.10, buried: 0.58 },
    // 11. Far-bank transition boulder
    { side: -0.65, z: 1.70, scale: 1.12, buried: 0.55 },
    // 12. Refill-zone framing boulder
    { side: 0.58, z: 1.15, scale: 1.05, buried: 0.58 },
    // 13. Far-bank refill view anchor: breaks straight waterline in view 04 and 05
    { side: -0.86, z: 0.95, scale: 1.25, buried: 0.58 },
    // 14. Far-bank upstream refill anchor: nestled into bank sediment
    { side: -0.62, z: 0.55, scale: 0.95, buried: 0.52 },
    // GH-37: sparse boulders deliberately straddle the wet/dry shelf.
    // Their centers sit just beyond the channel lip so their lower facets
    // remain wetted while the upper facets settle into the bank.
    { side: 1.06, z: -0.78, scale: 0.78, buried: 0.50 },
    { side: 1.08, z: 1.55, scale: 0.74, buried: 0.52 },
    { side: -1.07, z: 2.65, scale: 0.82, buried: 0.50 },
    { side: -1.05, z: -2.15, scale: 0.72, buried: 0.52 }
  ];

  for (const a of authoredAnchors) {
    const hw = creekWidth(a.z) * 0.5;
    const cx = channelX(a.z);
    const x = cx + a.side * hw;
    const scale = a.scale;
    const radius = 0.18 * scale;
    const halfH = 0.18 * 0.52 * scale;
    const gy = forestHeight(x, a.z);
    const yCenter = gy + (1.0 - 2.0 * a.buried) * halfH;

    const norm = getGroundNormal(x, a.z);
    const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), norm);
    const yaw = r() * TAU;
    const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    const imbrication = 0.05 + r() * 0.08;
    const qTilt = new T.Quaternion().setFromEuler(new T.Euler(imbrication, 0, (r() - 0.5) * 0.08, 'YXZ'));
    const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);

    const stoneObj = {
      x,
      y: yCenter,
      z: a.z,
      r: radius,
      h: halfH,
      yTop: yCenter + halfH,
      yBase: yCenter - halfH,
      tier: 0,
      isAnchor: true
    };
    spatialGrid.insert(stoneObj);

    const { color } = pickMineralColor(r);
    restrainPaleAnchorColor(color);
    anchorPlacements.push({
      x,
      y: yCenter,
      z: a.z,
      quaternion: quat,
      sx: scale,
      sy: scale,
      sz: scale,
      color
    });
  }

  // GH-37: a small, irregular course of bank-transition cobbles. These are
  // separate from the dense channel scatter so the integration reads as
  // natural edge deposition instead of a new hard boundary or a rock carpet.
  const transitionBankSamples = [
    [-1.18, -1.62, 0.92], [-1.11, -0.28, 0.78], [1.13, 0.22, 0.88],
    [1.10, 1.04, 0.76], [1.15, 2.10, 0.90], [-1.12, 3.42, 0.82],
    [1.08, 3.86, 0.74], [-1.16, 4.52, 0.86], [1.12, 5.18, 0.78],
    [-1.10, 6.05, 0.82]
  ];
  for (const [side, z, scale] of transitionBankSamples) {
    const hw = creekWidth(z) * 0.5;
    const cx = channelX(z);
    const x = cx + side * hw;
    const radius = 0.056 * scale;
    const halfH = 0.056 * 0.44 * scale;
    const gy = forestHeight(x, z);
    if (spatialGrid.hasSameTierCollision(x, z, radius, 1, 0.70)) continue;
    const contact = spatialGrid.computeContactElevation(x, z, radius, halfH, gy, 1, 0.53);
    const norm = contact.isStacked && contact.normalOffset ? contact.normalOffset : getGroundNormal(x, z);
    const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), norm);
    const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), r() * TAU);
    const qTilt = new T.Quaternion().setFromEuler(new T.Euler(0.04 + r() * 0.06, 0, (r() - 0.5) * 0.10, 'YXZ'));
    const yCenter = contact.yCenter;
    spatialGrid.insert({x, y: yCenter, z, r: radius, h: halfH, yTop: yCenter + halfH, yBase: yCenter - halfH, tier: 1, isAnchor: false, isStacked: contact.isStacked});
    const { color } = pickMineralColor(r);
    cobblePlacements.push({x, y: yCenter, z, quaternion: qAlign.clone().multiply(qYaw).multiply(qTilt), sx: scale, sy: scale, sz: scale, color});
  }

  // B. Natural distributed anchor boulders along the entire reach
  for (let z = -15.5; z <= 13.5; z += 0.50) {
    const zPerturb = z + (noise2D(z * 0.45, 12.3) - 0.5) * 0.40;
    if (r() > 0.40) continue;

    const hw = creekWidth(zPerturb) * 0.5;
    const cx = channelX(zPerturb);

    // Natural clustering along edges, riffles, and bends
    const side = (r() * 2 - 1) * 0.78;
    const x = cx + side * hw;

    if (isRefillCore(x, zPerturb, 0.18)) continue;

    // Check minimum distance from existing anchor rocks
    const nearAnchors = spatialGrid.findOverlaps(x, zPerturb, 0.45);
    if (nearAnchors.some(a => a.stone.isAnchor)) continue;

    const scale = 0.85 + r() * 0.45;
    const radius = 0.18 * scale;
    const halfH = 0.18 * 0.52 * scale;
    const gy = forestHeight(x, zPerturb);

    // Settled 52% - 62% into riverbed sediment
    const buriedFraction = 0.52 + r() * 0.10;
    const yCenter = gy + (1.0 - 2.0 * buriedFraction) * halfH;

    const norm = getGroundNormal(x, zPerturb);
    const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), norm);
    const yaw = r() * TAU;
    const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    const imbrication = 0.04 + r() * 0.08;
    const qTilt = new T.Quaternion().setFromEuler(new T.Euler(imbrication, 0, (r() - 0.5) * 0.08, 'YXZ'));
    const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);

    const stoneObj = {
      x,
      y: yCenter,
      z: zPerturb,
      r: radius,
      h: halfH,
      yTop: yCenter + halfH,
      yBase: yCenter - halfH,
      tier: 0,
      isAnchor: true
    };
    spatialGrid.insert(stoneObj);

    const { color } = pickMineralColor(r);
    restrainPaleAnchorColor(color);
    anchorPlacements.push({
      x,
      y: yCenter,
      z: zPerturb,
      quaternion: quat,
      sx: scale,
      sy: scale,
      sz: scale,
      color
    });
  }

  // --- TIER 1: Class 2 River Cobbles (roughly 10cm - 17cm footprint) ---
  // STREAM-BED-01 size rebalance: the photo reference is carried by hand-sized
  // cobbles, not thousands of small pebbles. Sample these deterministically over
  // the channel instead of marching in z rows. Broad riffle/facies weights keep
  // clusters irregular, while the center bias avoids turning both banks into
  // parallel retaining-wall bands.
  const cr = seededRandom(48173);
  const cobbleAttempts = 6500;
  for (let attempt = 0; attempt < cobbleAttempts; attempt++) {
    const zEff = -16.0 + cr() * 30.0;
    const hw = creekWidth(zEff) * 0.5;
    const cx = channelX(zEff);
    const centerBiasedSide = (cr() + cr() - 1.0) * 0.92;
    const uniformSide = (cr() * 2.0 - 1.0) * 0.92;
    const side = T.MathUtils.clamp(cr() < 0.74 ? centerBiasedSide : uniformSide, -0.94, 0.94);
    const x = cx + side * hw;

    const refillDistance = Math.hypot(x - refillX, zEff - refillZ);
    // Broaden the upper tail without creating a boulder field. Most stones stay
    // in the 10-18cm range, while a sparse deterministic subset reaches roughly
    // 18-23cm and supplies the secondary size tier visible in the reference.
    const coarseTail = T.MathUtils.smoothstep(noise2D(zEff * 0.61 + 27.0, side * 1.9 - 5.0), 0.80, 0.97);
    const scale = (0.92 + cr() * 0.70) * (1.0 + coarseTail * 0.24);
    const radius = 0.056 * scale;
    if (refillDistance < 0.34 + radius) continue;
    const refillTaper = T.MathUtils.smoothstep(refillDistance, 0.34 + radius, 0.82);
    if (cr() > T.MathUtils.lerp(0.30, 1.0, refillTaper)) continue;

    // Riffle/inner-channel facies favor coarse clasts but retain connected
    // sediment windows. These masks operate at metre scale, not pebble scale.
    const riffle = noise2D(zEff * 0.20 + 6.2, 35.7);
    const patch = noise2D(x * 0.82 - 10.4, zEff * 0.42 + 3.8);
    const centerWeight = T.MathUtils.lerp(1.0, 0.54, T.MathUtils.smoothstep(Math.abs(side), 0.56, 0.94));
    const riffleWeight = T.MathUtils.lerp(0.58, 1.0, T.MathUtils.smoothstep(riffle, 0.22, 0.76));
    if (patch > 0.91 && cr() < 0.62) continue;
    if (cr() > centerWeight * riffleWeight) continue;

    const halfH = 0.056 * 0.44 * scale;
    const gy = forestHeight(x, zEff);
    if (spatialGrid.hasSameTierCollision(x, zEff, radius, 1, 0.78)) continue;

    const farWeight = T.MathUtils.smoothstep(Math.abs(zEff - refillZ), 3.8, 10.5);
    const centerExposure = 1.0 - T.MathUtils.smoothstep(Math.abs(side), 0.42, 0.82);
    const cobbleEmbed = 0.55 - centerExposure * (0.018 + farWeight * 0.030);
    const contact = spatialGrid.computeContactElevation(x, zEff, radius, halfH, gy, 1, cobbleEmbed);
    const yCenter = contact.yCenter;
    const normalVec = contact.isStacked && contact.normalOffset ? contact.normalOffset : getGroundNormal(x, zEff);

    const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), normalVec);
    const yaw = flowYawAt(zEff) + (cr() - 0.5) * 1.05;
    const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    const imbrication = 0.035 + cr() * 0.075;
    const qTilt = new T.Quaternion().setFromEuler(new T.Euler(imbrication, 0, (cr() - 0.5) * 0.09, 'YXZ'));
    const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);

    spatialGrid.insert({
      x, y: yCenter, z: zEff, r: radius, h: halfH,
      yTop: yCenter + halfH, yBase: yCenter - halfH,
      tier: 1, isAnchor: false, isStacked: contact.isStacked
    });

    const { color } = pickBedClastColor(cr);
    cobblePlacements.push({
      x, y: yCenter, z: zEff, quaternion: quat,
      sx: scale, sy: scale, sz: scale, color
    });
  }

  // --- TIER 2: dominant medium pebble / small-cobble deposit (6cm - 12cm) ---
  // Candidate sampling is deliberately not row based: stable random candidates
  // cover the whole reach, while broad facies masks form patches and leave
  // sediment windows open. Larger classes already occupy the spatial grid, so
  // this layer settles around them before the smaller pebbles are added.
  // Keep a dedicated RNG so introducing this layer does not reshuffle the
  // established pebble/shingle candidate sequence that follows it.
  const mr = seededRandom(61937);
  const mediumAttempts = 62000;
  for (let attempt = 0; attempt < mediumAttempts; attempt++) {
    const zEff = -16.0 + mr() * 30.0;
    const hw = creekWidth(zEff) * 0.5;
    const cx = channelX(zEff);

    const facies = noise2D(zEff * 0.16 + 8.4, 2.7);
    const crossFacies = noise2D(zEff * 0.11 - 4.1, 18.2);
    // Keep the dominant layer across the physical bed, but stop tracing the
    // exact shoreline with a bright, continuous row. GH-37 transition stones
    // already own the final wet/dry lip.
    const side = T.MathUtils.clamp((mr() * 2 - 1) * 0.96 + (crossFacies - 0.5) * 0.12, -0.985, 0.985);
    const x = cx + side * hw;

    // Keep only small/local connected sediment windows. The prior threshold
    // removed too much substrate and made the creek look empty at normal view.
    const sedimentPocket = noise2D(x * 0.92 + 31.0, zEff * 0.48 - 12.0);
    if (sedimentPocket > 0.88 && mr() < 0.55) continue;

    // Dense pebble facies through the channel, including the bankward shelf.
    // Edge density is modulated by broad noise rather than a straight falloff,
    // preserving irregular sediment interruptions and the authored GH-37 edge.
    const edge = Math.abs(side);
    const edgeTexture = noise2D(zEff * 0.23 + (side > 0 ? 17.0 : -11.0), 42.3);
    const edgeFade = T.MathUtils.smoothstep(edge, 0.76, 0.985);
    const edgeWeight = 1.0 - edgeFade * T.MathUtils.lerp(0.52, 0.78, edgeTexture);
    const centerWeight = T.MathUtils.lerp(1.06, 0.96, T.MathUtils.smoothstep(edge, 0.0, 0.76));
    const faciesWeight = T.MathUtils.lerp(0.80, 1.0, T.MathUtils.smoothstep(facies, 0.24, 0.72));
    // Break residual shoreline continuity into irregular gaps instead of adding
    // more edge stones. The center remains dense; only the outer shelf receives
    // this low-frequency thinning.
    const shoreBreak = noise2D(zEff * 0.34 + (side > 0 ? 11.0 : -17.0), 53.0 + side * 1.7);
    if (edge > 0.77 && shoreBreak > 0.61 && mr() < T.MathUtils.lerp(0.30, 0.72, edgeFade)) continue;
    const density = Math.min(1.0, centerWeight * edgeWeight * faciesWeight * refillMediumDensity(x, zEff));
    if (mr() > density) continue;

    const variant = Math.min(3, Math.floor(mr() * 4));
    const refillDistance = Math.hypot(x - refillX, zEff - refillZ);
    const refillLowProfile = 1.0 - T.MathUtils.smoothstep(refillDistance, 0.16, 0.70);
    // Raise the average footprint ~16% versus the rejected candidate. The
    // larger true footprint naturally reduces accepted medium count through the
    // existing spatial grid instead of scaling thousands of already-packed
    // stones into intersections.
    const farWeight = T.MathUtils.smoothstep(Math.abs(zEff - refillZ), 3.6, 10.0);
    const centerVisibility = 1.0 - T.MathUtils.smoothstep(edge, 0.46, 0.84);
    const visibilityBoost = 1.0 + farWeight * (0.055 + centerVisibility * 0.060);
    const scale = (0.94 + mr() * 0.58) * visibilityBoost * T.MathUtils.lerp(0.82, 1.0, 1.0 - refillLowProfile);
    const radius = 0.045 * scale;
    const shapeHeights = [0.30, 0.25, 0.32, 0.23];
    const heightProfile = T.MathUtils.lerp(0.68, 1.0, 1.0 - refillLowProfile);
    const halfH = 0.045 * shapeHeights[variant] * scale * heightProfile;
    const mediumSpacing = T.MathUtils.lerp(0.59, 0.65, 1.0 - refillLowProfile);
    if (spatialGrid.hasSameTierCollision(x, zEff, radius, 2, mediumSpacing)) continue;

    const gy = forestHeight(x, zEff);
    const isNear = Math.abs(zEff - refillZ) < 5.0;
    // Refill stones are deliberately flatter and more deeply seated so the
    // bottle remains readable/usable while the streambed no longer has a hole.
    // Far stones keep a little more silhouette so the packed mosaic remains
    // readable down the reach.
    const baseEmbed = isNear
      ? (0.22 + mr() * 0.06)
      : Math.max(0.115, 0.15 + mr() * 0.05 - farWeight * centerVisibility * 0.035);
    const embedRatio = Math.min(0.44, baseEmbed + refillLowProfile * 0.16);
    const contact = spatialGrid.computeContactElevation(x, zEff, radius, halfH, gy, 2, embedRatio);
    const normalVec = contact.isStacked && contact.normalOffset ? contact.normalOffset : getGroundNormal(x, zEff);
    const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), normalVec);
    // Bias orientation toward the local channel tangent, with enough jitter to
    // avoid an engineered alignment field.
    const yaw = flowYawAt(zEff) + (mr() - 0.5) * 0.70;
    const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
    const qTilt = new T.Quaternion().setFromEuler(new T.Euler(0.012 + mr() * 0.035, 0, (mr() - 0.5) * 0.045, 'YXZ'));
    const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);
    const yCenter = contact.yCenter;

    spatialGrid.insert({
      x, y: yCenter, z: zEff, r: radius, h: halfH,
      yTop: yCenter + halfH, yBase: yCenter - halfH,
      tier: 2, isAnchor: false, isStacked: contact.isStacked
    });

    const color = pickMediumColor(mr);
    const item = {
      x, y: yCenter, z: zEff, quaternion: quat,
      sx: scale, sy: scale * heightProfile, sz: scale, color
    };
    (isNear ? mediumNearPlacements : mediumFarPlacements)[variant].push(item);
  }

  // --- TIER 3: Class 3 Water-Sculpted Pebbles & Shingle Discs (2.8cm - 6.5cm) ---
  // Small classes are now explicitly interstitial. A dedicated RNG prevents
  // the coarser rebalance above from reshuffling this tier unpredictably.
  const pr = seededRandom(53117);
  for (let z = -16.0; z <= 14.0; z += 0.060) {
    const hw = creekWidth(z) * 0.5;
    const cx = channelX(z);
    const inNearZone = Math.abs(z - 0.8) < 5.2;
    const inRefillZone = Math.abs(z - 0.8) < 1.6;
    const count = inRefillZone ? (5 + Math.floor(pr() * 4)) : inNearZone ? (4 + Math.floor(pr() * 3)) : (2 + Math.floor(pr() * 2));

    for (let c = 0; c < count; c++) {
      const sideNoise = (noise2D(z * 1.6 + c * 2.1, 23.8) - 0.5) * 0.35;
      const rawSide = (pr() * 2 - 1) * 0.90 + sideNoise * 0.26;
      const side = Math.max(-0.98, Math.min(0.98, rawSide));
      const x = cx + side * hw;
      const zEff = z + (pr() - 0.5) * 0.055;

      const isShingle = pr() < 0.40;
      const scale = 0.72 + pr() * 0.72;
      const baseRadius = isShingle ? 0.025 : 0.028;
      const baseHScale = isShingle ? 0.26 : 0.42;
      const radius = baseRadius * scale;
      const halfH = baseRadius * baseHScale * scale;
      const gy = forestHeight(x, zEff);

      // Prevent same-tier lateral penetration
      if (spatialGrid.hasSameTierCollision(x, zEff, radius, 3, 0.86)) continue;

      const contact = spatialGrid.computeContactElevation(x, zEff, radius, halfH, gy, 3, 0.58);
      const yCenter = contact.yCenter;
      let normalVec = contact.isStacked && contact.normalOffset ? contact.normalOffset : getGroundNormal(x, zEff);

      const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), normalVec);
      const yaw = pr() * TAU;
      const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
      const imbrication = isShingle ? (0.07 + pr() * 0.12) : (0.04 + pr() * 0.08);
      const qTilt = new T.Quaternion().setFromEuler(new T.Euler(imbrication, 0, (pr() - 0.5) * 0.10, 'YXZ'));
      const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);

      const stoneObj = {
        x,
        y: yCenter,
        z: zEff,
        r: radius,
        h: halfH,
        yTop: yCenter + halfH,
        yBase: yCenter - halfH,
        tier: 3,
        isAnchor: false,
        isStacked: contact.isStacked
      };
      spatialGrid.insert(stoneObj);

      const { color } = pickBedClastColor(pr);
      const item = {
        x,
        y: yCenter,
        z: zEff,
        quaternion: quat,
        sx: scale,
        sy: scale,
        sz: scale,
        color
      };

      if (isShingle) shinglePlacements.push(item);
      else pebblePlacements.push(item);
    }
  }

  // --- TIER 3b: Lateral Near-Bank Gravel Bar & Cross-Channel Riffle ---
  // Connects the near bank shallow water to mid-stream, completely eliminating the bare mud trench
  for (let z = -0.8; z <= 2.4; z += 0.065) {
    const hw = creekWidth(z) * 0.5;
    const cx = channelX(z);
    const barBreak = noise2D(z * 0.44 + 8.0, 71.0);
    if (barBreak > 0.64 && pr() < 0.70) continue;
    const count = 2 + Math.floor(pr() * 3);

    for (let k = 0; k < count; k++) {
      const sideNoise = (noise2D(z * 2.3 + k * 1.9, 52.4) - 0.5) * 0.22;
      const rawSide = 0.15 + pr() * 0.72 + sideNoise;
      const side = Math.max(0.08, Math.min(0.92, rawSide));
      const x = cx + side * hw;
      const zEff = z + (pr() - 0.5) * 0.12;

      if (isRefillCore(x, zEff, 0.06)) continue;

      const isShingle = pr() < 0.45;
      const scale = 0.70 + pr() * 0.68;
      const baseRadius = isShingle ? 0.024 : 0.027;
      const baseHScale = isShingle ? 0.26 : 0.42;
      const radius = baseRadius * scale;
      const halfH = baseRadius * baseHScale * scale;
      const gy = forestHeight(x, zEff);

      if (spatialGrid.hasSameTierCollision(x, zEff, radius, 3, 0.86)) continue;

      const contact = spatialGrid.computeContactElevation(x, zEff, radius, halfH, gy, 3, 0.58);
      const yCenter = contact.yCenter;
      let normalVec = contact.isStacked && contact.normalOffset ? contact.normalOffset : getGroundNormal(x, zEff);

      const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), normalVec);
      const yaw = pr() * TAU;
      const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
      const imbrication = isShingle ? (0.08 + pr() * 0.12) : (0.04 + pr() * 0.08);
      const qTilt = new T.Quaternion().setFromEuler(new T.Euler(imbrication, 0, (pr() - 0.5) * 0.10, 'YXZ'));
      const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);

      const stoneObj = {
        x, y: yCenter, z: zEff, r: radius, h: halfH,
        yTop: yCenter + halfH, yBase: yCenter - halfH,
        tier: 3, isAnchor: false, isStacked: contact.isStacked
      };
      spatialGrid.insert(stoneObj);

      const { color } = pickBedClastColor(pr);
      const item = { x, y: yCenter, z: zEff, quaternion: quat, sx: scale, sy: scale, sz: scale, color };
      if (isShingle) shinglePlacements.push(item);
      else pebblePlacements.push(item);
    }
  }

  // --- TIER 3c: secondary small-pebble gap fill (roughly 3cm - 5cm) ---
  // The user's target is a clast-supported creek bed: medium stones define the
  // structure, then smaller physical pebbles occupy the remaining interstices.
  // A dedicated RNG preserves every established pebble/shingle placement above.
  const gapR = seededRandom(77351);
  const gapAttempts = 1700;
  for (let attempt = 0; attempt < gapAttempts; attempt++) {
    const zEff = -15.7 + gapR() * 29.4;
    const hw = creekWidth(zEff) * 0.5;
    const cx = channelX(zEff);
    const rawSide = (gapR() * 2 - 1) * 0.93 + (noise2D(zEff * 0.19 + 5.7, 63.1) - 0.5) * 0.10;
    const side = T.MathUtils.clamp(rawSide, -0.96, 0.96);
    const x = cx + side * hw;

    // Preserve occasional small connected sediment windows rather than a
    // perfectly tiled surface, with stronger thinning only at the outer lip.
    const pocket = noise2D(x * 1.02 - 19.0, zEff * 0.56 + 8.0);
    if (pocket > 0.90 && gapR() < 0.55) continue;
    const edgeFade = T.MathUtils.smoothstep(Math.abs(side), 0.82, 0.96);
    if (gapR() < edgeFade * T.MathUtils.lerp(0.42, 0.72, noise2D(zEff * 0.27, side * 2.1 + 4.0))) continue;

    const refillDistance = Math.hypot(x - refillX, zEff - refillZ);
    const refillLowProfile = 1.0 - T.MathUtils.smoothstep(refillDistance, 0.14, 0.62);
    const scale = (0.56 + gapR() * 0.34) * T.MathUtils.lerp(0.86, 1.0, 1.0 - refillLowProfile);
    const radius = 0.028 * scale;
    const halfH = 0.028 * 0.34 * scale * T.MathUtils.lerp(0.70, 1.0, 1.0 - refillLowProfile);
    if (spatialGrid.hasSameTierCollision(x, zEff, radius, 3, 0.58)) continue;

    const gy = forestHeight(x, zEff);
    const embed = Math.min(0.66, 0.54 + gapR() * 0.07 + refillLowProfile * 0.05);
    const contact = spatialGrid.computeContactElevation(x, zEff, radius, halfH, gy, 3, embed);
    const normalVec = contact.isStacked && contact.normalOffset ? contact.normalOffset : getGroundNormal(x, zEff);
    const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), normalVec);
    const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), gapR() * TAU);
    const qTilt = new T.Quaternion().setFromEuler(new T.Euler(0.015 + gapR() * 0.035, 0, (gapR() - 0.5) * 0.045, 'YXZ'));
    const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);
    const yCenter = contact.yCenter;

    spatialGrid.insert({
      x, y: yCenter, z: zEff, r: radius, h: halfH,
      yTop: yCenter + halfH, yBase: yCenter - halfH,
      tier: 3, isAnchor: false, isStacked: contact.isStacked
    });
    const color = pickMediumColor(gapR).lerp(new T.Color('#a89f90'), 0.14);
    pebblePlacements.push({x, y: yCenter, z: zEff, quaternion: quat, sx: scale, sy: scale * 0.78, sz: scale, color});
  }

  // --- TIER 4: Class 4 River Gravel & Pea Shingle (1.2cm - 2.8cm) ---
  // Gap-fill rather than the dominant visible layer. Broad sediment pockets are
  // preserved instead of being carpeted with thousands of dark tiny instances.
  const gravelR = seededRandom(60493);
  for (let z = -15.0; z <= 13.0; z += 0.090) {
    const hw = creekWidth(z) * 0.5;
    const cx = channelX(z);
    const distToPlayer = Math.abs(z - 0.8);
    const isClose = distToPlayer < 5.0;
    const count = isClose ? (4 + Math.floor(gravelR() * 3)) : (2 + Math.floor(gravelR() * 2));

    for (let g = 0; g < count; g++) {
      const sideNoise = (noise2D(z * 1.8 + g * 2.7, 31.8) - 0.5) * 0.35;
      const rawSide = (gravelR() * 2 - 1) * 0.94 + sideNoise * 0.28;
      const side = Math.max(-1.02, Math.min(1.02, rawSide));
      const x = cx + side * hw;
      const zEff = z + (gravelR() - 0.5) * 0.045;

      const gravelPocket = noise2D(x * 0.78 + 6.2, zEff * 0.39 + 21.0);
      if (gravelPocket > 0.70 && gravelR() < 0.78) continue;

      const scale = 0.72 + gravelR() * 0.72;
      const radius = 0.013 * scale;
      const halfH = 0.013 * 0.40 * scale;
      const gy = forestHeight(x, zEff);

      const contact = spatialGrid.computeContactElevation(x, zEff, radius, halfH, gy, 4, 0.64);
      const yCenter = contact.yCenter;
      let normalVec = contact.isStacked && contact.normalOffset ? contact.normalOffset : getGroundNormal(x, zEff);

      const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), normalVec);
      const yaw = gravelR() * TAU;
      const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
      const imbrication = 0.04 + gravelR() * 0.06;
      const qTilt = new T.Quaternion().setFromEuler(new T.Euler(imbrication, 0, (gravelR() - 0.5) * 0.06, 'YXZ'));
      const quat = qAlign.clone().multiply(qYaw).multiply(qTilt);

      const stoneObj = {
        x,
        y: yCenter,
        z: zEff,
        r: radius,
        h: halfH,
        yTop: yCenter + halfH,
        yBase: yCenter - halfH,
        tier: 4,
        isAnchor: false,
        isStacked: contact.isStacked
      };
      spatialGrid.insert(stoneObj);

      const { color } = pickMineralColor(gravelR);
      gravelPlacements.push({
        x,
        y: yCenter,
        z: zEff,
        quaternion: quat,
        sx: scale,
        sy: scale,
        sz: scale,
        color
      });
    }
  }

  // --- TIER 5: Class 5 Interstitial River Grit & Sediment Matrix (0.35cm - 0.75cm) ---
  // Granular sediment nestled deeply in crevices between stones, grounding the bed into a solid matrix
  const gritR = seededRandom(65129);
  for (let z = -9.0; z <= 9.0; z += 0.080) {
    const hw = creekWidth(z) * 0.5;
    const cx = channelX(z);
    const count = 2 + Math.floor(gritR() * 3);

    for (let gt = 0; gt < count; gt++) {
      const sideNoise = (noise2D(z * 2.1 + gt * 3.1, 47.2) - 0.5) * 0.35;
      const rawSide = (gritR() * 2 - 1) * 0.94 + sideNoise * 0.28;
      const side = Math.max(-1.04, Math.min(1.04, rawSide));
      const x = cx + side * hw;
      const zEff = z + (gritR() - 0.5) * 0.045;

      const gritPocket = noise2D(x * 0.86 - 13.0, zEff * 0.44 + 7.5);
      if (gritPocket > 0.68 && gritR() < 0.82) continue;

      const scale = 0.85 + gritR() * 0.45;
      const radius = 0.009 * scale;
      const halfH = 0.009 * 0.45 * scale;
      const gy = forestHeight(x, zEff);

      // Natural sedimentary seating: grit settles 54% into bed
      const yCenter = gy + (1.0 - 2.0 * 0.54) * halfH;
      const normalVec = getGroundNormal(x, zEff);

      const qAlign = new T.Quaternion().setFromUnitVectors(V(0, 1, 0), normalVec);
      const yaw = gritR() * TAU;
      const qYaw = new T.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw);
      const quat = qAlign.clone().multiply(qYaw);

      const { color } = pickMineralColor(gritR);
      gritPlacements.push({
        x,
        y: yCenter,
        z: zEff,
        quaternion: quat,
        sx: scale,
        sy: scale,
        sz: scale,
        color
      });
    }
  }

  // Visual-family partitioning happens only after every placement/collision has
  // already been accepted. Dedicated seeds keep the established physical bed
  // exactly stable while distributing clones across real scan silhouettes.
  const cobbleRenderPlacements = partitionPlacements(cobblePlacements, cobbleGeoms.length, 91123, [0.19, 0.19, 0.20, 0.05, 0.20, 0.17]);
  const pebbleRenderPlacements = partitionPlacements(pebblePlacements, pebbleGeoms.length, 92761, [0.24, 0.18, 0.20, 0.22, 0.16]);
  const shingleRenderPlacements = partitionPlacements(shinglePlacements, shingleGeoms.length, 93887, [0.32, 0.43, 0.25]);
  const mediumNearRenderPlacements = [];
  const mediumFarRenderPlacements = [];
  const mediumPairWeights = [[0.42, 0.58], [0.45, 0.55], [0.90, 0.10], [0.62, 0.38]];
  for (let physicalVariant = 0; physicalVariant < 4; physicalVariant++) {
    const nearSplit = partitionPlacements(mediumNearPlacements[physicalVariant], 2, 94601 + physicalVariant * 101, mediumPairWeights[physicalVariant]);
    const farSplit = partitionPlacements(mediumFarPlacements[physicalVariant], 2, 95231 + physicalVariant * 103, mediumPairWeights[physicalVariant]);
    mediumNearRenderPlacements.push(...nearSplit);
    mediumFarRenderPlacements.push(...farSplit);
  }

  // Critic iteration 2: promote a fixed number of already-accepted center/far
  // medium stones into a visibly distinct upper-cobble tier. This happens only
  // after physical placement/collision is finished, so count, seating and refill
  // gameplay stay unchanged. Avoid the outer shelf entirely so this cannot
  // strengthen the pale shoreline bead effect.
  const promotionR = seededRandom(98617);
  const promotionCandidates = [];
  for (const group of mediumFarRenderPlacements) {
    for (const p of group) {
      const hw = creekWidth(p.z) * 0.5;
      const side = hw > 0.001 ? Math.abs((p.x - channelX(p.z)) / hw) : 1.0;
      const refillDistance = Math.hypot(p.x - refillX, p.z - refillZ);
      const farEnough = Math.abs(p.z - refillZ) > 2.6;
      // Select only already-large medium clasts so a +18-28% footprint boost
      // lands in the intended ~14-24cm secondary band instead of upscaling fines.
      if (side < 0.72 && refillDistance > 1.0 && farEnough && p.sx >= 1.20) {
        promotionCandidates.push(p);
      }
    }
  }
  // Deterministic Fisher-Yates shuffle with a dedicated RNG; no existing RNG
  // sequence or physical placement can be perturbed by this visual-only tier.
  for (let i = promotionCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(promotionR() * (i + 1));
    const tmp = promotionCandidates[i];
    promotionCandidates[i] = promotionCandidates[j];
    promotionCandidates[j] = tmp;
  }
  const promotedMediums = promotionCandidates.slice(0, Math.min(400, promotionCandidates.length));
  const promotedSet = new Set(promotedMediums);
  for (let i = 0; i < mediumFarRenderPlacements.length; i++) {
    mediumFarRenderPlacements[i] = mediumFarRenderPlacements[i].filter(p => !promotedSet.has(p));
  }
  const upperCobbleRenderPlacements = Array.from({ length: upperCobbleGeoms.length }, () => []);
  for (const p of promotedMediums) {
    const footprintBoost = 1.18 + promotionR() * 0.10;
    const heightBoost = 1.08 + promotionR() * 0.07;
    // Favor the roundest source-family slot while retaining two genuinely
    // different sub-rounded/elongated water-worn silhouettes.
    const roll = promotionR();
    const family = roll < 0.52 ? 0 : roll < 0.80 ? 1 : 2;
    upperCobbleRenderPlacements[family].push({
      ...p,
      sx: p.sx * footprintBoost,
      sy: p.sy * heightBoost,
      sz: p.sz * footprintBoost,
      color: p.color?.clone ? p.color.clone() : p.color
    });
  }

  // The outermost true cobbles were still forming a pale, evenly exposed bead
  // line along the bank. Keep their authored positions, but seat the rendered
  // silhouette lower/smaller and slightly mute only bright edge stones.
  for (let family = 0; family < cobbleRenderPlacements.length; family++) {
    cobbleRenderPlacements[family] = cobbleRenderPlacements[family].map(p => {
      const hw = creekWidth(p.z) * 0.5;
      const side = hw > 0.001 ? Math.abs((p.x - channelX(p.z)) / hw) : 0.0;
      if (side < 0.82) return p;
      const edgeColor = p.color?.clone ? p.color.clone() : p.color;
      if (edgeColor) {
        const luma = edgeColor.r * 0.2126 + edgeColor.g * 0.7152 + edgeColor.b * 0.0722;
        if (luma > 0.46) edgeColor.lerp(new T.Color('#756f66'), side > 0.90 ? 0.46 : 0.34);
      }
      const outer = T.MathUtils.smoothstep(side, 0.82, 0.98);
      return {
        ...p,
        sx: p.sx * T.MathUtils.lerp(0.94, 0.88, outer),
        sy: p.sy * T.MathUtils.lerp(0.76, 0.56, outer),
        sz: p.sz * T.MathUtils.lerp(0.94, 0.88, outer),
        color: edgeColor
      };
    });
  }

  // Larger anchors are sparse enough that repeated source-0 silhouettes stand
  // out immediately. Partition only their render geometry; physical seating and
  // collision stay untouched. The two refill-visible pale offenders identified
  // in the exact QA view are forced onto distinct round/elongated scan families
  // and receive restrained dark mineral tints rather than chalk-beige caps.
  const anchorRenderPlacements = partitionPlacements(anchorPlacements, anchorGeoms.length, 90431, [0.28, 0.28, 0.24, 0.20]);
  const detachAnchorPlacement = placementIndex => {
    const placement = anchorPlacements[placementIndex];
    if (!placement) return null;
    for (const group of anchorRenderPlacements) {
      const idx = group.indexOf(placement);
      if (idx !== -1) group.splice(idx, 1);
    }
    return placement;
  };
  const heroAnchorPlacements = [
    detachAnchorPlacement(12),
    detachAnchorPlacement(16)
  ].filter(Boolean);

  // Batch into InstancedMesh
  const dummy = new T.Object3D();
  function instantiateBatch(geometry, material, placements, name, shadow = false) {
    if (!placements.length) return null;
    const inst = new T.InstancedMesh(geometry, material, placements.length);
    inst.name = name;
    inst.castShadow = shadow;
    inst.receiveShadow = true;

    if (material.uViewRotation) {
      inst.onBeforeRender = (_renderer, _scene, camera) => {
        material.uViewRotation.value.setFromMatrix4(camera.matrixWorldInverse);
      };
    }

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      dummy.position.set(p.x, p.y, p.z);
      if (p.quaternion) dummy.quaternion.copy(p.quaternion);
      dummy.scale.set(p.sx, p.sy, p.sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (p.color) inst.setColorAt(i, p.color);
    }

    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingBox();
    inst.computeBoundingSphere();
    world.scene.add(inst);
    return inst;
  }

  const anchorMeshes = anchorGeoms.map((geometry, i) => instantiateBatch(
    geometry,
    boulderMat,
    anchorRenderPlacements[i],
    `Streambed Class 1 Anchor Family ${i + 1}`,
    true
  ));
  const heroAnchorMaterials = ['#555952', '#60584e'].map(color => {
    const pbr = getSharedRockPbr();
    const material = new T.MeshStandardMaterial({
      map: pbr.diff,
      normalMap: pbr.nor,
      roughnessMap: pbr.rough,
      aoMap: pbr.ao,
      color,
      roughness: 0.84,
      metalness: 0.0,
      envMapIntensity: 0.82,
      vertexColors: false
    });
    material.normalScale.set(1.62, 1.62);
    specularAntialiasing(material);
    return material;
  });
  const heroAnchorMeshes = heroAnchorPlacements.map((placement, i) => instantiateBatch(
    anchorGeoms[(i + 1) % anchorGeoms.length].clone(),
    heroAnchorMaterials[i],
    [placement],
    `Streambed Class 1 Refill Hero Anchor ${i + 1}`,
    true
  ));
  const cobbleMeshes = cobbleGeoms.map((geometry, i) => instantiateBatch(
    geometry,
    cobbleMats[i % cobbleMats.length],
    cobbleRenderPlacements[i],
    `Streambed Class 2 River Cobble Family ${i + 1}`,
    i < 3
  ));
  const mediumNearMeshes = mediumGeoms.map((geometry, i) => instantiateBatch(
    geometry,
    mediumMats[i % mediumMats.length],
    mediumNearRenderPlacements[i],
    `Streambed Class 2b Medium Family ${i + 1} Near`,
    i < 3
  ));
  // Far batches own clones so later scan/LOD swaps can dispose either tier
  // independently without invalidating the other mesh's current geometry.
  const mediumFarMeshes = mediumGeoms.map((geometry, i) => instantiateBatch(
    geometry.clone(),
    mediumMats[i % mediumMats.length],
    mediumFarRenderPlacements[i],
    `Streambed Class 2b Medium Family ${i + 1} Far`,
    false
  ));
  const upperCobbleMeshes = upperCobbleGeoms.map((geometry, i) => instantiateBatch(
    geometry,
    cobbleMats[i % cobbleMats.length],
    upperCobbleRenderPlacements[i],
    `Streambed Class 2c Upper Cobble Family ${i + 1}`,
    i === 0
  ));
  const pebbleMeshes = pebbleGeoms.map((geometry, i) => instantiateBatch(
    geometry,
    pebbleMats[i % pebbleMats.length],
    pebbleRenderPlacements[i],
    `Streambed Class 3 River Pebble Family ${i + 1}`,
    false
  ));
  const shingleMeshes = shingleGeoms.map((geometry, i) => instantiateBatch(
    geometry,
    shingleMats[i % shingleMats.length],
    shingleRenderPlacements[i],
    `Streambed Class 3b River Shingle Family ${i + 1}`,
    false
  ));
  const gravelMesh = instantiateBatch(gravelGeom, gravelMat, gravelPlacements, 'Streambed Class 4 Dense River Gravel', false);
  const gritMesh = instantiateBatch(gritGeom, gritMat, gritPlacements, 'Streambed Class 5 Interstitial River Grit', false);

  world.streambed = {
    anchorMeshes,
    anchorMesh: anchorMeshes[0] || null,
    heroAnchorMeshes,
    cobbleMeshes,
    cobbleMesh: cobbleMeshes[0] || null,
    mediumNearMeshes,
    mediumFarMeshes,
    upperCobbleMeshes,
    pebbleMeshes,
    pebbleMesh: pebbleMeshes[0] || null,
    shingleMeshes,
    shingleMesh: shingleMeshes[0] || null,
    gravelMesh,
    gritMesh,
    spatialGrid,
    counts: {
      anchors: anchorPlacements.length,
      anchorVariants: anchorRenderPlacements.map(p => p.length),
      cobbles: cobblePlacements.length,
      medium: mediumNearPlacements.reduce((n, p) => n + p.length, 0) + mediumFarPlacements.reduce((n, p) => n + p.length, 0),
      mediumNear: mediumNearPlacements.reduce((n, p) => n + p.length, 0),
      mediumFar: mediumFarPlacements.reduce((n, p) => n + p.length, 0),
      cobbleVariants: cobbleRenderPlacements.map(p => p.length),
      mediumPhysicalVariants: mediumNearPlacements.map((p, i) => p.length + mediumFarPlacements[i].length),
      mediumVariants: mediumNearRenderPlacements.map((p, i) => p.length + mediumFarRenderPlacements[i].length),
      upperCobblePromotions: upperCobbleRenderPlacements.reduce((n, p) => n + p.length, 0),
      pebbles: pebblePlacements.length,
      pebbleVariants: pebbleRenderPlacements.map(p => p.length),
      shingle: shinglePlacements.length,
      shingleVariants: shingleRenderPlacements.map(p => p.length),
      gravel: gravelPlacements.length,
      grit: gritPlacements.length,
      geometryBatches: {
        anchors: anchorMeshes.filter(Boolean).length + heroAnchorMeshes.filter(Boolean).length,
        cobbles: cobbleMeshes.filter(Boolean).length,
        mediumNear: mediumNearMeshes.filter(Boolean).length,
        mediumFar: mediumFarMeshes.filter(Boolean).length,
        upperCobbles: upperCobbleMeshes.filter(Boolean).length,
        pebbles: pebbleMeshes.filter(Boolean).length,
        shingle: shingleMeshes.filter(Boolean).length,
        gravel: gravelMesh ? 1 : 0,
        grit: gritMesh ? 1 : 0
      },
      total: anchorPlacements.length + cobblePlacements.length + mediumNearPlacements.reduce((n, p) => n + p.length, 0) + mediumFarPlacements.reduce((n, p) => n + p.length, 0) + pebblePlacements.length + shinglePlacements.length + gravelPlacements.length + gritPlacements.length
    }
  };

  return world.streambed;
}

/**
 * Connect scanned 3D photogrammetry models from rock_moss_set_01 once loaded,
 * replacing the initial geometries across all rock classes with real scanned meshes!
 */
export function upgradeStreambedGeometries(world, sources, lods) {
  if (!world.streambed || !sources || sources.length < 2) return;
  const {
    anchorMesh,
    anchorMeshes = anchorMesh ? [anchorMesh] : [],
    heroAnchorMeshes = [],
    cobbleMeshes = [],
    mediumNearMeshes = [],
    mediumFarMeshes = [],
    upperCobbleMeshes = [],
    pebbleMeshes = [],
    shingleMeshes = [],
    gravelMesh,
    gritMesh
  } = world.streambed;

  const prepare = (src, radius, heightScale, useLod = true, aspectX = 1.0, aspectZ = 1.0) => {
    if (!src) return null;
    // The large river anchors are the highlighted stones that cross the
    // waterline. They must share the ritual slab's full-resolution silhouette;
    // using the companion LOD here makes their exposed caps visibly faceted.
    const sourceMesh = (useLod ? lods?.get(src.name) : null) ?? src;
    const raw = sourceMesh.geometry.clone();
    raw.computeBoundingBox();
    const bb = raw.boundingBox;
    const sz = bb.getSize(new T.Vector3());
    const c = bb.getCenter(new T.Vector3());
    raw.translate(-c.x, -c.y, -c.z);
    const maxSz = Math.max(sz.x, sz.z);
    raw.scale(
      ((radius * 2.0) / maxSz) * aspectX,
      (radius * 2.0 * heightScale) / sz.y,
      ((radius * 2.0) / maxSz) * aspectZ
    );
    raw.computeVertexNormals();
    raw.computeBoundingBox();
    raw.computeBoundingSphere();
    return raw;
  };

  const swap = (mesh, src, radius, heightScale, useLod = true, aspectX = 1.0, aspectZ = 1.0) => {
    if (!mesh || !src) return;
    const g = prepare(src, radius, heightScale, useLod, aspectX, aspectZ);
    if (g) {
      mesh.geometry.dispose();
      mesh.geometry = g;
    }
  };

  // Swap photogrammetry scans onto all rock classes:
  // 1. Sparse anchor boulders: four full-resolution scan silhouettes prevent
  // the most visible large stones from repeating one benchmark slab shape.
  const anchorFamilies = [
    { src: sources[0], h: 0.44, ax: 0.94, az: 1.00 },
    { src: sources[2] ?? sources[0], h: 0.42, ax: 1.00, az: 0.98 },
    { src: sources[5] ?? sources[1] ?? sources[0], h: 0.38, ax: 0.90, az: 1.06 },
    { src: sources[1] ?? sources[0], h: 0.40, ax: 1.04, az: 0.92 }
  ];
  for (let i = 0; i < anchorMeshes.length; i++) {
    const f = anchorFamilies[i] ?? anchorFamilies[0];
    swap(anchorMeshes[i], f.src, 0.18, f.h, false, f.ax, f.az);
  }
  const heroAnchorFamilies = [
    { src: sources[2] ?? sources[0], h: 0.40, ax: 1.02, az: 0.96 },
    { src: sources[5] ?? sources[1] ?? sources[0], h: 0.36, ax: 0.90, az: 1.08 }
  ];
  for (let i = 0; i < heroAnchorMeshes.length; i++) {
    const f = heroAnchorFamilies[i] ?? heroAnchorFamilies[0];
    swap(heroAnchorMeshes[i], f.src, 0.18, f.h, false, f.ax, f.az);
  }
  // 2. River cobbles: all six scans are represented. Source 3's tall/blocky
  // scan is deliberately flattened so it reads as a water-set fractured cobble
  // rather than an upright chunk.
  const cobbleFamilies = [
    { src: sources[0], h: 0.42, ax: 0.96, az: 1.00 },
    { src: sources[1], h: 0.38, ax: 1.00, az: 0.96 },
    { src: sources[2], h: 0.44, ax: 1.00, az: 1.00 },
    { src: sources[3], h: 0.31, ax: 1.08, az: 0.88 },
    { src: sources[4], h: 0.36, ax: 0.96, az: 1.00 },
    { src: sources[5], h: 0.41, ax: 1.00, az: 0.95 }
  ];
  for (let i = 0; i < cobbleFamilies.length; i++) {
    const f = cobbleFamilies[i];
    swap(cobbleMeshes[i], f.src || sources[2] || sources[0], 0.058, f.h, false, f.ax, f.az);
  }

  // 2b. Dominant medium deposit: eight real scan-derived silhouettes. The
  // physical seating still uses the established four height profiles; each pair
  // below shares that height while changing scan topology/asymmetry.
  const mediumFamilies = [
    { src: sources[0], h: 0.30, ax: 0.96, az: 1.00 },
    { src: sources[2], h: 0.30, ax: 1.00, az: 0.96 },
    { src: sources[1], h: 0.25, ax: 1.00, az: 0.94 },
    { src: sources[4], h: 0.25, ax: 0.96, az: 1.00 },
    { src: sources[5], h: 0.32, ax: 1.00, az: 0.94 },
    { src: sources[3], h: 0.23, ax: 1.06, az: 0.86 },
    { src: sources[2], h: 0.23, ax: 0.94, az: 1.00 },
    { src: sources[0], h: 0.23, ax: 1.00, az: 0.88 }
  ];
  for (let i = 0; i < mediumFamilies.length; i++) {
    const f = mediumFamilies[i];
    swap(mediumNearMeshes[i], f.src || sources[2] || sources[0], 0.045, f.h, false, f.ax, f.az);
    swap(mediumFarMeshes[i], f.src || sources[2] || sources[0], 0.045, f.h, true, f.ax, f.az);
  }

  // Iteration-3 upper-cobble tier: deliberately bias to rounded/sub-rounded
  // full-resolution scans. Placement scaling supplies the secondary size band;
  // this mapping supplies the more water-worn silhouettes requested by the critic.
  const upperCobbleFamilies = [
    { src: sources[2] ?? sources[0], h: 0.29, ax: 1.00, az: 0.98 },
    { src: sources[0] ?? sources[2], h: 0.28, ax: 0.94, az: 1.00 },
    { src: sources[5] ?? sources[1] ?? sources[2], h: 0.30, ax: 0.96, az: 1.00 }
  ];
  for (let i = 0; i < upperCobbleMeshes.length; i++) {
    const f = upperCobbleFamilies[i] ?? upperCobbleFamilies[0];
    swap(upperCobbleMeshes[i], f.src, 0.045, f.h, false, f.ax, f.az);
  }

  // 3. Pebbles and 3c gap-fill: five families, including the round source 2.
  // All use available LOD counterparts because this tier has thousands of
  // instances; scan topology varies while draw-call/triangle growth stays bounded.
  const pebbleFamilies = [
    { src: sources[4], h: 0.38, ax: 0.96, az: 1.00 },
    { src: sources[1], h: 0.36, ax: 1.00, az: 0.95 },
    { src: sources[5], h: 0.40, ax: 1.00, az: 0.94 },
    { src: sources[2], h: 0.39, ax: 0.96, az: 1.00 },
    { src: sources[0], h: 0.35, ax: 1.00, az: 0.90 }
  ];
  for (let i = 0; i < pebbleFamilies.length; i++) {
    const f = pebbleFamilies[i];
    swap(pebbleMeshes[i], f.src || sources[4] || sources[2], 0.028, f.h, true, f.ax, f.az);
  }

  // 4. Shingle remains flatter but also gains three topologies instead of one.
  const shingleFamilies = [
    { src: sources[1], h: 0.27, ax: 1.00, az: 0.94 },
    { src: sources[4], h: 0.24, ax: 0.96, az: 1.00 },
    { src: sources[5], h: 0.28, ax: 1.00, az: 0.93 }
  ];
  for (let i = 0; i < shingleFamilies.length; i++) {
    const f = shingleFamilies[i];
    swap(shingleMeshes[i], f.src || sources[5] || sources[1], 0.026, f.h, true, f.ax, f.az);
  }
  // 5. River gravel: use sources[3] (small water-tumbled rock)
  swap(gravelMesh, sources[3] || sources[2], 0.016, 0.42);
  // 6. Interstitial grit: use sources[1] (fine stone chip)
  swap(gritMesh, sources[1] || sources[4], 0.009, 0.45);
}

/**
 * Connect scanned high-resolution PBR textures to streambed materials once loaded.
 */
export function applyStreambedTextures(world, { diffMap, normalMap, roughMap } = {}) {
  // Streambed materials use native 4K photogrammetry triplanar maps directly matching the ritual rock slab.
  // We intentionally preserve those clean PBR maps rather than overriding with 2D ground textures.
}
