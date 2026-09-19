import * as T from 'three';
import { BottleSurface, clamp } from './liquid_core.mjs';

const radius = y => y < .151 ? .0320 : T.MathUtils.lerp(.0320, .0118, T.MathUtils.smoothstep(y, .151, .208));

function createDefaultSamples(count = 1600) {
  const samples = [];
  let seed = 881;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  while (samples.length < count) {
    const y = .006 + random() * .205;
    const x = (random() - .5) * .064;
    const z = (random() - .5) * .064;
    if (x * x + z * z < radius(y) ** 2) {
      samples.push([x, y, z]);
    }
  }
  return samples;
}

export class Liquid {
  constructor(bottle, scene, samples = null) {
    this.bottle = bottle;
    this.scene = scene;
    this.plane = new T.Plane(new T.Vector3(0, -1, 0), 0);
    this.inverse = new T.Matrix4();
    this.localWaterPlane = new T.Vector4(0, 1, 0, -.006);

    const initialSamples = samples && samples.length >= 8 ? samples : createDefaultSamples(1600);
    this.surfaceCore = new BottleSurface(initialSamples);

    const profile = [
      [0, .007], [.022, .007], [.025, .003], [.028, .005], [.0305, .011], [.0318, .023], [.0320, .036], [.0318, .058],
      [.0318, .120], [.0320, .145], [.029, .165], [.024, .185], [.018, .195], [.012, .205], [.0115, .218], [0, .218]
    ].map(v => new T.Vector2(...v));

    const material = new T.MeshPhysicalMaterial({
      color: '#98ddd5',
      roughness: .02,
      transmission: .85,
      thickness: .052,
      ior: 1.333,
      transparent: true,
      opacity: .78,
      depthWrite: false,
      side: T.DoubleSide,
      clippingPlanes: [this.plane],
      envMapIntensity: 1.15
    });

    this.volume = new T.Mesh(new T.LatheGeometry(profile, 64), material);
    this.volume.renderOrder = 1;
    this.volume.name = 'liquid-volume';
    bottle.add(this.volume);

    const surfaceMat = new T.MeshPhysicalMaterial({
      color: '#c4f0e8',
      roughness: .015,
      metalness: .0,
      transparent: true,
      opacity: .75,
      depthWrite: false,
      side: T.DoubleSide,
      envMapIntensity: 1.35,
      clearcoat: 1.0,
      clearcoatRoughness: .02
    });

    this.surfaceUniforms = {
      uBottleInverse: { value: this.inverse },
      uTime: { value: 0 },
      uSlosh: { value: 0 },
      uSurfaceNormal: { value: new T.Vector3(0, 1, 0) }
    };

    surfaceMat.onBeforeCompile = shader => {
      shader.uniforms.uBottleInverse = this.surfaceUniforms.uBottleInverse;
      shader.uniforms.uTime = this.surfaceUniforms.uTime;
      shader.uniforms.uSlosh = this.surfaceUniforms.uSlosh;
      shader.uniforms.uSurfaceNormal = this.surfaceUniforms.uSurfaceNormal;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uSlosh;
        varying vec3 vLiquidWorld;
        ${shader.vertexShader}
      `;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float ripple = sin(position.x * 135.0 + uTime * 14.0) * cos(position.y * 135.0 + uTime * 11.0) * (uSlosh * 0.00065 + 0.00008);
        transformed.z += ripple;
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvLiquidWorld=(modelMatrix*vec4(transformed,1.)).xyz;'
      );

      shader.fragmentShader = `
        uniform mat4 uBottleInverse;
        uniform float uTime;
        uniform float uSlosh;
        varying vec3 vLiquidWorld;
        ${shader.fragmentShader}
      `;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        vec3 localLiquid=(uBottleInverse*vec4(vLiquidWorld,1.)).xyz;
        float r=localLiquid.y<.151?.0320:mix(.0320,.0118,smoothstep(.151,.208,localLiquid.y));
        if(localLiquid.y<.005||localLiquid.y>.218||length(localLiquid.xz)>r)discard;
        float distNorm=length(localLiquid.xz)/max(.001,r);
        float meniscus=smoothstep(.78,.995,distNorm);
        float surfaceGrazing=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.2);
        diffuseColor.rgb=mix(vec3(.74,.91,.87),vec3(.93,.99,.98),meniscus);
        diffuseColor.a=mix(.22,.86,max(meniscus,surfaceGrazing*.75));`
      );
    };

