// How much of a portrait phone's height the network fills: snapshots without the HUD at given sequence
// seconds, then the rows that are not background.   node portrait-measure.mjs <root> <outdir> [sec ...]
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const [root, out, ...secs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const PHONES = { iphone15: { w: 393, h: 852, dpr: 3 }, pixel8: { w: 412, h: 915, dpr: 2.625 } };
for (const [name, ph] of Object.entries(PHONES)) {
  const b = await openMorph(`${url}/morph.html?autoplay=0`, { capture: false, raw: true, width: ph.w, height: ph.h, device: { deviceScaleFactor: ph.dpr, isMobile: true, hasTouch: true } });
  if (process.env.P_SPREAD || process.env.P_PITCH || process.env.P_FOV) await b.page.evaluate(({ sp, pi, fv }) => {
    if (sp) MORPH.PORTRAIT_FIT.spread = sp; if (pi) MORPH.PORTRAIT_FIT.pitch = pi; if (fv) MORPH.PORTRAIT_FIT.fov = fv;
  }, { sp: +process.env.P_SPREAD || 0, pi: +process.env.P_PITCH || 0, fv: +process.env.P_FOV || 0 }); // try other settings
  for (const sec of (secs.length ? secs : ['27', '31', '52']).map(Number)) {
    const f = `${out}/${name}-portrait-nohud-${sec}s.png`;
    fs.writeFileSync(f, Buffer.from((await b.page.evaluate((s) => MORPH.snapAt(s, { hud: false }), sec)).split(',')[1], 'base64'));
    const r = JSON.parse(execFileSync('python3', ['-c', `
import sys, json
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); W, H = im.size; px = im.load()
bg = (11, 15, 20)
rows = [y for y in range(H) if any(max(abs(a - b) for a, b in zip(px[x, y], bg)) > 18 for x in range(0, W, 2))]
cols = [x for x in range(W) if any(max(abs(a - b) for a, b in zip(px[x, y], bg)) > 18 for y in range(0, H, 2))]
print(json.dumps({'top': rows[0] / H, 'bottom': rows[-1] / H, 'height': (rows[-1] - rows[0]) / H, 'left': cols[0] / W, 'right': cols[-1] / W}))
`, f], { encoding: 'utf8' }));
    console.log(name, `${sec}s`, JSON.stringify(Object.fromEntries(Object.entries(r).map(([k, v]) => [k, +v.toFixed(3)]))));
  }
  await b.close();
}
close();
