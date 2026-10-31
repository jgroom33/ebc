// Is the morph's room (t=0) index.html?layout=9? Compares lab data, and every sign / device panel
// rectangle (world x, y, w, h on the front plane) built by each page.
import { serve } from './serve.mjs';
import { chromium } from 'playwright';
const [root] = process.argv.slice(2);
const { url, close } = await serve(root);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const r4 = (v) => Math.round(v * 1000) / 1000;
async function grab(path, ready, fn) {
  const p = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(`${url}/${path}`, { waitUntil: 'networkidle' });
  await p.waitForFunction(ready, null, { timeout: 90000 });
  const out = await p.evaluate(fn); await p.close(); return { ...out, errs };
}
// planes with a canvas map = signs (zone signs and node signs); size from geometry params
const collect = (rootName, sceneExpr) => `(() => {
  const root = ${sceneExpr}.getObjectByName('${rootName}'), v = new (${sceneExpr}.constructor === Object ? Object : window.__T.Vector3)();
  const out = [];
  root.traverse((o) => {
    const g = o.geometry?.parameters, img = o.material?.map?.image;
    if (o.isMesh && g && g.width && g.height && !g.depth && img && img.getContext) {
      o.updateWorldMatrix(true, false); const p = new window.__T.Vector3().setFromMatrixPosition(o.matrixWorld);
      out.push([Math.round(p.x*1000)/1000, Math.round(p.y*1000)/1000, Math.round(g.width*1000)/1000, Math.round(g.height*1000)/1000, img.width + 'x' + img.height].join('|'));
    }
  });
  return out.sort();
})()`;
const idx = await grab('index.html?layout=9', () => window.EBC?.labDataFor, new Function(`window.__T = EBC.THREE; const i = EBC.RACK_LAYOUTS.findIndex((L) => L.id === 9);
  return { lab: EBC.labDataFor(i), signs: ${collect('Lab', 'EBC.scene')} };`));
const mor = await grab('morph.html?capture', () => window.MORPH, new Function(`window.__T = MORPH.THREE;
  return { lab: MORPH.model.lab, signs: ${collect('Signs', 'MORPH.scene')} };`));
const same = JSON.stringify(idx.lab) === JSON.stringify(mor.lab);
const zs = (s) => s.filter((x) => +x.split('|')[3] > 0.05), ns = (s) => s.filter((x) => +x.split('|')[3] <= 0.05);
const diff = (a, b) => a.filter((x) => !b.includes(x));
console.log(JSON.stringify({ labDataIdentical: same,
  indexSigns: { zone: zs(idx.signs).length, node: ns(idx.signs).length }, morphSigns: { zone: zs(mor.signs).length, node: ns(mor.signs).length },
  onlyInIndex: diff(idx.signs, mor.signs), onlyInMorph: diff(mor.signs, idx.signs), errors: [...idx.errs, ...mor.errs] }, null, 1));
await browser.close(); close();
