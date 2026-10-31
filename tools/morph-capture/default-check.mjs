// Open morph.html without ?capture (UI on) and report the focus it opens with: node default-check.mjs <root> <outdir>
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
const [root, out] = process.argv.slice(2);
const { url, close } = await serve(root);
for (const q of ['', '?focus=rls']) {
  const b = await openMorph(url + (q ? '/morph.html' + q : '/morph.html'), { capture: false, raw: true });
  const r = await b.page.evaluate(() => ({ focus: MORPH.state.focus, onTab: document.querySelector('#tabs button.on')?.dataset.focus, tabs: [...document.querySelectorAll('#tabs button')].map((x) => x.dataset.focus), seqLen: MORPH.SEQ_LEN }));
  console.log(JSON.stringify({ url: 'morph.html' + q, ...r, errors: b.errors }));
  if (!q) await b.page.screenshot({ path: `${out}/ui-default.png` });
  await b.close();
}
close();
