// Per-node travel from rack slot to network node: node travel-probe.mjs <root>
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
const [root] = process.argv.slice(2);
const { url, close } = await serve(root);
const b = await openMorph(url);
const rows = await b.page.evaluate(() => {
  const out = [];
  for (const j of MORPH.model.joins) {
    const nd = MORPH.morph.nodes[j.node.id];
    const f = nd.primary;
    const from = f.from, to = nd.base.clone().setY(nd.base.y + nd.height / 2);
    out.push({ view: j.view, id: j.node.id, layer: j.node.layer, rack: j.rack, helpers: j.helpers.length,
      from: [from.x, from.y, from.z].map((v) => +v.toFixed(2)), to: [to.x, to.y, to.z].map((v) => +v.toFixed(2)),
      dx: +(to.x - from.x).toFixed(2), dy: +(to.y - from.y).toFixed(2), dz: +(to.z - from.z).toFixed(2),
      horiz: +Math.hypot(to.x - from.x, to.z - from.z).toFixed(2), vert: +Math.abs(to.y - from.y).toFixed(2) });
  }
  const racks = Object.entries(MORPH.model.lab.racks).filter(([, r]) => r.row === 'front').map(([id, r]) => `${id}:x=${MORPH.morph.rackX(id).toFixed(2)}`);
  return { racks, diorama: MORPH.morph.diorama, rackFace: MORPH.morph.rackFace, out };
});
console.log(rows.racks.join(' '), 'diorama', JSON.stringify(rows.diorama), 'rackFace', rows.rackFace);
for (const r of rows.out) console.log(JSON.stringify(r));
await b.close(); close();
