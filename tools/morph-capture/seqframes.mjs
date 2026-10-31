// Single frames of the scripted sequence at given seconds: node seqframes.mjs <root> <outdir> <sec>...
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out, ...secs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const b = await openMorph(url);
for (const sec of secs.map(Number)) {
  await b.page.evaluate((sec) => MORPH.renderAt(sec), sec);
  const f = `${out}/seq-${String(sec).padStart(2, '0')}s.png`;
  await b.page.screenshot({ path: f, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  console.log('wrote', f);
}
if (b.errors.length) console.log('console errors:', b.errors);
await b.close(); close();
