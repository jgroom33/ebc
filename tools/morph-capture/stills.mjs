// Stills (1920x1080, capture mode, no UI): the one network at t = 0, 0.5, 1, and each line system in
// focus at t = 1.
//   node stills.mjs <root> <outdir>
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const b = await openMorph(url);
const shots = [[0, 'all'], [0.5, 'all'], [1, 'all'], [1, '6500'], [1, 'rls'], [1, 'els']];
for (const [t, focus] of shots) {
  await b.page.evaluate(({ t, focus }) => MORPH.still({ t, focus }), { t, focus });
  const f = `${out}/${focus === 'all' ? `network-t${t.toFixed(1).replace('.', '_')}` : `focus-${focus}`}.png`;
  await b.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log('wrote', f);
}
console.log('renderer', JSON.stringify(await b.page.evaluate(() => MORPH.info())), 'chrome', JSON.stringify(b.rss()));
if (b.errors.length) console.log('console errors:', b.errors);
await b.close(); close();
