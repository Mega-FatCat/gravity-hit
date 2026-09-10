import {execSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Custom error thrown when render stats are implausibly zero or invalid.
 */
export class RenderValidityError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'RenderValidityError';
    this.details = details;
  }
}

/**
 * Extract source / build identifier from git or package.json.
 */
export function getSourceIdentifier(cwd = process.cwd()) {
  try {
    const gitHash = execSync('git rev-parse HEAD', {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
    if (gitHash) {
      let dirty = false;
      let branch = '';
      try {
        const status = execSync('git status --porcelain', {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
        dirty = status.length > 0;
      } catch {}
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim();
      } catch {}

      return {
        type: 'git',
        commit: gitHash,
        shortCommit: gitHash.slice(0, 8),
        dirty,
        branch,
        identifier: `${gitHash.slice(0, 8)}${dirty ? '-dirty' : ''}`
      };
    }
  } catch {}

  try {
    const pkgPath = path.resolve(cwd, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name && pkg.version) {
        return {
          type: 'package',
          name: pkg.name,
          version: pkg.version,
          identifier: `${pkg.name}@${pkg.version}`
        };
      }
    }
  } catch {}

  return {
    type: 'fallback',
    identifier: process.env.BUILD_ID || 'stillwater-local'
  };
}

/**
 * Evaluates the runtime render statistics directly from the browser / WebGL context.
 */
export async function extractRuntimeRenderStats(page) {
  return await page.evaluate(() => {
    const g = window.__game;
    if (!g || !g.world || !g.world.renderer) {
      return {
        available: false,
        error: 'window.__game or world.renderer is not available'
      };
    }

    const renderer = g.world.renderer;
    const gl = typeof renderer.getContext === 'function' ? renderer.getContext() : null;
    const ext = gl && typeof gl.getExtension === 'function' ? gl.getExtension('WEBGL_debug_renderer_info') : null;

    let unmaskedRenderer = null;
    let unmaskedVendor = null;
    let defaultRenderer = null;
    let defaultVendor = null;
    let webglVersion = null;
    let contextLost = true;

    if (gl) {
      try {
        contextLost = typeof gl.isContextLost === 'function' ? gl.isContextLost() : false;
        if (ext) {
          unmaskedRenderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
          unmaskedVendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        }
        defaultRenderer = gl.getParameter(gl.RENDERER);
        defaultVendor = gl.getParameter(gl.VENDOR);
        webglVersion = gl.getParameter(gl.VERSION);
      } catch (e) {
        contextLost = true;
      }
    }

    const renderInfo = renderer.info?.render || {};
    const triangles = renderInfo.triangles ?? 0;
    const calls = renderInfo.calls ?? 0;
    const frame = renderInfo.frame ?? 0;
    const lines = renderInfo.lines ?? 0;
    const points = renderInfo.points ?? 0;

    const dom = renderer.domElement;
    const renderWidth = dom?.width ?? 0;
    const renderHeight = dom?.height ?? 0;
    const clientWidth = dom?.clientWidth || innerWidth;
    const clientHeight = dom?.clientHeight || innerHeight;
    const pixelRatio = typeof renderer.getPixelRatio === 'function' ? renderer.getPixelRatio() : (window.devicePixelRatio || 1);

    const quality = g.settings?.quality || g.world?.quality || 'unknown';

    return {
      available: true,
      contextLost,
      rendererInfo: {
        renderer: unmaskedRenderer || defaultRenderer || null,
        vendor: unmaskedVendor || defaultVendor || null,
        version: webglVersion || null,
        unmaskedRenderer,
        unmaskedVendor
      },
      resolution: {
        width: clientWidth,
        height: clientHeight,
        pixelRatio,
        renderWidth,
        renderHeight
      },
      quality,
      triangles,
      drawCalls: calls,
      frame,
      lines,
      points,
      assets: g.world?.assetErrors || []
    };
  });
}

/**
 * Validate render stats to catch implausibly zero or invalid values.
 */
export function validateRenderStats(stats, options = {}) {
  const {
    minTriangles = 1,
    minCalls = 1
  } = options;

  if (!stats || !stats.available) {
    return {
      valid: false,
      reason: stats?.error || 'Render stats unavailable (WebGL scene not initialized)'
    };
  }

  if (stats.contextLost) {
    return {
      valid: false,
      reason: 'WebGL context is lost'
    };
  }

  const renderer = stats.rendererInfo?.renderer;
  if (!renderer || renderer === 'disabled' || renderer === 'null') {
    return {
      valid: false,
      reason: `Invalid or missing WebGL renderer: ${JSON.stringify(renderer)}`
    };
  }

  const res = stats.resolution;
  if (!res || res.renderWidth <= 0 || res.renderHeight <= 0) {
    return {
      valid: false,
      reason: `Invalid render resolution: ${res?.renderWidth}x${res?.renderHeight}`
    };
  }

  const triangles = stats.triangles;
  if (typeof triangles !== 'number' || !Number.isFinite(triangles) || triangles < minTriangles) {
    return {
      valid: false,
      reason: `Implausibly zero or invalid triangle count: ${triangles} (minimum required: ${minTriangles})`
    };
  }

  const calls = stats.drawCalls;
  if (typeof calls !== 'number' || !Number.isFinite(calls) || calls < minCalls) {
    return {
      valid: false,
      reason: `Implausibly zero or invalid draw call count: ${calls} (minimum required: ${minCalls})`
    };
  }

  return {valid: true};
}

/**
 * Assert that render stats are valid; throws RenderValidityError loudly if invalid.
 */
export function assertRenderValid(stats, options = {}) {
  const result = validateRenderStats(stats, options);
  if (!result.valid) {
    const details = {
      reason: result.reason,
      triangles: stats?.triangles,
      drawCalls: stats?.drawCalls,
      renderer: stats?.rendererInfo?.renderer,
      resolution: stats?.resolution,
      quality: stats?.quality,
      contextLost: stats?.contextLost
    };
    throw new RenderValidityError(
      `RENDER VALIDITY CHECK FAILED: ${result.reason} | Details: ${JSON.stringify(details)}`,
      details
    );
  }
}

/**
 * Manages an atomic, staged QA capture session.
 * Screenshots are only staged during capture. If any capture fails render validation,
 * the session aborts, staging is cleaned up, and no partial/invalid set of PNGs is accepted.
 */
export class CaptureSession {
  constructor({outDir, page, minTriangles = 100, minCalls = 1, buildId = null}) {
    this.outDir = path.resolve(outDir);
    this.stagingDir = path.resolve(path.dirname(this.outDir), `.${path.basename(this.outDir)}.staging-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    this.page = page;
    this.minTriangles = minTriangles;
    this.minCalls = minCalls;
    this.buildId = buildId;
    this.records = [];
    this.initialProvenance = null;
    this.started = false;
    this.finalized = false;
    this.aborted = false;
  }

  async init() {
    await fs.promises.mkdir(this.stagingDir, {recursive: true});
    this.started = true;
    const stats = await extractRuntimeRenderStats(this.page).catch(() => ({}));
    const source = this.buildId ? {type: 'explicit', identifier: this.buildId} : getSourceIdentifier();
    this.initialProvenance = {
      source: source.identifier,
      sourceDetails: source,
      timestamp: new Date().toISOString(),
      renderer: stats.rendererInfo?.renderer || null,
      rendererInfo: stats.rendererInfo || null,
      resolution: stats.resolution || null,
      quality: stats.quality || null,
      triangles: stats.triangles ?? null,
      drawCalls: stats.drawCalls ?? null
    };
    return this.initialProvenance;
  }

  async capture(name, {setup, setupArgs, state, view, minTriangles, minCalls} = {}) {
    if (this.aborted) {
      throw new RenderValidityError(`Cannot capture "${name}": session was already aborted due to failure`);
    }
    if (!this.started) {
      await this.init();
    }

    if (setup) {
      if (setupArgs !== undefined) {
        await this.page.evaluate(setup, setupArgs);
      } else {
        await this.page.evaluate(setup);
      }
    }

    // Allow frame rendering
    await this.page.waitForTimeout(100);
    await this.page.evaluate(() => {
      if (window.__game?.world?.render) {
        window.__game.world.render();
      }
    }).catch(() => {});

    // Probe render statistics
    const stats = await extractRuntimeRenderStats(this.page);

    // Validate render stats - FAIL LOUDLY on invalid stats
    try {
      assertRenderValid(stats, {
        minTriangles: minTriangles ?? this.minTriangles,
        minCalls: minCalls ?? this.minCalls
      });
    } catch (err) {
      await this.abort(err);
      throw err;
    }

    // Render stats are confirmed valid. Now capture the screenshot to staging directory.
    const screenshotPath = path.join(this.stagingDir, `${name}.png`);
    await this.page.screenshot({path: screenshotPath});

    const fileStat = await fs.promises.stat(screenshotPath);
    if (fileStat.size === 0) {
      const err = new RenderValidityError(`Screenshot file ${name}.png was written as 0 bytes`, {name});
      await this.abort(err);
      throw err;
    }

    const extra = await this.page.evaluate(() => {
      const g = window.__game;
      if (!g) return {};
      return {
        aimScreen: g.world?.aimScreen || null,
        held: g.sim?.held || null,
        supporting: g.sim?.supporting || null
      };
    }).catch(() => ({}));

    const record = {
      name,
      timestamp: new Date().toISOString(),
      fixture: true,
      state: state || {},
      view: view || null,
      metrics: {
        triangles: stats.triangles,
        calls: stats.drawCalls,
        renderer: stats.rendererInfo?.renderer,
        resolution: stats.resolution,
        quality: stats.quality,
        assets: stats.assets
      },
      target: extra.aimScreen,
      held: extra.held,
      supporting: extra.supporting,
      imageFile: `${name}.png`,
      fileSizeBytes: fileStat.size
    };

    this.records.push(record);
    return record;
  }

  async finalize({warning = 'Explicit visual fixtures, not gameplay proof', errors = [], extraMeta = {}} = {}) {
    if (this.aborted) {
      throw new RenderValidityError('Cannot finalize capture session: session was aborted due to render failure');
    }
    if (this.records.length === 0) {
      const err = new RenderValidityError('Cannot finalize capture session: 0 frames were captured');
      await this.abort(err);
      throw err;
    }

    const stats = await extractRuntimeRenderStats(this.page).catch(() => ({}));
    const source = this.buildId ? {type: 'explicit', identifier: this.buildId} : getSourceIdentifier();

    const summary = {
      totalCaptures: this.records.length,
      allValid: true,
      minTriangles: Math.min(...this.records.map(r => r.metrics?.triangles ?? 0)),
      maxTriangles: Math.max(...this.records.map(r => r.metrics?.triangles ?? 0)),
      minDrawCalls: Math.min(...this.records.map(r => r.metrics?.calls ?? 0)),
      maxDrawCalls: Math.max(...this.records.map(r => r.metrics?.calls ?? 0))
    };

    const manifest = {
      status: 'verified',
      warning,
      provenance: {
        source: source.identifier,
        sourceDetails: source,
        timestamp: new Date().toISOString(),
        renderer: stats.rendererInfo?.renderer || this.initialProvenance?.renderer || null,
        rendererInfo: stats.rendererInfo || this.initialProvenance?.rendererInfo || null,
        resolution: stats.resolution || this.initialProvenance?.resolution || null,
        quality: stats.quality || this.initialProvenance?.quality || null,
        triangles: summary.maxTriangles,
        drawCalls: summary.maxDrawCalls
      },
      summary,
      extra: extraMeta,
      records: this.records,
      errors: errors || []
    };

    const manifestPath = path.join(this.stagingDir, 'capture.json');
    await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Atomic promotion to outDir
    await fs.promises.mkdir(path.dirname(this.outDir), {recursive: true});

    // Remove existing target directory if any, then rename staging to outDir
    await fs.promises.rm(this.outDir, {recursive: true, force: true});
    await fs.promises.rename(this.stagingDir, this.outDir);

    this.finalized = true;
    return manifest;
  }

  async abort(error) {
    this.aborted = true;
    try {
      if (fs.existsSync(this.stagingDir)) {
        await fs.promises.rm(this.stagingDir, {recursive: true, force: true});
      }
    } catch (e) {
      console.error('Error cleaning up staging directory on abort:', e);
    }
  }
}

/**
 * Factory to create and initialize a CaptureSession.
 */
export async function createCaptureSession(options) {
  const session = new CaptureSession(options);
  await session.init();
  return session;
}

/**
 * Verifies that an existing QA capture directory has valid provenance, non-zero render stats,
 * and valid screenshot PNGs. Fails loudly if invalid.
 */
export async function verifyCaptureSet(dirPath, options = {}) {
  const resolved = path.resolve(dirPath);
  const manifestPath = path.join(resolved, 'capture.json');
  if (!fs.existsSync(manifestPath)) {
    throw new RenderValidityError(`Capture set rejected: no capture.json in ${resolved}`);
  }

  const manifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));

  if (manifest.status !== 'verified') {
    throw new RenderValidityError(`Capture set rejected: status is not "verified" in ${resolved} (got "${manifest.status}")`);
  }

  const prov = manifest.provenance;
  if (!prov) {
    throw new RenderValidityError(`Capture set rejected: missing provenance block in ${resolved}`);
  }

  if (!prov.renderer) {
    throw new RenderValidityError(`Capture set rejected: missing or null renderer in provenance in ${resolved}`);
  }
  if (!prov.resolution) {
    throw new RenderValidityError(`Capture set rejected: missing resolution in provenance in ${resolved}`);
  }
  if (!prov.quality) {
    throw new RenderValidityError(`Capture set rejected: missing quality preset in provenance in ${resolved}`);
  }
  if (!prov.timestamp) {
    throw new RenderValidityError(`Capture set rejected: missing timestamp in provenance in ${resolved}`);
  }

  if (!Array.isArray(manifest.records) || manifest.records.length === 0) {
    throw new RenderValidityError(`Capture set rejected: records array is missing or empty in ${resolved}`);
  }

  const {minTriangles = 1, minCalls = 1} = options;

  for (const record of manifest.records) {
    const triangles = record.metrics?.triangles ?? 0;
    const calls = record.metrics?.calls ?? 0;
    const renderer = record.metrics?.renderer;

    if (typeof triangles !== 'number' || triangles < minTriangles) {
      throw new RenderValidityError(
        `Capture set rejected: record "${record.name}" has implausibly zero or invalid triangles (${triangles}) in ${resolved}`,
        {record: record.name, triangles}
      );
    }

    if (typeof calls !== 'number' || calls < minCalls) {
      throw new RenderValidityError(
        `Capture set rejected: record "${record.name}" has implausibly zero or invalid draw calls (${calls}) in ${resolved}`,
        {record: record.name, calls}
      );
    }

    if (!renderer) {
      throw new RenderValidityError(
        `Capture set rejected: record "${record.name}" has null or missing renderer in ${resolved}`,
        {record: record.name}
      );
    }

    const pngPath = path.join(resolved, `${record.name}.png`);
    if (!fs.existsSync(pngPath)) {
      throw new RenderValidityError(`Capture set rejected: image file missing: ${pngPath}`);
    }
    const stat = await fs.promises.stat(pngPath);
    if (stat.size === 0) {
      throw new RenderValidityError(`Capture set rejected: image file is 0 bytes: ${pngPath}`);
    }
  }

  return {
    verified: true,
    count: manifest.records.length,
    provenance: prov,
    summary: manifest.summary
  };
}