    this.surface = new T.Mesh(new T.PlaneGeometry(.42, .42, 32, 32), surfaceMat);
    this.surface.renderOrder = 2;
    this.surface.name = 'liquid-surface';
    scene.add(this.surface);

    this.prevWorldPos = new T.Vector3();
    this.prevVel = new T.Vector3();
    this.filteredAx = 0;
    this.filteredAz = 0;
    this.hasHistory = false;
    this.lastTime = 0;
    this.level = 0.05;
  }

  setSamples(samples) {
    if (samples && samples.length >= 8) {
      this.surfaceCore = new BottleSurface(samples);
    }
  }

  setCavityGeometry(geometry) {
    if (geometry) {
      this.volume.geometry.dispose();
      this.volume.geometry = geometry.clone();
    }
  }

  update(amount, time, flow = 0) {
    this.bottle.updateWorldMatrix(true, false);
    this.inverse.copy(this.bottle.matrixWorld).invert();
    const m = this.bottle.matrixWorld.elements;

    // A paused game keeps world time fixed. Do not advance the water's spring
    // solver with a fabricated 1 ms step on every paused render frame.
    const dt = this.lastTime > 0 ? clamp(time - this.lastTime, 0, 0.05) : 0.016;
    this.lastTime = time;

    const curX = m[12], curY = m[13], curZ = m[14];

    if (this.hasHistory && dt > 0) {
      const vx = (curX - this.prevWorldPos.x) / dt;
      const vy = (curY - this.prevWorldPos.y) / dt;
      const vz = (curZ - this.prevWorldPos.z) / dt;

      const rawAx = (vx - this.prevVel.x) / dt;
      const rawAz = (vz - this.prevVel.z) / dt;

      // Filter pose-derived acceleration before it reaches the spring. Short
      // transform discontinuities must not read as impossible liquid forces.
      const alpha = Math.min(1.0, dt * 8.0);
      this.filteredAx += (rawAx - this.filteredAx) * alpha;
      this.filteredAz += (rawAz - this.filteredAz) * alpha;

      this.prevVel.set(vx, vy, vz);
    } else {
      this.prevVel.set(0, 0, 0);
      this.filteredAx = 0;
      this.filteredAz = 0;
      this.hasHistory = true;
    }
    this.prevWorldPos.set(curX, curY, curZ);

    this.surfaceCore.update(dt, amount, m, this.filteredAx, this.filteredAz);

    const normal = this.surfaceCore.normal;
    const nx = normal[0], ny = normal[1], nz = normal[2];
    const offset = this.surfaceCore.offset;

    this.plane.normal.set(-nx, -ny, -nz);
    this.plane.constant = offset;

    const surfaceY = this.surfaceCore.heightAt(curX, curZ);
    this.surface.position.set(curX, surfaceY, curZ);
    this.surface.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), new T.Vector3(nx, ny, nz));

    this.level = surfaceY;

    const lp = this.surfaceCore.localPlane;
    this.localWaterPlane.set(lp[0], lp[1], lp[2], lp[3]);

    this.surfaceUniforms.uTime.value = time;
    const sloshMag = Math.hypot(this.surfaceCore.sx, this.surfaceCore.sz) + flow * 4.5;
    this.surfaceUniforms.uSlosh.value = sloshMag;
    this.surfaceUniforms.uSurfaceNormal.value.set(nx, ny, nz);

    this.volume.visible = this.surface.visible = amount > 0.002;
  }
}
