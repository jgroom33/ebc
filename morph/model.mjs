// The shared model behind morph.html (and later the WebXR page): the EBC lab racks in rack layout
// option 9, one network over them (the 6500, RLS and ELS line systems, the Waveservers riding them, the RSP
// routers and switches over it all), and the join between them. No three.js here, so the desktop and headset pages can both use it.
//
// Racks: LAB_RACKS is read from index.html's generated LAB-RACKS block (so a re-bake of the
// inventory reaches this page too) and laid out by lab-layouts.mjs, the same code index.html uses,
// so the room here is index.html?layout=9 (devices, zone signs, ring-node signs).
// Network: only {id, name, layer, type, pos}, links, wavelength paths and layer sizes / heights,
// hand-copied from the CAL network view. Positions are CAL units on each layer's plane, [x, z].
import { createLabLayouts } from '../lab-layouts.mjs';

// Option 9, "Photonic on the bottom": IP on top (U42+), transport (the Waveservers) in the middle
// (U35–36), photonic at the bottom, across A2–A9 — the same three bands as the network view.
export const MORPH_LAYOUT = 9;

// ---- The network (one combined view) -------------------------------------------------------
// Names, layer, type and placement only, plus links: the CAL network views for the line systems,
// the Waveserver 5 pair, the 6500-D7s and the 8192 / 8110 / 8112 / 8114 routers; the lab's LAB_RACKS
// fibres; and, for the rest of the RSP gear (patched per reservation, so no fixed
// links exist), plausible links marked `src: 'inferred'`. Every link says where it comes from.
//
// Placement: a node's x is its device's rack (the engine reads it from the racks), so each device
// moves straight up or down into its layer; `z` is depth in CAL units (S = 0.15 m), + toward the glass.
// R is one rack pitch (27 in) in CAL units, for the few offsets measured in racks.
export const R = (27 * 0.0254) / 0.15;
export const LAYER_ORDER = ['ph', 'tr', 'ip']; // bottom to top
export const SPREAD = 6; // CAL units between stacked layers
export const layerY = (k) => LAYER_ORDER.indexOf(k) * SPREAD;
export const RIBBON = { h: 1.2, y0: 0.08 }; // a span's spectrum ribbon: height, bottom edge
export const LAYERS = { // the big two-line captions; a slab is sized to its nodes plus `margin` units
  ip: { caption: 'IP / Ethernet\nRSP', margin: 1.6, place: 'above' },
  tr: { caption: 'Transport\nWaveserver', margin: 1.4 },
  ph: { caption: 'Photonic\n6500 · RLS · ELS', margin: 1.4 },
};
export const TITLE = 'RSP over Waveserver over 6500 · RLS · ELS';

// The line systems (highlight filters on the one view).
export const SYSTEMS = {
  '6500': { label: '6500', sub: '6500 ring · A2–A4' },
  rls: { label: 'RLS', sub: 'RLS ring · A5–A7' },
  els: { label: 'ELS', sub: 'ELS · RLS-300 · A8–A9' },
};
export const SYSTEM_KEYS = Object.keys(SYSTEMS);

