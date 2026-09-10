import {_electron as electron} from 'playwright-core';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  RenderValidityError,
  createCaptureSession,
  verifyCaptureSet,
  extractRuntimeRenderStats,
  validateRenderStats,
  getSourceIdentifier
} from './qa-capture.mjs';

console.log('=== VERIFYING QA CAPTURE PIPELINE (GH-44) ===');

// 1. Check source / build identifier
const source = getSourceIdentifier();
console.log('1. Provenance Source Identifier:', JSON.stringify(source));
assert.ok(source.identifier, 'Source identifier must be non-empty');

// Launch Electron for live WebGL verification
console.log('2. Launching Electron runtime to test WebGL captures...');
const app = await electron.launch({
  args: ['.', '--qa'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});

const page = await app.firstWindow();
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

try {
  await page.waitForFunction(() => !!window.__game, null, {timeout: 180000});
  await page.click('#begin');
  await page.waitForTimeout(1000);

  // Probe live WebGL stats
  const liveStats = await extractRuntimeRenderStats(page);
  console.log('3. Live WebGL Render Stats:', {
    renderer: liveStats.rendererInfo?.renderer,
    resolution: liveStats.resolution,
    quality: liveStats.quality,
    triangles: liveStats.triangles,
    drawCalls: liveStats.drawCalls
  });

  assert.equal(liveStats.available, true);
  assert.equal(liveStats.contextLost, false);
  assert.ok(liveStats.rendererInfo.renderer, 'Renderer must not be null');
  assert.ok(liveStats.triangles > 100000, `Triangles must be > 100,000 for full scene, got ${liveStats.triangles}`);
  assert.ok(liveStats.drawCalls > 10, `Draw calls must be > 10 for full scene, got ${liveStats.drawCalls}`);

  // Test 1: Normal capture path
  console.log('\n--- TEST 1: Normal capture path ---');
  const normalOut = path.resolve('../qa/recovery/qa-guard-test-normal');
  await fs.rm(normalOut, {recursive: true, force: true});

  const normalSession = await createCaptureSession({
    outDir: normalOut,
    page,
    minTriangles: 1000,
    minCalls: 1
  });

  await normalSession.capture('test-forward', {
    setup: () => {
      window.__game.setView(0, -0.265);
      window.__game.setState({phase: 'collect', mode: 'idle', picked: []});
    }
  });

  await normalSession.capture('test-stream', {
    setup: () => {
      window.__game.setView(0.75, -0.2);
    }
  });

  const manifest = await normalSession.finalize({
    warning: 'GH-44 verification normal run',
    errors: pageErrors
  });

  console.log('Normal run finalized successfully. Manifest provenance:', manifest.provenance);
  assert.equal(manifest.status, 'verified');
  assert.ok(manifest.provenance.source, 'Must have source identifier');
  assert.ok(manifest.provenance.timestamp, 'Must have timestamp');
  assert.ok(manifest.provenance.renderer, 'Must have renderer');
  assert.ok(manifest.provenance.resolution, 'Must have resolution');
  assert.ok(manifest.provenance.quality, 'Must have quality preset');
  assert.ok(manifest.provenance.triangles > 0, 'Must have triangle count > 0');
  assert.ok(manifest.provenance.drawCalls > 0, 'Must have draw calls > 0');

  // Verify capture directory with verifyCaptureSet
  const verifiedResult = await verifyCaptureSet(normalOut);
  assert.equal(verifiedResult.verified, true);
  assert.equal(verifiedResult.count, 2);
  console.log('✓ Normal capture path verified: files written with full provenance and certified status.');

  // Clean up normal test output
  await fs.rm(normalOut, {recursive: true, force: true});

  // Test 2: Invalid / failure condition (Implausibly zero triangles / scene render failure)
  console.log('\n--- TEST 2: Invalid/failure condition ---');
  const invalidOut = path.resolve('../qa/recovery/qa-guard-test-invalid');
  await fs.rm(invalidOut, {recursive: true, force: true});

  const invalidSession = await createCaptureSession({
    outDir: invalidOut,
    page,
    minTriangles: 1000,
    minCalls: 1
  });

  let threwAsExpected = false;
  try {
    await invalidSession.capture('test-fail', {
      setup: () => {
        // Simulate WebGL scene render failure (e.g. triangles: 0, calls: 0, like pass15 incident)
        Object.defineProperty(window.__game.world.renderer.info.render, 'triangles', {
          get: () => 0,
          configurable: true
        });
        Object.defineProperty(window.__game.world.renderer.info.render, 'calls', {
          get: () => 0,
          configurable: true
        });
      }
    });
  } catch (err) {
    threwAsExpected = true;
    console.log('✓ Capture failed loudly as expected:', err.message);
    assert.ok(err instanceof RenderValidityError);
    assert.match(err.message, /RENDER VALIDITY CHECK FAILED/);
    assert.match(err.message, /implausibly zero or invalid triangle count/i);
  }

  assert.equal(threwAsExpected, true, 'Invalid capture MUST fail loudly by throwing an error');

  // Verify that an apparently successful set of PNG files CANNOT be accepted:
  // The output directory must NOT exist or have accepted screenshots!
  const invalidOutExists = await fs.stat(invalidOut).then(() => true).catch(() => false);
  assert.equal(invalidOutExists, false, 'Output directory MUST NOT be created or accepted on render failure!');

  // Staging directory must also have been cleaned up
  const stagingExists = await fs.stat(invalidSession.stagingDir).then(() => true).catch(() => false);
  assert.equal(stagingExists, false, 'Staging directory MUST be cleaned up on abort!');

  console.log('✓ Invalid/failure condition verified: failed loudly, zero PNGs accepted, staging cleaned up.');

  console.log('\n=== ALL GH-44 VERIFICATIONS PASSED ===');
} finally {
  await app.close();
}
