// Stills: ws6500 and wsrls at t = 0, 0.5, 1 (1920x1080, capture mode, no UI).
//   node stills.mjs <root> <outdir>
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const b = await openMorph(url);
for (const view of ['ws6500', 'wsrls']) for (const t of [0, 0.5, 1]) {
  await b.page.evaluate(({ t, s }) => MORPH.still({ t, s }), { t, s: view === 'wsrls' ? 1 : 0 });
  const f = `${out}/${view}-t${t.toFixed(1).replace('.', '_')}.png`;
  await b.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log('wrote', f);
}
console.log('renderer', JSON.stringify(await b.page.evaluate(() => MORPH.info())), 'chrome', JSON.stringify(b.rss()));
if (b.errors.length) console.log('console errors:', b.errors);
await b.close(); close();