const ph = (id, type, z, sys) => ({ id, name: id, layer: 'ph', type, z, sys });
const ip = (name, z, type = name.startsWith('8') ? 'router' : 'switch') => ({ id: name, name, layer: 'ip', type, z });
export const NODES = [
  // Photonic: the 6500 ring (Canyon A2 apex, Wind / Breeze A3, Peak / Mountain A4), the RLS ring (Americas /
  // Pacific A5, Atlantic A6 apex, Europe / Asia A7), ELS-1 and ELS-2 (terminal and OADM of each in A8 and A9,
  // a U each, ELS-1 open to the back, ELS-2 to the front) and the RLS-300 pair joining the rings (Uptown A8,
  // Downtown A9, in front).
  ph('Canyon', 'roadm', 0, '6500'), ph('Wind', 'amp', -2.4, '6500'), ph('Peak', 'roadm', -2.4, '6500'),
  ph('Mountain', 'roadm', 2.4, '6500'), ph('Breeze', 'amp', 2.4, '6500'),
  ph('Americas', 'roadm', -1.4, 'rls'), ph('Atlantic', 'amp', -3.4, 'rls'), ph('Europe', 'roadm', -1.4, 'rls'),
  ph('Asia', 'roadm', 2.4, 'rls'), ph('Pacific', 'amp', 2.4, 'rls'),
  ph('ELS-1-T-1', 'filter', -3.4, 'els'), ph('ELS-1-O-1', 'oadm', -1.6, 'els'),
  ph('ELS-1-O-2', 'oadm', -1.6, 'els'), ph('ELS-1-T-2', 'filter', -3.4, 'els'),
  ph('ELS-2-T-1', 'filter', 2.8, 'els'), ph('ELS-2-O-1', 'oadm', 1.0, 'els'),
  ph('ELS-2-O-2', 'oadm', 1.0, 'els'), ph('ELS-2-T-2', 'filter', 2.8, 'els'),
  ph('Uptown', 'roadm', 4.6, 'els'), ph('Downtown', 'roadm', 4.6, 'els'),
  // Transport: two fibered Waveserver links and the 6500-D7 pair (A1, 6500 Services). Each Waveserver link
  // rides the line system under its racks (see RIDES): in option 9 the Waveserver 5 800G link (A5, A7) is
  // over the RLS and the WSAi 400G link (A2, A4) over the 6500.
  { id: 'WSW', name: 'Waveserver 5 West', layer: 'tr', type: 'xpdr', z: 0 },
  { id: 'WSE', name: 'Waveserver 5 East', layer: 'tr', type: 'xpdr', z: 0 },
  { id: 'WS-2P', name: 'WSAi WS-2P', layer: 'tr', type: 'xpdr', z: 0 },
  { id: 'WS-1P', name: 'WSAi WS-1P', layer: 'tr', type: 'xpdr', z: 0 },
  { id: 'D7-1', name: '6500-D7-1', layer: 'tr', type: 'xpdr', z: -1.3, sys: '6500' },
  { id: 'D7-2', name: '6500-D7-2', layer: 'tr', type: 'xpdr', z: 1.3, sys: '6500' },
  // IP / Ethernet: the whole RSP top band of option 9 (Metro & Aggregation), back to front in each rack.
  ip('8192-1', -2.5), ip('8114-1', 0.5), ip('8114-2', 2.5), // A2
  ip('5166-1', -3), ip('5170-1', -1.5), ip('5170-2', 0), ip('5170-3', 1.5), ip('5170-4', 3), // A3
  ip('8110-1', -2.5), ip('8192-2', 2.5), // A4
  ip('8110-3', -2.5), ip('5166-2', 1), // A5
  ip('8192-3', -2.5), ip('8110-4', 1), // A6
  ip('8112-1', -2.5), ip('8112-2', 0), ip('8110-2', 2.5), // A7
  ip('5171-1', -3.6), ip('5130-1', -2.2), ip('5164-5', -0.8), ip('5164-6', 0.6), ip('5164-7', 2), ip('5164-8', 3.4), // A8
  ip('5171-2', -3.6), ip('5130-2', -2.2), ip('5164-1', -0.8), ip('5164-2', 0.6), ip('5164-3', 2), ip('5164-4', 3.4), // A9
];

// Line systems: node order is the fibre order; a ring closes on its first node.
export const PH_SYSTEMS = [
  { name: '6500 ring', nodes: ['Canyon', 'Wind', 'Peak', 'Mountain', 'Breeze'], ring: true, sys: '6500', src: 'cal' },
  { name: 'RLS ring', nodes: ['Americas', 'Atlantic', 'Europe', 'Asia', 'Pacific'], ring: true, sys: 'rls', src: 'cal' },
  { name: 'ELS-1', nodes: ['ELS-1-T-1', 'ELS-1-O-1', 'ELS-1-O-2', 'ELS-1-T-2'], sys: 'els', src: 'cal' },
  { name: 'ELS-2', nodes: ['ELS-2-T-1', 'ELS-2-O-1', 'ELS-2-O-2', 'ELS-2-T-2'], sys: 'els', src: 'cal' },
  { name: 'RLS-300', nodes: ['Uptown', 'Downtown'], sys: 'els', src: 'cal' },
];
// The RLS-300 joining the rings (CAL rls6500: Europe → Downtown, Uptown → Mountain): fibres routed on lanes in
// front of the rings, [a, b, lane z, sideways step from a in racks before the lane, src]. Joins two systems.
export const PH_JOINS = [
  ['Mountain', 'Uptown', 4.6, 0, 'cal'],
  ['Europe', 'Downtown', 5.8, 0.5, 'cal'],
];

