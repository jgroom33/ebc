// Phones: morph.html on iPhone 15 (393x852 @3x) and Pixel 8 (412x915 @2.625x), portrait and landscape.
// Checks the navs are hidden, snapshots t = 0, mid-morph, t = 1 and the orbit's two ends (sequence 31 s
// and 52 s), a tap pauses / resumes the loop, an orientation change refits, and memory over one loop.
//   node mobile-check.mjs <root> <outdir> [--loop]
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out, ...rest] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const PHONES = { 'iphone15': { w: 393, h: 852, dpr: 3 }, 'pixel8': { w: 412, h: 915, dpr: 2.625 } };
const SHOTS = [['t0', 0], ['mid', 15.2], ['t1', 27], ['orbit-left', 31], ['orbit-right', 52]];
const ui = (p) => p.evaluate(() => Object.fromEntries(['#tabs', '#bar', '#keys', '#back-link'].map((s) => [s, getComputedStyle(document.querySelector(s)).display])));
for (const [name, ph] of Object.entries(PHONES)) for (const orient of ['portrait', 'landscape']) {
  const [w, h] = orient === 'portrait' ? [ph.w, ph.h] : [ph.h, ph.w];
  const b = await openMorph(`${url}/morph.html?autoplay=0`, { capture: false, raw: true, width: w, height: h,
    device: { deviceScaleFactor: ph.dpr, isMobile: true, hasTouch: true } });
  const info = await b.page.evaluate(() => ({ mobile: MORPH.isMobile(), canvas: [MORPH.renderer.domElement.width, MORPH.renderer.domElement.height], aspect: +MORPH.camera.aspect.toFixed(3) }));
  for (const [tag, sec] of SHOTS) {
    const data = await b.page.evaluate((s) => MORPH.snapAt(s), sec);
    fs.writeFileSync(`${out}/${name}-${orient}-${tag}.png`, Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log(name, orient, JSON.stringify({ ...info, ui: await ui(b.page), errors: b.errors }));
  await b.close();
}
// tap toggles the loop; rotating the phone refits
{
  const ph = PHONES.iphone15;
  const b = await openMorph(`${url}/morph.html`, { capture: false, raw: true, width: ph.w, height: ph.h, device: { deviceScaleFactor: ph.dpr, isMobile: true, hasTouch: true } });
  const playing = () => b.page.evaluate(() => MORPH.state.seqStart !== null);
  const r = { start: await playing() };
  await b.page.touchscreen.tap(196, 400); await b.page.waitForTimeout(500); r.afterTap1 = await playing();
  await b.page.touchscreen.tap(196, 400); await b.page.waitForTimeout(500); r.afterTap2 = await playing();
  await b.page.setViewportSize({ width: ph.h, height: ph.w }); await b.page.waitForTimeout(800);
  r.landscape = await b.page.evaluate(() => ({ aspect: +MORPH.camera.aspect.toFixed(3), canvas: [MORPH.renderer.domElement.width, MORPH.renderer.domElement.height], mobile: MORPH.isMobile(), playing: MORPH.state.seqStart !== null }));
  await b.page.screenshot({ path: `${out}/iphone15-rotated-live.png` });
  console.log('tap / rotate', JSON.stringify(r), 'errors', JSON.stringify(b.errors));
  if (rest.includes('--loop')) { // memory over one loop (plus a little), live autoplay
    await b.page.setViewportSize({ width: ph.w, height: ph.h });
    const len = await b.page.evaluate(() => MORPH.SEQ_LEN), until = Date.now() + (len + 8) * 1000;
    while (Date.now() < until) {
      await b.page.waitForTimeout(12000);
      console.log('loop', JSON.stringify({ ...(await b.page.evaluate(() => ({ sec: +MORPH.state.seqSec.toFixed(1), loops: MORPH.state.loops || 0, ...MORPH.info() }))), chrome: b.rss() }));
    }
    console.log('loop errors', JSON.stringify(b.errors));
  }
  await b.close();
}
close();
