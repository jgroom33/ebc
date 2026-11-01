// Phones watch in landscape: held upright the page shows only the rotate panel (no frames rendered,
// loop paused); turned sideways it plays on from the same second; turned back it pauses again.
// Also: opened in landscape it just plays; a narrow non-touch desktop window still shows the scene.
//   node rotate-check.mjs <root> <outdir>
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const PHONES = { iphone15: { w: 393, h: 852, dpr: 3 }, pixel8: { w: 412, h: 915, dpr: 2.625 } };
const look = async (p) => {
  const a = await p.evaluate(() => ({ frames: MORPH.renderer.info.render.frame, sec: MORPH.state.seqSec, paused: MORPH.state.pausedSec }));
  await p.waitForTimeout(1500);
  return p.evaluate((a) => ({
    overlay: getComputedStyle(document.getElementById('rotate')).display, canvas: MORPH.renderer.domElement.style.visibility || 'visible',
    blocked: MORPH.rotateBlocked(), playing: MORPH.state.seqStart !== null, sec: +MORPH.state.seqSec.toFixed(2),
    pausedSec: +MORPH.state.pausedSec.toFixed(2), framesIn1500ms: MORPH.renderer.info.render.frame - a.frames,
  }), a);
};
const shot = (p, f) => p.screenshot({ path: f, timeout: 120000 });
for (const [name, ph] of Object.entries(PHONES)) {
  const dev = { deviceScaleFactor: ph.dpr, isMobile: true, hasTouch: true };
  const b = await openMorph(`${url}/morph.html`, { capture: false, raw: true, width: ph.w, height: ph.h, device: dev });
  const r = { portraitOpen: await look(b.page) };
  await shot(b.page, `${out}/${name}-1-portrait-overlay.png`);
  await b.page.setViewportSize({ width: ph.h, height: ph.w }); await b.page.waitForTimeout(500);
  r.landscape = await look(b.page);
  await b.page.waitForTimeout(4000);
  r.landscapeLater = await look(b.page);
  await shot(b.page, `${out}/${name}-2-landscape-playing.png`);
  await b.page.setViewportSize({ width: ph.w, height: ph.h }); await b.page.waitForTimeout(500);
  r.portraitAgain = await look(b.page);
  await shot(b.page, `${out}/${name}-3-portrait-overlay-again.png`);
  await b.page.setViewportSize({ width: ph.h, height: ph.w }); await b.page.waitForTimeout(500);
  r.landscapeAgain = await look(b.page);
  for (const [k, v] of Object.entries(r)) console.log(name.padEnd(9), k.padEnd(15), JSON.stringify(v));
  console.log(name.padEnd(9), 'errors', JSON.stringify(b.errors));
  await b.close();
  const c = await openMorph(`${url}/morph.html`, { capture: false, raw: true, width: ph.h, height: ph.w, device: dev });
  console.log(name.padEnd(9), 'openLandscape  ', JSON.stringify(await look(c.page)), 'errors', JSON.stringify(c.errors));
  await c.close();
}
const d = await openMorph(`${url}/morph.html`, { capture: false, raw: true, width: 500, height: 900 });
console.log('desktop 500x900 (no touch)', JSON.stringify({ ...(await look(d.page)), mobile: await d.page.evaluate(() => MORPH.isMobile()) }), 'errors', JSON.stringify(d.errors));
await shot(d.page, `${out}/desktop-narrow-500x900.png`);
await d.close();
close();
