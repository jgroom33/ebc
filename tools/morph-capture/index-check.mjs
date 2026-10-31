// Load index.html (and ?layout=1) and report console errors / page errors.  node index-check.mjs <root>
import { serve } from './serve.mjs';
import { chromium } from 'playwright';
const [root] = process.argv.slice(2);
const { url, close } = await serve(root);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const q of ['', '?layout=1']) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = [], warns = [];
  page.on('console', (m) => (m.type() === 'error' ? errs : m.type() === 'warning' ? warns : []).push(m.text()));
  page.on('pageerror', (e) => errs.push('pageerror: ' + e));
  page.on('requestfailed', (r) => errs.push('requestfailed: ' + r.url()));
  await page.goto(`${url}/index.html${q}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  const canvas = await page.evaluate(() => !!document.querySelector('canvas'));
  console.log(JSON.stringify({ page: `index.html${q}`, canvas, errors: errs, warnings: warns.slice(0, 5) }));
  await page.close();
}
await browser.close(); close();
