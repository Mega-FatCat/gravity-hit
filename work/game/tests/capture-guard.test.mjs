import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  RenderValidityError,
  validateRenderStats,
  assertRenderValid,
  getSourceIdentifier,
  CaptureSession,
  verifyCaptureSet
} from '../scripts/qa-capture.mjs';

test('validateRenderStats accepts valid WebGL render metrics', () => {
  const stats = {
    available: true,
    contextLost: false,
    rendererInfo: {
      renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11)',
      vendor: 'Google Inc. (NVIDIA)'
    },
    resolution: {
      width: 1440,
      height: 900,
      pixelRatio: 1.5,
      renderWidth: 2160,
      renderHeight: 1350
    },
    quality: 'medium',
    triangles: 7230538,
    drawCalls: 1327
  };

  const result = validateRenderStats(stats, {minTriangles: 1000, minCalls: 1});
  assert.equal(result.valid, true);
  assert.doesNotThrow(() => assertRenderValid(stats, {minTriangles: 1000, minCalls: 1}));
});

test('validateRenderStats rejects implausibly zero triangles', () => {
  const stats = {
    available: true,
    contextLost: false,
    rendererInfo: {renderer: 'ANGLE (NVIDIA)'},
    resolution: {width: 1440, height: 900, renderWidth: 1440, renderHeight: 900},
    quality: 'medium',
    triangles: 0, // Invalid!
    drawCalls: 120
  };

  const result = validateRenderStats(stats);
  assert.equal(result.valid, false);
  assert.match(result.reason, /implausibly zero or invalid triangle count: 0/i);

  assert.throws(() => assertRenderValid(stats), (err) => {
    assert.ok(err instanceof RenderValidityError);
    assert.match(err.message, /RENDER VALIDITY CHECK FAILED/);
    assert.equal(err.details.triangles, 0);
    return true;
  });
});

test('validateRenderStats rejects implausibly zero draw calls', () => {
  const stats = {
    available: true,
    contextLost: false,
    rendererInfo: {renderer: 'ANGLE (NVIDIA)'},
    resolution: {width: 1440, height: 900, renderWidth: 1440, renderHeight: 900},
    quality: 'medium',
    triangles: 50000,
    drawCalls: 0 // Invalid!
  };

  const result = validateRenderStats(stats);
  assert.equal(result.valid, false);
  assert.match(result.reason, /implausibly zero or invalid draw call count: 0/i);
});

test('validateRenderStats rejects null, empty or missing renderer', () => {
  for (const invalidRenderer of [null, undefined, '', 'disabled', 'null']) {
    const stats = {
      available: true,
      contextLost: false,
      rendererInfo: {renderer: invalidRenderer},
      resolution: {width: 1440, height: 900, renderWidth: 1440, renderHeight: 900},
      quality: 'medium',
      triangles: 50000,
      drawCalls: 10
    };

    const result = validateRenderStats(stats);
    assert.equal(result.valid, false);
    assert.match(result.reason, /Invalid or missing WebGL renderer/i);
  }
});

test('validateRenderStats rejects lost WebGL context', () => {
  const stats = {
    available: true,
    contextLost: true,
    rendererInfo: {renderer: 'ANGLE (NVIDIA)'},
    resolution: {width: 1440, height: 900, renderWidth: 1440, renderHeight: 900},
    quality: 'medium',
    triangles: 50000,
    drawCalls: 10
  };

  const result = validateRenderStats(stats);
  assert.equal(result.valid, false);
  assert.match(result.reason, /WebGL context is lost/i);
});

test('validateRenderStats rejects invalid resolution dimensions', () => {
  const stats = {
    available: true,
    contextLost: false,
    rendererInfo: {renderer: 'ANGLE (NVIDIA)'},
    resolution: {width: 0, height: 0, renderWidth: 0, renderHeight: 0},
    quality: 'medium',
    triangles: 50000,
    drawCalls: 10
  };

  const result = validateRenderStats(stats);
  assert.equal(result.valid, false);
  assert.match(result.reason, /Invalid render resolution/i);
});

test('getSourceIdentifier extracts repository or package information', () => {
  const source = getSourceIdentifier(path.resolve('.'));
  assert.ok(source.identifier);
  assert.ok(['git', 'package', 'fallback'].includes(source.type));
  if (source.type === 'git') {
    assert.equal(source.commit.length, 40);
    assert.equal(typeof source.dirty, 'boolean');
  }
});

