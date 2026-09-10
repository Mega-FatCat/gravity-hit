import {_electron as electron} from 'playwright-core';
import path from 'node:path';
import {createCaptureSession} from './qa-capture.mjs';

const outDir = path.resolve(process.argv[2] || 'qa/critic-round2');
const app = await electron.launch({
  args: ['.', '--qa', '--benchmark'],
  executablePath: path.resolve('node_modules/electron/dist/electron.exe'),
  timeout: 90000
});
const page = await app.firstWindow(), errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

try {
  await page.waitForFunction(() => !!window.__game, {timeout: 180000});
  await page.waitForTimeout(2500);
  await page.evaluate(() => {
    window.__game.begin();
    window.__game.setState({
      phase: 'collect',
      mode: 'idle',
      held: null,
      supporting: null,
      picked: [],
      stock: 10,
      water: 0,
      cap: true,
      prep: 0,
      tutorial: false
    });
  });
  await page.waitForTimeout(2000);

  const session = await createCaptureSession({outDir, page, minTriangles: 1000, minCalls: 1});

  const capture = async (name, yaw, pitch) => {
    await session.capture(name, {
      setup: ({yaw, pitch}) => {
        window.__game.setView(yaw, pitch);
      },
      setupArgs: {yaw, pitch},
      view: {yaw, pitch},
      state: {phase: 'collect', mode: 'idle', held: null}
    });
    console.log('Captured verified: ' + name + '.png');
  };

  await capture('01-canopy-up', 0, 0.68);
  await capture('02-against-sky', 0.75, 0.38);
  await capture('03-mid-distance', -0.75, 0.05);
  await capture('04-trunk-bark', -0.32, -0.02);
  await capture('05-side-canopy', -1.35, 0.18);
  await capture('06-understory-shrubs', 0.85, -0.28);

  const manifest = await session.finalize({
    warning: 'Critic evaluation round 2 captures',
    errors,
    extraMeta: {
      scope: 'Pine canopy volume, hidden branches, 4K PBR bark, clean forest ground'
    }
  });
  console.log(JSON.stringify({outDir, summary: manifest.summary, errors}, null, 2));
} finally {
  await app.close();
}