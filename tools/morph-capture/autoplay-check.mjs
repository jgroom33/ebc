// Autoplay check: morph.html opens on the capture camera playing the sequence on a loop; it loops (two
// passes, with Chrome RSS and renderer.info logged), interactions pause it, Loop / P resume it;
// ?autoplay=0 and ?capture open paused; a recording is one pass.   node autoplay-check.mjs <root> [loops]
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
const [root, loopsArg] = process.argv.slice(2);
const LOOPS = +loopsArg || 2;
const { url, close } = await serve(root);
const st = (p) => p.evaluate(() => ({ playing: MORPH.state.seqStart !== null, looping: MORPH.state.looping, cam: MORPH.state.cam,
  sec: +MORPH.state.seqSec.toFixed(1), loops: MORPH.state.loops || 0, t: +MORPH.state.t.toFixed(3), paused: +MORPH.state.pausedSec.toFixed(1),
  seqBtn: document.getElementById('seq').textContent, camBtn: document.getElementById('cam').textContent, ...MORPH.info() }));
const b = await openMorph(`${url}/morph.html`, { capture: false, raw: true, width: 1280, height: 720 });
console.log('open', JSON.stringify({ ...(await st(b.page)), chrome: b.rss() }));
const len = await b.page.evaluate(() => MORPH.SEQ_LEN);
const until = Date.now() + (LOOPS * len + 6) * 1000;
while (Date.now() < until) {
  await b.page.waitForTimeout(12000);
  console.log('run', JSON.stringify({ ...(await st(b.page)), chrome: b.rss() }));
}
const step = async (what, fn) => { await fn(); await b.page.waitForTimeout(800); console.log(what.padEnd(22), JSON.stringify(await st(b.page))); };
await step('tab RLS click', () => b.page.click('#tabs button[data-focus="rls"]'));
await step('P (resume)', () => b.page.keyboard.press('p'));
await step('drag on scene', async () => { await b.page.mouse.move(640, 360); await b.page.mouse.down(); await b.page.mouse.move(700, 380); await b.page.mouse.up(); });
await step('Loop button (resume)', () => b.page.click('#seq'));
await step('slider input', () => b.page.$eval('#t', (el) => { el.value = '0.5'; el.dispatchEvent(new Event('input')); }));
await step('Loop button (resume)', () => b.page.click('#seq'));
await step('ArrowRight key', () => b.page.keyboard.press('ArrowRight'));
await step('Loop button (resume)', () => b.page.click('#seq'));
await step('Morph button', () => b.page.click('#play'));
console.log('errors', JSON.stringify(b.errors));
await b.close();
for (const q of ['?autoplay=0', '?capture']) {
  const c = await openMorph(`${url}/morph.html${q}`, { capture: false, raw: true, width: 1280, height: 720 });
  await c.page.waitForTimeout(3000);
  console.log(q.padEnd(22), JSON.stringify(await st(c.page)), 'errors', JSON.stringify(c.errors));
  await c.close();
}
const r = await openMorph(`${url}/morph.html`, { capture: false, raw: true, width: 1280, height: 720 });
const rec = await r.page.evaluate(async () => {
  const p = MORPH.record({ seconds: 4, download: false });
  const during = { looping: MORPH.state.looping, sec: MORPH.state.seqSec };
  const blob = await p;
  return { during, after: { playing: MORPH.state.seqStart !== null, looping: MORPH.state.looping }, bytes: blob.size };
});
console.log('record 4 s'.padEnd(22), JSON.stringify(rec), 'errors', JSON.stringify(r.errors));
await r.close(); close();
