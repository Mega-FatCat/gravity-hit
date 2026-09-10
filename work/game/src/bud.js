import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function createRng(seed = 1337) {
  let s = seed;
  return function() {
    s = (Math.imul(1664525, s) + 1013904223) | 0;
    return ((s >>> 0) / 4294967296);
  };
}

/**
 * Creates an authentic, irregular, clustered botanical cannabis bud geometry.
 *
 * Anatomical details:
 * - Central tapered stalk core
 * - 44-52 tightly clustered, swollen calyx bracts arranged in a natural spiral whorl
 * - Longitudinal creased bract profiles with upward curling tips
 * - 14-18 pointed sugar leaf tips breaking the silhouette
 * - 22-26 curled, winding pistil hairs (stigmas) in rich burnt orange/copper
 * - Multi-octave organic surface displacement
 * - Natural herbal color variation: deep forest green crevices, earthy olive bodies,
 *   cured amber/brown dried leaf tips, and delicate frosty trichome crystal highlights.
 */
export function createBudGeometry(options = {}) {
  const seed = options.seed || 420;
  const rng = createRng(seed);
  const rand = (min, max) => min + (max - min) * rng();
  const overallScale = options.scale || 0.72; // Default fits chillum bowl (~7.2mm diameter)

  const parts = [];
  const partTypes = []; // 0: calyx, 1: leaf, 2: pistil

  // 1. Central tapered core stalk
  const coreHeight = 0.0070 * overallScale;
  const coreGeo = new T.CylinderGeometry(0.0008 * overallScale, 0.0015 * overallScale, coreHeight, 8, 5);
  coreGeo.translate(0, coreHeight * 0.5, 0);
  parts.push(coreGeo);
  partTypes.push({count: coreGeo.attributes.position.count, type: 0});

  // 2. Swollen, tightly clustered calyx bracts (46 lobes for high density)
  const numCalyxes = options.calyxCount || 46;
  for (let i = 0; i < numCalyxes; i++) {
    const t = i / (numCalyxes - 1); // 0 at base, 1 at crown
    const y = (0.0005 + t * 0.0060) * overallScale;
    const goldenAngle = 2.399963; // ~137.5 degrees
    const angle = i * goldenAngle + rand(-0.25, 0.25);
    
    // Tapering profile: chunky conical cluster, wider base, compact multi-peaked crown
    const profileRadius = Math.sin(t * Math.PI * 0.82 + 0.18);
    const dist = (0.0010 + profileRadius * 0.0017) * overallScale * rand(0.85, 1.15);

    // Compact calyx dimensions
    const cRadius = (0.00075 + (1 - t * 0.45) * 0.00055) * overallScale * rand(0.88, 1.14);
    const cLength = cRadius * rand(1.7, 2.2);
    
    // Create calyx with longitudinal crease and curved pointed tip
    const calyx = new T.SphereGeometry(cRadius, 7, 7);
    const pos = calyx.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      let px = pos.getX(j);
      let py = pos.getY(j);
      let pz = pos.getZ(j);

      // Longitudinal bract crease down center (X=0)
      const crease = Math.abs(px) / (cRadius + 0.00001);
      pz *= (0.85 + crease * 0.25);

      if (pz > 0) {
        pz *= cLength / cRadius;
        const taper = 1.0 - (pz / cLength) * 0.42;
        px *= taper;
        py *= taper;
        // Botanical upward curl
        py += Math.pow(pz / cLength, 2) * (0.00055 * overallScale);
      }
      pos.setXYZ(j, px, py, pz);
    }
    calyx.computeVertexNormals();

    const m = new T.Matrix4();
    const posVec = new T.Vector3(
      Math.cos(angle) * dist,
      y + rand(-0.0002, 0.0002) * overallScale,
      Math.sin(angle) * dist
    );

    // Orient calyx outward and upward
    const tiltUp = rand(0.40, 0.78) + (1 - t) * 0.25;
    const rotY = -angle + Math.PI * 0.5;
    const rotZ = rand(-0.30, 0.30);
    
    const euler = new T.Euler(tiltUp, rotY, rotZ, 'YXZ');
    m.makeRotationFromEuler(euler);
    m.setPosition(posVec);
    calyx.applyMatrix4(m);

    parts.push(calyx);
    partTypes.push({count: calyx.attributes.position.count, type: 0});
  }

  // 3. Pointed sugar leaf tips (16 leaflets breaking silhouette)
  const numLeaves = options.leafCount || 16;
  for (let i = 0; i < numLeaves; i++) {
    const t = rand(0.08, 0.82);
    const y = (0.0006 + t * 0.0052) * overallScale;
    const angle = i * (Math.PI * 2 / numLeaves) + rand(-0.35, 0.35);
    const dist = (0.0018 + Math.sin(t * Math.PI) * 0.0010) * overallScale * rand(0.92, 1.25);

    const leafLength = rand(0.0020, 0.0032) * overallScale;
    const leafWidth = leafLength * rand(0.35, 0.45);
    const leafGeo = new T.ConeGeometry(leafWidth, leafLength, 4, 3);
    leafGeo.rotateX(Math.PI * 0.5);
    leafGeo.scale(1.0, 0.20, 1.0); // thin flat leaflet
    
    // Natural curl
    const lPos = leafGeo.attributes.position;
    for (let j = 0; j < lPos.count; j++) {
      let z = lPos.getZ(j);
      let py = lPos.getY(j);
      if (z > 0) {
        py -= Math.pow(z / leafLength, 2) * (0.00065 * overallScale);
        lPos.setY(j, py);
      }
    }
    leafGeo.computeVertexNormals();

    const m = new T.Matrix4();
    const posVec = new T.Vector3(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
    const tilt = rand(0.38, 0.88);
    const euler = new T.Euler(tilt, -angle + Math.PI * 0.5, rand(-0.3, 0.3), 'YXZ');
    m.makeRotationFromEuler(euler);
    m.setPosition(posVec);
    leafGeo.applyMatrix4(m);

    parts.push(leafGeo);
    partTypes.push({count: leafGeo.attributes.position.count, type: 1});
  }

  // 4. Winding pistil hairs (24 curled stigmas in burnt orange/copper)
  const numPistils = options.pistilCount || 24;
  for (let i = 0; i < numPistils; i++) {
    const t = rand(0.12, 0.90);
    const angle = i * 1.85 + rand(-0.3, 0.3);
    const r = (0.0015 + Math.sin(t * Math.PI * 0.82) * 0.0014) * overallScale;
    const startX = Math.cos(angle) * r * 0.90;
    const startY = (0.0007 + t * 0.0055) * overallScale;
    const startZ = Math.sin(angle) * r * 0.90;

    const p0 = new T.Vector3(startX, startY, startZ);
    const dir = new T.Vector3(Math.cos(angle), rand(0.3, 0.7), Math.sin(angle)).normalize();
    const p1 = p0.clone().addScaledVector(dir, rand(0.0009, 0.0014) * overallScale);
    
    // Tangent winding curl
    const curlDir = new T.Vector3(
      -Math.sin(angle) * rand(-1.2, 1.2),
      rand(-0.3, 0.5),
      Math.cos(angle) * rand(-1.2, 1.2)
    ).normalize();
    const p2 = p1.clone().addScaledVector(curlDir, rand(0.0010, 0.0016) * overallScale);
    const p3 = p2.clone().add(new T.Vector3(
      rand(-0.0006, 0.0006),
      rand(-0.0008, 0.0002),
      rand(-0.0006, 0.0006)
    ).multiplyScalar(overallScale));

    const curve = new T.CatmullRomCurve3([p0, p1, p2, p3]);
    const tubeGeo = new T.TubeGeometry(curve, 6, 0.00010 * overallScale, 4, false);

    parts.push(tubeGeo);
    partTypes.push({count: tubeGeo.attributes.position.count, type: 2});
  }

  // Merge components
  const merged = mergeGeometries(parts, false);

  // Apply botanical vertex colors & organic surface noise
  const posAttr = merged.attributes.position;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);

  let partIdx = 0;
  let nextThreshold = partTypes[0].count;

  for (let i = 0; i < count; i++) {
    if (i >= nextThreshold && partIdx < partTypes.length - 1) {
      partIdx++;
      nextThreshold += partTypes[partIdx].count;
    }
    const pType = partTypes[partIdx].type;

    let x = posAttr.getX(i);
    let y = posAttr.getY(i);
    let z = posAttr.getZ(i);

    // Multi-frequency procedural noise
    const nMacro = Math.sin(x * 1400 + y * 950) * Math.cos(z * 1350 + x * 620);
    const nMeso = Math.sin(x * 4600 + z * 4800) * Math.cos(y * 5800);
    const nMicro = Math.sin(x * 14500 + y * 13800 + z * 14200);

    // Organic displacement: deform lobes for chunky irregular clustered silhouette
    if (pType !== 2) {
      const distFromAxis = Math.hypot(x, z);
      const disp = (nMacro * 0.00022 + nMeso * 0.00009 + nMicro * 0.000028) * overallScale;
      const nx = distFromAxis > 0.00001 ? x / distFromAxis : 0;
      const nz = distFromAxis > 0.00001 ? z / distFromAxis : 0;
      x += nx * disp;
      y += disp * 0.45;
      z += nz * disp;
      posAttr.setXYZ(i, x, y, z);
    }

    // Authentic botanical color computation
    const color = new T.Color();

    if (pType === 2) {
      // Pistil hair: rich saturated burnt orange, rust copper, fiery amber
      const hairGrad = (y / (0.0068 * overallScale)) + nMacro * 0.15;
      const hue = 0.052 + hairGrad * 0.020;
      const sat = 0.94 + nMeso * 0.06;
      const lum = 0.27 + Math.abs(nMicro) * 0.08;
      color.setHSL(hue, sat, lum);
    } else if (pType === 1) {
      // Sugar leaf: herbal olive green with cured golden-brown/amber tip
      const distFromCenter = Math.hypot(x, z);
      const isTip = distFromCenter > (0.0020 * overallScale);
      if (isTip) {
        color.setRGB(0.36 + nMacro * 0.04, 0.27 + nMeso * 0.03, 0.11 + nMicro * 0.02);
      } else {
        color.setRGB(0.16 + nMacro * 0.03, 0.24 + nMeso * 0.03, 0.10 + nMicro * 0.02);
      }
    } else {
      // Calyx bracts: rich natural cured weed palette
      const heightFrac = Math.min(1, Math.max(0, y / (0.0068 * overallScale)));
      const distFromAxis = Math.hypot(x, z);
      
      const isDeepCrevice = distFromAxis < (0.0011 * overallScale);
      const isCuredTip = (nMeso + nMacro * 0.6) > 0.44;
      const isTrichome = nMicro > 0.80 && distFromAxis > (0.0015 * overallScale);

      if (isTrichome) {
        // Tiny frosty trichome crystal highlight on micro ridges
        color.setRGB(0.55 + rand(-0.03, 0.03), 0.62 + rand(-0.03, 0.03), 0.46 + rand(-0.03, 0.03));
      } else if (isCuredTip) {
        // Cured amber / golden-brown dried bract margin
        color.setRGB(0.38 + nMacro * 0.04, 0.30 + nMeso * 0.03, 0.13 + nMicro * 0.02);
      } else if (isDeepCrevice) {
        // Dark forest green / shadow moss inside crevice
        color.setRGB(0.06 + nMacro * 0.02, 0.10 + nMeso * 0.02, 0.04 + nMicro * 0.01);
      } else {
        // Deep rich natural cured herbal olive green body
        const baseHue = 0.23 + nMacro * 0.025; // olive herbal green
        const baseSat = 0.52 + nMeso * 0.10;
        const baseLum = 0.12 + heightFrac * 0.05 + nMicro * 0.025;
        color.setHSL(baseHue, baseSat, baseLum);
      }
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  merged.setAttribute('color', new T.BufferAttribute(colors, 3));
  merged.computeVertexNormals();

  // Center vertically at middle of mass
  merged.translate(0, -0.0035 * overallScale, 0);

  return merged;
}

let cachedNormalMap = null;

export function createBudMaterial() {
  if (!cachedNormalMap) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, 512, 512);

    const img = ctx.createImageData(512, 512);
    const data = img.data;
    let seed = 9182;
    function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }

    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        const n1 = Math.sin(x * 0.35) * Math.cos(y * 0.35);
        const n2 = Math.sin(x * 0.80 + y * 0.55) * Math.cos(x * 0.55 - y * 0.80);
        const bead = (rnd() > 0.94) ? (rnd() * 0.6 + 0.4) : 0;
        
        const nx = Math.floor(128 + (n1 * 0.28 + n2 * 0.18 + (rnd() - 0.5) * bead * 0.75) * 85);
        const ny = Math.floor(128 + (n2 * 0.28 - n1 * 0.18 + (rnd() - 0.5) * bead * 0.75) * 85);
        const nz = 255;

        data[idx] = Math.max(0, Math.min(255, nx));
        data[idx + 1] = Math.max(0, Math.min(255, ny));
        data[idx + 2] = nz;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    const normalTex = new T.CanvasTexture(canvas);
    normalTex.wrapS = normalTex.wrapT = T.RepeatWrapping;
    normalTex.repeat.set(6, 6);
    cachedNormalMap = normalTex;
  }

  const mat = new T.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.86,
    metalness: 0.0,
    normalMap: cachedNormalMap,
    normalScale: new T.Vector2(0.45, 0.45),
    emissive: new T.Color('#000000')
  });

  return mat;
}

