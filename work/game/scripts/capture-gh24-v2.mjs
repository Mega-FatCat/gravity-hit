// Quick GH-24 canopy capture - takes screenshots from multiple angles
import puppeteer from 'puppeteer';
import { createServer } from 'vite';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'qa', 'gh24-canopy-v2');
await mkdir(outDir, { recursive: true });

const server = await createServer({ root: join(__dirname, '..'), server: { port: 5199, strictPort: true } });
await server.listen();

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });

await page.goto('http://localhost:5199/', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 6000)); // Wait for assets to load

const views = [
  { name: 'canopy-up', yaw: 0, pitch: -1.2, desc: 'Looking up through canopy' },
  { name: 'against-sky', yaw: 0.4, pitch: -0.7, desc: 'Canopy silhouette against sky' },
  { name: 'mid-distance', yaw: 0.8, pitch: -0.15, desc: 'Mid-distance tree view' },
  { name: 'side-view', yaw: 1.8, pitch: -0.2, desc: 'Side view of trees' },
  { name: 'close-tree', yaw: -0.5, pitch: -0.4, desc: 'Close tree with branches visible' },
  { name: 'forest-depth', yaw: 3.0, pitch: -0.1, desc: 'Forest depth and layering' },
];

for (const view of views) {
  try {
    await page.evaluate((v) => {
      if (window.__world) {
        window.__world.yaw = v.yaw;
        window.__world.pitch = v.pitch;
      }
    }, view);
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: join(outDir, `${view.name}.png`) });
    console.log(`✓ ${view.name}: ${view.desc}`);
  } catch (e) {
    console.error(`✗ ${view.name}: ${e.message}`);
  }
}

// Check for any console errors
const errors = await page.evaluate(() => window.__errors || []);
console.log(`\nPage errors: ${errors.length}`);

await browser.close();
await server.close();
console.log(`\nScreenshots saved to: ${outDir}`);
