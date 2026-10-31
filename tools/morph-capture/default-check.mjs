// Open morph.html without ?capture (UI on) and report the default view: node default-check.mjs <root> <outdir>
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
const [root, out] = process.argv.slice(2);
const { url, close } = await serve(root);
for (const q of ['', '?view=ws6500']) {
  const b = await openMorph(url + (q ? '/morph.html' + q : '/morph.html'), { capture: false, raw: true });
  const r = await b.page.evaluate(() => ({ s: MORPH.state.s, sTarget: MORPH.state.sTarget, onTab: document.querySelector('#tabs button.on')?.dataset.view, firstTab: document.querySelector('#tabs button')?.dataset.view, seq0: MORPH.seqAt(0).s, seq45: MORPH.seqAt(45).s }));
  console.log(JSON.stringify({ url: 'morph.html' + q, ...r, errors: b.errors }));
  if (!q) await b.page.screenshot({ path: `${out}/ui-default.png` });
  await b.close();
}
close();
