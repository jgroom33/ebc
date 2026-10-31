// Stills at given t values with a focus (all, 6500, rls, els; capture camera):
//   node scrubframes.mjs <root> <outdir> <focus> <t>...
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out, focus, ...ts] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const b = await openMorph(url);
for (const t of ts.map(Number)) {
  await b.page.evaluate(({ t, focus }) => MORPH.still({ t, focus, cam: 'path' }), { t, focus });
  const f = `${out}/${focus}-t${t.toFixed(2).replace('.', '_')}.png`;
  await b.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}
console.log('wrote', ts.length, focus, 'frames');
await b.close(); close();