const PUR = 0x8b5cf6, BLU = 0x2d93ff, CYA = 0x22c3d6;
export const GREY = 0x9aa1ab;
// A direct drop (an RSP router or switch with a coloured pluggable straight into a line system) takes its
// line system's colour; a 1310 client drop into a Waveserver is grey.
export const DIRECT = { '6500': 0xff8a3d, rls: 0x36bb8a, els: 0xf0d418 };
// Wavelengths on the line systems: `band` is the height on the span ribbon, `at` where the rate label sits.
export const WAVES = {
  ws16r: { rate: '1.6T', band: 0.75, color: PUR, path: ['Americas', 'Pacific', 'Asia'], at: 0.3, src: 'cal' }, // the Waveserver 5 pair
  wsai: { rate: '400G', band: 0.75, color: CYA, path: ['Canyon', 'Breeze', 'Mountain'], at: 0.3, src: 'inferred' }, // the WSAi pair
  d7: { rate: '800G', band: 0.55, color: BLU, path: ['Canyon', 'Wind', 'Peak', 'Mountain'], at: 0.5, src: 'cal' }, // the 6500-D7s
  // the direct drops' wavelengths, in their line system's colour
  d6500: { rate: '400G', band: 0.3, color: DIRECT['6500'], path: ['Canyon', 'Wind', 'Peak', 'Mountain'], at: 0.5, src: 'inferred' }, // 8192-1 ↔ 8192-2
  drls1: { rate: '400G', band: 0.3, color: DIRECT.rls, path: ['Americas', 'Atlantic', 'Europe'], at: 0.5, src: 'inferred' }, // 8110-3 ↔ 8112-1
  drls2: { rate: '400G', band: 0.3, color: DIRECT.rls, path: ['Americas', 'Pacific', 'Asia'], at: 0.6, src: 'inferred' }, // 8110-3 ↔ 8112-2
  dels1: { rate: '400G', band: 0.3, color: DIRECT.els, path: ['ELS-1-T-1', 'ELS-1-O-1', 'ELS-1-O-2', 'ELS-1-T-2'], at: 0.5, src: 'inferred' }, // 5171-1 ↔ 5171-2
  dels2: { rate: '400G', band: 0.3, color: DIRECT.els, path: ['ELS-2-T-1', 'ELS-2-O-1', 'ELS-2-O-2', 'ELS-2-T-2'], at: 0.5, src: 'inferred' }, // 5164-7 ↔ 5164-3
};

