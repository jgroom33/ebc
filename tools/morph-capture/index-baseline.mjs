// index.html: lab data (EBC.labDataFor) for every layout, and a structural dump of the built lab
// (every object: type, name, position, geometry size, texture canvas size) per layout.
//   node index-baseline.mjs <root> <outdir>
import { serve } from './serve.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs';
const [root, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errs = [];
const open = async (q) => {
  const p = await browser.newPage({ viewport: { width: 800, height: 450 } });
  p.on('console', (m) => { if (m.type() === 'error') errs.push(`${q}: ${m.text()}`); });
  p.on('pageerror', (e) => errs.push(`${q}: ${e}`));
  await p.goto(`${url}/index.html${q}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.EBC?.labDataFor, null, { timeout: 90000 });
  return p;
};
const p0 = await open('');
const data = await p0.evaluate(() => EBC.RACK_LAYOUTS.map((L, i) => ({ i, id: L.id ?? i, name: L.name, lab: EBC.labDataFor(i) })));
fs.writeFileSync(`${out}/labdata.json`, JSON.stringify(data, null, 1));
await p0.close();
for (const d of data) {
  const p = await open(d.id ? `?layout=${d.id}` : '');
  const dump = await p.evaluate(() => {
    const lab = EBC.scene.getObjectByName('Lab'), r = (v) => Math.round(v * 1e4) / 1e4, rows = [];
    lab.traverse((o) => {
      const g = o.geometry?.parameters, img = o.material?.map?.image;
      rows.push([o.type, o.name, r(o.position.x), r(o.position.y), r(o.position.z),
        g ? Object.values(g).map((v) => (typeof v === 'number' ? r(v) : '')).join(',') : '',
        img ? `${img.width}x${img.height}` : '', o.visible ? 1 : 0].join('|'));
    });
    return rows;
  });
  fs.writeFileSync(`${out}/lab-layout${d.id}.txt`, dump.join('\n') + '\n');
  await p.close();
}
console.log(JSON.stringify({ layouts: data.map((d) => `${d.id}:${d.name}`), errors: errs }));
await browser.close(); close();
