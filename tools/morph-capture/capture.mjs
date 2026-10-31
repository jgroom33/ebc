// Batch-safe frame capture of morph.html's scripted sequence (?capture mode, 1920x1080).
//   node capture.mjs <root> <outdir> [--fps 30] [--batch 150] [--max-seconds 540] [--limit N]
// --limit N captures only the first N frames (a test run).
// Frames land as <outdir>/frame-NNNNN.png (written to a .tmp first, then renamed), so a rerun
// resumes from the frames already on disk. The browser is relaunched every `batch` frames, and
// Chrome's RSS and renderer.info are logged per batch to <outdir>/capture.log (JSON lines).
// The run stops cleanly once `max-seconds` of wall clock have passed (rerun to continue).
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? +rest[i + 1] : d; };
const FPS = opt('fps', 30), BATCH = Math.min(opt('batch', 150), 150), MAX_S = opt('max-seconds', 540), LIMIT = opt('limit', Infinity);
fs.mkdirSync(out, { recursive: true });
const log = (o) => { const line = JSON.stringify({ at: new Date().toISOString(), ...o }); console.log(line); fs.appendFileSync(`${out}/capture.log`, line + '\n'); };
const name = (i) => `${out}/frame-${String(i).padStart(5, '0')}.png`;
const { url, close } = await serve(root);
const t0 = Date.now();
let total = null, batchNo = 0;
while (true) {
  if (total !== null) { if (!missing(total).length) break; }
  if ((Date.now() - t0) / 1000 > MAX_S) { log({ event: 'paused', reason: 'max-seconds', done: total - missing(total).length, total }); break; }
  const b = await openMorph(url);
  if (total === null) { total = Math.min(LIMIT, Math.round(await b.page.evaluate(() => MORPH.SEQ_LEN) * FPS)); log({ event: 'plan', total, fps: FPS, batch: BATCH, seqLen: total / FPS }); }
  const todo = missing(total).slice(0, BATCH);
  if (!todo.length) { await b.close(); break; }
  batchNo++;
  const start = { info: await b.page.evaluate(() => MORPH.info()), chrome: b.rss() };
  log({ event: 'batch-start', batch: batchNo, first: todo[0], last: todo[todo.length - 1], ...start });
  const tb = Date.now();
  for (const i of todo) {
    await b.page.evaluate((sec) => MORPH.renderAt(sec), i / FPS);
    await b.page.screenshot({ path: `${name(i)}.tmp.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
    fs.renameSync(`${name(i)}.tmp.png`, name(i));
  }
  const end = { info: await b.page.evaluate(() => MORPH.info()), chrome: b.rss() };
  log({ event: 'batch-end', batch: batchNo, frames: todo.length, seconds: +((Date.now() - tb) / 1000).toFixed(1), ...end, errors: b.errors.slice(0, 5) });
  await b.close();
}
log({ event: missing(total).length ? 'incomplete' : 'complete', done: total - missing(total).length, total });
close();
function missing(n) { const m = []; for (let i = 0; i < n; i++) if (!fs.existsSync(name(i))) m.push(i); return m; }
