// Per-second position of every moving device vs its rack slot, and of every node vs its base, over a
// stretch of the sequence (frames saved too): node landing-probe.mjs <root> <outdir> <from s> <to s>
// Writes <outdir>/positions.jsonl and prints, per second, t and the largest device offset from its slot.
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out, a, z] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const b = await openMorph(url);
const log = fs.createWriteStream(`${out}/positions.jsonl`);
for (let sec = +a; sec <= +z; sec++) {
  await b.page.evaluate((s) => MORPH.renderAt(s), sec);
  await b.page.screenshot({ path: `${out}/seq-${String(sec).padStart(2, '0')}s.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  const r = await b.page.evaluate(() => {
    const M = MORPH.morph, f3 = (v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3));
    const flyers = [...M.flyers.values()].map((f) => ({ name: f.name, node: f.node.n.id, k: +f.k.toFixed(3), pos: f3(f.mesh.position), rack: f3(f.from),
      offRack: +f.mesh.position.distanceTo(f.from).toFixed(3) }));
    return { t: +MORPH.state.t.toFixed(3), flyers };
  });
  log.write(JSON.stringify({ sec, ...r }) + '\n');
  console.log(sec, 't', r.t, 'devices', r.flyers.length, 'max offset from rack slot (m)', Math.max(...r.flyers.map((f) => f.offRack)), 'moving', r.flyers.filter((f) => f.k > 0.001).length);
}
log.end();
await b.close(); close();
