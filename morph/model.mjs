// The shared model behind morph.html (and later the WebXR page): the EBC lab racks in front-row
// layout 1, a minimal copy of two CAL network views (ws6500, wsrls), and the join between them.
// No three.js here, so the desktop and headset pages can both use it.
//
// Racks: LAB_RACKS is read from index.html's generated LAB-RACKS block (so a re-bake of the
// inventory reaches this page too), then re-ordered to layout 1 the same way index.html's
// remapLabRacks does.
// Network: only {id, name, layer, type, pos}, links, wavelength paths and layer sizes / heights,
// hand-copied from the CAL network view. Positions are CAL units on each layer's plane, [x, z].

// Layout 1, "Optical core": TDM · 6500 · RLS · ELS · Outdoor (index.html RACK_LAYOUTS[1]).
export const LAYOUT_1 = { name: 'Option 1 · Optical core', blocks: [[1], [7, 8, 9], [2, 3, 4], [5, 6], [10]] };

// ---- CAL subset ---------------------------------------------------------------------------
// Node x follows the rack the device lives in, so each one drops (almost) straight down into the
// network view: R is one rack pitch (27 in) in CAL units at the engine's S = 0.15 m per unit, and x is
// measured from the A4 / A5 midline (A2 = -2.5 R … A7 = +2.5 R). z is ring depth, in front of the racks.
export const R = (27 * 0.0254) / 0.15;
export const LAYERS = { // size [w, d] and centre [x, z], CAL units
  ip: { size: [3 * R, 8], center: [1.5 * R, 0], caption: 'above' }, // the routers live in A5–A7
  tr: { size: [3 * R, 6], center: [-1.5 * R, 0] }, // the Waveservers in A2 and A4
  ph: { size: [6.5 * R, 9], center: [0, 0] }, // the 6500 ring under A2–A4, the RLS ring under A5–A7
};
export const LAYER_ORDER = ['ph', 'tr', 'ip']; // bottom to top
export const SPREAD = 6; // CAL units between stacked layers
export const layerY = (k) => LAYER_ORDER.indexOf(k) * SPREAD;
export const RIBBON = { h: 1.2, y0: 0.08 }; // a span's spectrum ribbon: height, bottom edge

export const VIEWS = { // layers: the big two-line captions (the ring's name lives here, not on the slab)
  ws6500: {
    title: 'Routed core + Waveserver + 6500',
    layers: { ip: 'IP / Ethernet', tr: 'Transport\nWaveserver 5', ph: 'Photonic\n6500 ring' },
  },
  wsrls: {
    title: 'Routed core + Waveserver + RLS',
    layers: { ip: 'IP / Ethernet', tr: 'Transport\nWaveserver 5', ph: 'Photonic\nRLS ring' },
  },
};
export const VIEW_KEYS = Object.keys(VIEWS);
const BOTH = ['ws6500', 'wsrls'];

