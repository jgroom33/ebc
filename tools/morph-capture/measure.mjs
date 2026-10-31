// Memory probe: render N frames of the morph sequence in ?capture mode and sample
// renderer.info.memory, performance.memory and Chrome's anon RSS every `every` frames.
//   node measure.mjs <root> <frames> [--shot] [--fps 30]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
const [root, framesArg, ...rest] = process.argv.slice(2);
const FRAMES = +framesArg || 300, SHOT = rest.includes('--shot'), LIVE = rest.includes('--live'), FPS = +(rest[rest.indexOf('--fps') + 1]) || 30;
const EVERY = 50;
const TAG = `morph-probe-${process.pid}`;
let TOP = 0;
const rssOf = () => { // sum RssAnon over every chrome process carrying our tag (MB)
  try {
    const top = TOP;
    const all = top ? execSync(`pstree -pT ${top} | grep -o '([0-9]*)' | tr -d '()'`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean) : [];
    let anon = 0, rss = 0;
    for (const p of new Set(all)) {
      try { const s = fs.readFileSync(`/proc/${p}/status`, 'utf8'); anon += +(s.match(/RssAnon:\s+(\d+)/)?.[1] ?? 0); rss += +(s.match(/VmRSS:\s+(\d+)/)?.[1] ?? 0); } catch {}
    }
    return { procs: new Set(all).size, anonMB: Math.round(anon / 1024), rssMB: Math.round(rss / 1024) };
  } catch (e) { return { err: String(e) }; }
};
const { url, close } = await serve(root);
const server = await chromium.launchServer({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info', '--js-flags=--expose-gc', `--${TAG}`] });
TOP = server.process().pid;
const browser = await chromium.connect(server.wsEndpoint());
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(`${url}/morph.html${LIVE ? '' : '?capture'}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.MORPH, null, { timeout: 60000 });
const sample = async (i) => {
  const j = await page.evaluate(() => {
    const r = MORPH.renderer, m = performance.memory;
    return { geo: r.info.memory.geometries, tex: r.info.memory.textures, prog: r.info.programs.length, calls: r.info.render.calls, heapMB: Math.round(m.usedJSHeapSize / 1048576), totalHeapMB: Math.round(m.totalJSHeapSize / 1048576) };
  });
  console.log(JSON.stringify({ frame: i, ...j, ...rssOf() }));
};
await sample(0);
if (LIVE) await page.evaluate(() => { MORPH.setCam('path'); MORPH.startSequence(); });
const t0 = Date.now();
for (let i = 0; i < FRAMES; i++) {
  if (LIVE) await page.waitForTimeout(10); else await page.evaluate((sec) => MORPH.renderAt(sec), i / FPS);
  if (SHOT) await page.screenshot({ type: 'png', omitBackground: false, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  if ((i + 1) % EVERY === 0) await sample(i + 1);
}
console.log(`done ${FRAMES} frames in ${((Date.now() - t0) / 1000).toFixed(1)}s shot=${SHOT}`);
if (errors.length) console.log('console errors/warnings:', errors.slice(0, 10));
await browser.close(); await server.close(); close();