// Transport links (dashed adjacencies; the light is on a line system or the fibre between them).
export const TR_LINKS = [
  ['WSW', 'WSE', 'cal'], // Waveserver 5 West ↔ East, 800G
  ['WS-2P', 'WS-1P', 'lab'], // WSAi, 400G (LAB_RACKS fibre)
  ['D7-1', 'D7-2', 'cal'],
];
// A Waveserver link rides the line system under its racks: its drop for each system, [node, src].
export const RIDES = {
  WSW: { rls: ['Americas', 'cal', 'ws16r'], '6500': ['Canyon', 'cal', 'wsai'] },
  WSE: { rls: ['Asia', 'cal', 'ws16r'], '6500': ['Mountain', 'cal', 'wsai'] },
  'WS-2P': { '6500': ['Canyon', 'inferred', 'wsai'], rls: ['Americas', 'inferred', 'ws16r'] },
  'WS-1P': { '6500': ['Mountain', 'inferred', 'wsai'], rls: ['Asia', 'inferred', 'ws16r'] },
};
// Cross-layer drops: [from, to, kind, src]. RSP gear drops only into gear in its own rack column: a '1310'
// client into the Waveserver below it, or a 'direct' pluggable straight into the line system below it.
// Racks with only amplifiers under them (A3, A6) have no drop: an amp takes no client. The 6500-D7s (A1)
// have no RSP gear above them. Waveserver → line system drops come from RIDES (same rack).
export const DROPS = [
  ['D7-1', 'Canyon', 'd7', 'cal'], ['D7-2', 'Mountain', 'd7', 'cal'], // transport → photonic (A1 → A2 / A4)
  // A2: 8114s into WSAi WS-2P, 8192-1 straight into Canyon
  ['8114-1', 'WS-2P', '1310', 'inferred'], ['8114-2', 'WS-2P', '1310', 'inferred'], ['8192-1', 'Canyon', 'direct', 'inferred'],
  // A4: 8110-1 into WSAi WS-1P, 8192-2 straight into Mountain
  ['8110-1', 'WS-1P', '1310', 'inferred'], ['8192-2', 'Mountain', 'direct', 'inferred'],
  // A5: 5166-2 into Waveserver 5 West, 8110-3 straight into Americas
  ['5166-2', 'WSW', '1310', 'inferred'], ['8110-3', 'Americas', 'direct', 'inferred'],
  // A7: 8110-2 into Waveserver 5 East (CAL), 8112-1 into Europe and 8112-2 into Asia
  ['8110-2', 'WSE', '1310', 'cal'], ['8112-1', 'Europe', 'direct', 'inferred'], ['8112-2', 'Asia', 'direct', 'inferred'],
  // A8 / A9: the aggregation straight into the ELS terminals
  ['5171-1', 'ELS-1-T-1', 'direct', 'inferred'], ['5164-7', 'ELS-2-T-1', 'direct', 'inferred'],
  ['5171-2', 'ELS-1-T-2', 'direct', 'inferred'], ['5164-3', 'ELS-2-T-2', 'direct', 'inferred'],
];
// RSP adjacencies (IP / Ethernet layer), [a, b, src].
export const IP_LINKS = [
  ['8192-1', '8192-2', 'cal'], ['8192-1', '8192-3', 'cal'], ['8192-2', '8192-3', 'cal'],
  ['8110-1', '8112-1', 'cal'], ['8110-2', '8112-2', 'cal'], ['8110-1', '8110-2', 'cal'], ['8112-1', '8112-2', 'cal'],
  ['8114-1', '8192-1', 'cal'], // CAL's "8114"
  ['8114-2', '8192-1', 'inferred'],
  ['5166-1', '8192-1', 'inferred'], ['5166-1', '8192-2', 'inferred'],
  ['5170-1', '5166-1', 'inferred'], ['5170-2', '5166-1', 'inferred'], ['5170-3', '5166-1', 'inferred'], ['5170-4', '5166-1', 'inferred'],
  ['5166-2', '8110-3', 'inferred'], ['8110-3', '8192-2', 'inferred'], ['8110-4', '8192-3', 'inferred'],
  ['5130-1', '5171-1', 'inferred'], ['5130-2', '5171-2', 'inferred'],
  ['5164-5', '5171-1', 'inferred'], ['5164-6', '5171-1', 'inferred'], ['5164-7', '5171-1', 'inferred'], ['5164-8', '5171-1', 'inferred'],
  ['5164-1', '5171-2', 'inferred'], ['5164-2', '5171-2', 'inferred'], ['5164-3', '5171-2', 'inferred'], ['5164-4', '5171-2', 'inferred'],
  ['5171-1', '5171-2', 'inferred'], ['5171-1', '8112-1', 'inferred'], ['5171-2', '8112-2', 'inferred'],
];

// ---- Join ---------------------------------------------------------------------------------
// A node is joined to its EBC device by name (or alias), plus its helper shelves, which fly with it and
// merge into it: `<device>-FMT`, and for a photonic node the OMC fibre chassis `<first 3 letters>-OMC-n`.
export const ALIASES = {
  'Waveserver 5 West': 'Waveserver-5-West-1',
  'Waveserver 5 East': 'Waveserver-5-East-1',
  'WSAi WS-2P': 'WS-2P',
  'WSAi WS-1P': 'WS-1P',
};

// Pull LAB_RACKS out of index.html's generated block (between the LAB-RACKS markers).
export function parseLabRacks(indexHtml) {
  const a = indexHtml.indexOf('/* LAB-RACKS-START */'), b = indexHtml.indexOf('/* LAB-RACKS-END */');
  if (a < 0 || b < a) throw new Error('morph: no LAB-RACKS block in index.html');
  return new Function(`${indexHtml.slice(a, b)}\nreturn LAB_RACKS;`)();
}