export const NODES = [
  // IP: 8192-1 in A5, 8110-1 and 8192-2 in A6, 8110-2 in A7
  { id: 'W1', name: '8192-1', layer: 'ip', type: 'router', pos: [0.5 * R, -2.5], views: BOTH },
  { id: 'W2', name: '8110-1', layer: 'ip', type: 'router', pos: [1.5 * R, -2.5], views: BOTH },
  { id: 'W3', name: '8192-2', layer: 'ip', type: 'router', pos: [1.5 * R, 2.5], views: BOTH },
  { id: 'W4', name: '8110-2', layer: 'ip', type: 'router', pos: [2.5 * R, 2.5], views: BOTH },
  // Transport: West in A2, East in A4
  { id: 'WSW', name: 'Waveserver 5 West', layer: 'tr', type: 'xpdr', pos: [-2.5 * R, 0], views: BOTH },
  { id: 'WSE', name: 'Waveserver 5 East', layer: 'tr', type: 'xpdr', pos: [-0.5 * R, 0], views: BOTH },
  // 6500 ring: Canyon in A2 (the ring's apex), Wind and Breeze in A3, Peak and Mountain in A4
  { id: 'Canyon', name: 'Canyon', layer: 'ph', type: 'roadm', pos: [-2.5 * R, 0], views: ['ws6500'] },
  { id: 'Wind', name: 'Wind', layer: 'ph', type: 'amp', pos: [-1.5 * R, -2.4], views: ['ws6500'] },
  { id: 'Peak', name: 'Peak', layer: 'ph', type: 'roadm', pos: [-0.5 * R, -2.4], views: ['ws6500'] },
  { id: 'Mountain', name: 'Mountain', layer: 'ph', type: 'roadm', pos: [-0.5 * R, 2.4], views: ['ws6500'] },
  { id: 'Breeze', name: 'Breeze', layer: 'ph', type: 'amp', pos: [-1.5 * R, 2.4], views: ['ws6500'] },
  // RLS ring: Americas and Pacific in A5, Atlantic in A6 (the apex), Europe and Asia in A7
  { id: 'Americas', name: 'Americas', layer: 'ph', type: 'roadm', pos: [0.5 * R, -1.4], views: ['wsrls'] },
  { id: 'Atlantic', name: 'Atlantic', layer: 'ph', type: 'amp', pos: [1.5 * R, -3.4], views: ['wsrls'] },
  { id: 'Europe', name: 'Europe', layer: 'ph', type: 'roadm', pos: [2.5 * R, -1.4], views: ['wsrls'] },
  { id: 'Asia', name: 'Asia', layer: 'ph', type: 'roadm', pos: [2.5 * R, 2.4], views: ['wsrls'] },
  { id: 'Pacific', name: 'Pacific', layer: 'ph', type: 'amp', pos: [0.5 * R, 2.4], views: ['wsrls'] },
];

// Line systems: node order is the fibre order; a ring closes on its first node.
export const PH_SYSTEMS = [
  { name: '6500 ring', nodes: ['Canyon', 'Wind', 'Peak', 'Mountain', 'Breeze'], ring: true, views: ['ws6500'] },
  { name: 'RLS ring', nodes: ['Americas', 'Atlantic', 'Europe', 'Asia', 'Pacific'], ring: true, views: ['wsrls'] },
];

const PUR = 0x8b5cf6, BLU = 0x2d93ff;
export const GREY = 0x9aa1ab;
// Wavelengths: `band` is the height on the span ribbon (0 bottom, 1 top), `at` where the rate label sits.
export const WAVES = {
  ws16c: { rate: '1.6T', band: 0.75, color: PUR, path: ['Canyon', 'Breeze', 'Mountain'], views: ['ws6500'], at: 0.3 },
  ws8c: { rate: '800G', band: 0.55, color: BLU, path: ['Canyon', 'Wind', 'Peak', 'Mountain'], views: ['ws6500'], at: 0.5 },
  ws16r: { rate: '1.6T', band: 0.75, color: PUR, path: ['Americas', 'Pacific', 'Asia'], views: ['wsrls'], at: 0.3 },
  ws8r: { rate: '800G', band: 0.55, color: BLU, path: ['Americas', 'Atlantic', 'Europe', 'Asia'], views: ['wsrls'], at: 0.5 },
};

// IP adjacencies, carried by a wavelength in each view (dashed in its colour).
export const IP_LINKS = [
  ['W1', 'W3', { wsrls: 'ws16r', ws6500: 'ws16c' }],
  ['W2', 'W4', { wsrls: 'ws8r', ws6500: 'ws8c' }],
];
// Cross-layer handoffs: [from, to, views, optic ('grey' or a wavelength), offset [dx, dz]].
export const DROPS = [
  ['W1', 'WSW', BOTH, 'grey'],
  ['W2', 'WSW', BOTH, 'grey'],
  ['W3', 'WSE', BOTH, 'grey'],
  ['W4', 'WSE', BOTH, 'grey'],
  ['WSW', 'Americas', ['wsrls'], 'ws16r', [-0.3, 0]],
  ['WSW', 'Americas', ['wsrls'], 'ws8r', [0.3, 0]],
  ['WSE', 'Asia', ['wsrls'], 'ws16r', [-0.3, 0]],
  ['WSE', 'Asia', ['wsrls'], 'ws8r', [0.3, 0]],
  ['WSW', 'Canyon', ['ws6500'], 'ws16c', [-0.3, 0]],
  ['WSW', 'Canyon', ['ws6500'], 'ws8c', [0.3, 0]],
  ['WSE', 'Mountain', ['ws6500'], 'ws16c', [-0.3, 0]],
  ['WSE', 'Mountain', ['ws6500'], 'ws8c', [0.3, 0]],
];
// Transport adjacencies: [a, b, views, wavelength, sideways offset]; dashed, the light is on the ring.
export const TR_LINKS = [
  ['WSW', 'WSE', ['wsrls'], 'ws16r', -0.3],
  ['WSW', 'WSE', ['wsrls'], 'ws8r', 0.3],
  ['WSW', 'WSE', ['ws6500'], 'ws16c', -0.3],
  ['WSW', 'WSE', ['ws6500'], 'ws8c', 0.3],
];

