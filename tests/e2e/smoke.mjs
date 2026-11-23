// Browser smoke test: builds are served with `vite preview`, then a phone and a desktop browser load the game,
// exercise core actions, and save screenshots to tests/e2e/out. Fails on any page error.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = playwright;

const PORT = 4179;
const BASE = `http://localhost:${PORT}/themims/`;
const OUT = new URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
await new Promise((res) => {
  server.stdout.on('data', (d) => d.toString().includes('localhost') && res());
  setTimeout(res, 5000);
});

const scenario = (await import('./scenario.mjs')).default;
let failed = false;
const browser = await chromium.launch();
try {
  for (const [name, opts] of [
    ['phone', { ...devices['iPhone 13'] }],
    ['desktop', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 }],
  ]) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto(BASE);
    await page.waitForFunction(() => !!window.game);
    await scenario(page, { name, out: OUT, touch: name === 'phone' });
    if (errors.length) {
      failed = true;
      console.error(`[${name}] errors:\n  ${errors.join('\n  ')}`);
    } else console.log(`[${name}] ok`);
    await ctx.close();
  }
} catch (e) {
  failed = true;
  console.error(e);
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