export function joinNetwork(lab, { log = console } = {}) {
  const rackOf = new Map(); // device name -> rack id
  for (const [id, rk] of Object.entries(lab.racks)) for (const d of rk.devices) rackOf.set(d.name, id);
  const joins = [], missing = [];
  for (const node of NODES) {
    const primary = ALIASES[node.name] || node.name;
    if (!rackOf.has(primary)) { missing.push(node); continue; }
    const omc = `${node.name.slice(0, 3).toUpperCase()}-OMC-`;
    const helpers = [...rackOf.keys()].filter((n) => n === `${primary}-FMT` || (node.layer === 'ph' && n.startsWith(omc)));
    joins.push({ node, primary, helpers, rack: rackOf.get(primary) });
  }
  const joined = new Set(joins.map((j) => j.node.id)), rackOfNode = Object.fromEntries(joins.map((j) => [j.node.id, j.rack]));
  // a line system's racks: where its nodes are; a Waveserver link rides the system under its racks
  const sysRacks = {};
  for (const n of NODES) if (n.layer === 'ph' && joined.has(n.id)) (sysRacks[n.sys] ||= new Set()).add(rackOfNode[n.id]);
  const sys = Object.fromEntries(NODES.filter((n) => n.sys).map((n) => [n.id, new Set([n.sys])]));
  const drops = DROPS.map(([a, b, optic, src]) => ({ a, b, optic, src }));
  for (const [id, by] of Object.entries(RIDES)) {
    if (!joined.has(id)) continue;
    const under = Object.keys(by).find((k) => sysRacks[k]?.has(rackOfNode[id]));
    if (!under) { log.warn?.(`[morph] ${id} (${rackOfNode[id]}) is over no line system`); continue; }
    const [to, src, optic] = by[under];
    drops.push({ a: id, b: to, optic, src, ride: under });
    sys[id] = new Set([under]);
  }
  const live = drops.filter((d) => joined.has(d.a) && joined.has(d.b));
  for (const d of live) if (NODES.find((n) => n.id === d.a)?.layer === 'ip' && rackOfNode[d.a] !== rackOfNode[d.b])
    log.warn?.(`[morph] RSP drop ${d.a} (${rackOfNode[d.a]}) → ${d.b} (${rackOfNode[d.b]}) crosses racks`);
  // a node's systems: from what it drops into, then (for RSP gear with no drops) its neighbours'
  for (let pass = 0; pass < 3; pass++) for (const d of live) for (const s_ of sys[d.b] || []) (sys[d.a] ||= new Set()).add(s_);
  for (let pass = 0; pass < 4; pass++) for (const [a, b] of IP_LINKS) {
    if (!sys[a]?.size && sys[b]?.size) sys[a] = new Set(sys[b]);
    if (!sys[b]?.size && sys[a]?.size) sys[b] = new Set(sys[a]);
  }
  log.info?.(`[morph] ${joins.length}/${NODES.length} network nodes joined to ${joins.reduce((n, j) => n + 1 + j.helpers.length, 0)} EBC devices; ` +
    `rides: ${live.filter((d) => d.ride).map((d) => `${d.a}→${d.ride}`).join(', ')}`);
  for (const m of missing) log.warn?.(`[morph] no EBC device for network node ${m.id} "${m.name}"`);
  return { joins, missing, drops: live, sysOf: Object.fromEntries(Object.entries(sys).map(([k, v]) => [k, [...v]])), rackOf };
}

// Everything the morph needs, from index.html's text.
export function buildModel(indexHtml, opts) {
  const { RACK_LAYOUTS, layoutId, labDataFor } = createLabLayouts(parseLabRacks(indexHtml));
  const idx = RACK_LAYOUTS.findIndex((L, i) => layoutId(i) === MORPH_LAYOUT);
  if (idx < 0) throw new Error(`morph: no rack layout ${MORPH_LAYOUT} in lab-layouts.mjs`);
  const lab = labDataFor(idx);
  return { lab, layout: { id: MORPH_LAYOUT, name: RACK_LAYOUTS[idx].name }, ...joinNetwork(lab, opts) };
}