// ---- Join ---------------------------------------------------------------------------------
// A CAL node is joined to EBC devices by (view, name): the device with the node's name (or its
// alias), plus the node's helper shelves, which fly with it and merge into it: `<name>-FMT` and
// the OMC fibre chassis `<first 3 letters>-OMC-n` (AME-OMC-1 is Americas').
export const ALIASES = {
  'Waveserver 5 West': 'Waveserver-5-West-1',
  'Waveserver 5 East': 'Waveserver-5-East-1',
};

// index.html's LAB_RACKS, re-ordered to `layout` (old display order → new), as remapLabRacks does.
export function remapLabRacks(labRacks, layout = LAYOUT_1) {
  const newOf = new Map();
  layout.blocks.flat().forEach((o, i) => newOf.set(o, i + 1));
  const mapId = (id) => (id[0] === 'A' && newOf.has(+id.slice(1))) ? 'A' + newOf.get(+id.slice(1)) : id;
  const racks = {};
  for (const [id, rk] of Object.entries(labRacks.racks))
    racks[mapId(id)] = rk.row === 'front' ? { ...rk, order: newOf.get(rk.order) ?? rk.order } : rk;
  const zones = labRacks.zones.map((z) => {
    const a = +mapId(z.rackStart).slice(1), b = +mapId(z.rackEnd).slice(1);
    return { ...z, rackStart: 'A' + Math.min(a, b), rackEnd: 'A' + Math.max(a, b) };
  });
  return { racks, zones, fibers: labRacks.fibers, rings: labRacks.rings };
}

// Pull LAB_RACKS out of index.html's generated block (between the LAB-RACKS markers).
export function parseLabRacks(indexHtml) {
  const a = indexHtml.indexOf('/* LAB-RACKS-START */'), b = indexHtml.indexOf('/* LAB-RACKS-END */');
  if (a < 0 || b < a) throw new Error('morph: no LAB-RACKS block in index.html');
  return new Function(`${indexHtml.slice(a, b)}\nreturn LAB_RACKS;`)();
}

export function joinViews(lab, { log = console } = {}) {
  const rackOf = new Map(); // device name -> { rack, device }
  for (const [id, rk] of Object.entries(lab.racks))
    for (const d of rk.devices) rackOf.set(d.name, { rack: id, device: d });
  const joins = []; // { view, node, primary, helpers[] }
  const missing = [];
  for (const view of VIEW_KEYS) {
    for (const node of NODES.filter((n) => n.views.includes(view))) {
      const primary = ALIASES[node.name] || node.name;
      if (!rackOf.has(primary)) { missing.push({ view, id: node.id, name: node.name }); continue; }
      const omc = `${node.name.slice(0, 3).toUpperCase()}-OMC-`;
      const helpers = [...rackOf.keys()].filter((n) => n === `${primary}-FMT` || (node.layer === 'ph' && n.startsWith(omc)));
      joins.push({ view, node, primary, helpers, rack: rackOf.get(primary).rack });
    }
    const got = joins.filter((j) => j.view === view);
    log.info?.(`[morph] ${view}: ${got.length}/${NODES.filter((n) => n.views.includes(view)).length} CAL nodes joined to ` +
      `${got.reduce((s, j) => s + 1 + j.helpers.length, 0)} EBC devices in ${[...new Set(got.map((j) => j.rack))].sort().join(', ')}`);
  }
  for (const m of missing) log.warn?.(`[morph] no EBC device for CAL node ${m.view}/${m.id} "${m.name}"`);
  return { joins, missing, rackOf };
}

// Everything the morph needs, from index.html's text.
export function buildModel(indexHtml, opts) {
  const lab = remapLabRacks(parseLabRacks(indexHtml), LAYOUT_1);
  return { lab, ...joinViews(lab, opts) };
}