test('CaptureSession completes normal capture and writes provenance', async () => {
  const tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gh-capture-test-'));
  const outDir = path.join(tmpBase, 'output');

  // Create a mock Playwright page
  const mockPage = {
    async evaluate(fn, arg) {
      if (typeof fn === 'function') {
        const fnStr = fn.toString();
        if (fnStr.includes('window.__game')) {
          return {
            available: true,
            contextLost: false,
            rendererInfo: {
              renderer: 'ANGLE (NVIDIA GeForce RTX 3070)',
              vendor: 'NVIDIA'
            },
            resolution: {
              width: 1280,
              height: 720,
              pixelRatio: 1.0,
              renderWidth: 1280,
              renderHeight: 720
            },
            quality: 'medium',
            triangles: 5000000,
            drawCalls: 350,
            frame: 42,
            assets: []
          };
        }
      }
      return {};
    },
    async waitForTimeout() {},
    async screenshot({path: dest}) {
      // Write a dummy PNG file (>0 bytes)
      await fs.promises.writeFile(dest, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
  };

  const session = new CaptureSession({
    outDir,
    page: mockPage,
    minTriangles: 1000,
    minCalls: 1
  });

  await session.init();
  await session.capture('shot-01');
  await session.capture('shot-02');
  const manifest = await session.finalize({warning: 'Unit test capture'});

  assert.equal(manifest.status, 'verified');
  assert.ok(manifest.provenance);
  assert.equal(manifest.provenance.quality, 'medium');
  assert.equal(manifest.provenance.triangles, 5000000);
  assert.equal(manifest.provenance.drawCalls, 350);
  assert.ok(manifest.provenance.renderer);
  assert.ok(manifest.provenance.timestamp);
  assert.ok(manifest.provenance.resolution);

  assert.equal(fs.existsSync(path.join(outDir, 'shot-01.png')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'shot-02.png')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'capture.json')), true);

  // verifyCaptureSet passes
  const verification = await verifyCaptureSet(outDir);
  assert.equal(verification.verified, true);
  assert.equal(verification.count, 2);

  // Cleanup
  await fs.promises.rm(tmpBase, {recursive: true, force: true});
});

test('CaptureSession fails loudly on invalid render stats and prevents accepting PNGs', async () => {
  const tmpBase = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gh-capture-fail-'));
  const outDir = path.join(tmpBase, 'output');

  let callCount = 0;
  const mockPage = {
    async evaluate(fn) {
      callCount++;
      if (typeof fn === 'function' && fn.toString().includes('window.__game')) {
        if (callCount === 1) {
          // Initial provenance probe: looks okay
          return {
            available: true,
            contextLost: false,
            rendererInfo: {renderer: 'ANGLE (NVIDIA)'},
            resolution: {width: 1280, height: 720, renderWidth: 1280, renderHeight: 720},
            quality: 'medium',
            triangles: 5000000,
            drawCalls: 350
          };
        }
        // Frame capture probe: scene failed to render! triangles = 0!
        return {
          available: true,
          contextLost: false,
          rendererInfo: {renderer: 'ANGLE (NVIDIA)'},
          resolution: {width: 1280, height: 720, renderWidth: 1280, renderHeight: 720},
          quality: 'medium',
          triangles: 0, // FAILED RENDER!
          drawCalls: 0
        };
      }
      return {};
    },
    async waitForTimeout() {},
    async screenshot({path: dest}) {
      await fs.promises.writeFile(dest, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    }
  };

  const session = new CaptureSession({
    outDir,
    page: mockPage,
    minTriangles: 1000,
    minCalls: 1
  });

  await session.init();

  // Attempting to capture must FAIL LOUDLY
  await assert.rejects(async () => {
    await session.capture('shot-broken');
  }, (err) => {
    assert.ok(err instanceof RenderValidityError);
    assert.match(err.message, /RENDER VALIDITY CHECK FAILED/);
    assert.match(err.message, /implausibly zero or invalid triangle count/i);
    return true;
  });

  // Staging directory must have been cleaned up on abort!
  assert.equal(fs.existsSync(session.stagingDir), false);

  // The output directory must NOT have been created or populated!
  assert.equal(fs.existsSync(outDir), false);

  // Cleanup
  await fs.promises.rm(tmpBase, {recursive: true, force: true});
});

test('verifyCaptureSet rejects historical pass15 with zero triangles and null renderer', async () => {
  const pass15Dir = path.resolve('../qa/recovery/pass15');
  if (fs.existsSync(pass15Dir)) {
    await assert.rejects(async () => {
      await verifyCaptureSet(pass15Dir);
    }, (err) => {
      assert.ok(err instanceof RenderValidityError);
      return true;
    });
  }
});