/**
 * Renders a crisp, transparent botanical bud sprite directly from the 3D bud model.
 */
export function renderBudSpriteDataUrl(renderer, size = 128) {
  const geo = createBudGeometry({seed: 777, scale: 0.75, calyxCount: 48, leafCount: 16, pistilCount: 26});
  const mat = createBudMaterial();
  const mesh = new T.Mesh(geo, mat);
  mesh.rotation.set(0.22, 0.48, -0.10);

  const offCanvas = document.createElement('canvas');
  offCanvas.width = size;
  offCanvas.height = size;

  const offRenderer = new T.WebGLRenderer({
    canvas: offCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true
  });
  offRenderer.setSize(size, size, false);
  offRenderer.setClearColor(0, 0);

  const scene = new T.Scene();
  const amb = new T.AmbientLight('#bacca8', 1.3);
  scene.add(amb);
  const sun = new T.DirectionalLight('#fff2db', 2.4);
  sun.position.set(1.5, 2.5, 2.0);
  scene.add(sun);
  const rim = new T.DirectionalLight('#92b888', 1.4);
  rim.position.set(-2.0, 1.2, -1.8);
  scene.add(rim);

  scene.add(mesh);

  const camera = new T.PerspectiveCamera(26, 1, 0.001, 1);
  camera.position.set(0, 0, 0.016);
  camera.lookAt(0, 0, 0);

  offRenderer.render(scene, camera);
  const dataUrl = offCanvas.toDataURL('image/png');

  offRenderer.dispose();
  geo.dispose();

  return dataUrl;
}
