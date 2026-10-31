// Stills of a view at given t values (capture camera): node scrubframes.mjs <root> <outdir> <view> <t>...
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out, view, ...ts] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const b = await openMorph(url);
for (const t of ts.map(Number)) {
  await b.page.evaluate(({ t, s }) => MORPH.still({ t, s, cam: 'path' }), { t, s: view === 'wsrls' ? 1 : 0 });
  const f = `${out}/${view}-t${t.toFixed(2).replace('.', '_')}.png`;
  await b.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}
console.log('wrote', ts.length, view, 'frames');
await b.close(); close();
