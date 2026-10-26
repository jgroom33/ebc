// Front-row (A1–A10) elevation options for the EBC customer-facing display row.
//
// Every option is a list of items, each { rack, u, product } (u = bottom U, U1 at the
// bottom of a 58U rack), plus zone placards { rack, u, label, span } (3U, spanning `span`
// racks from `rack`) and marked reserved space { rack, u, h, label }. Heights come from
// PRODUCTS. tools/front-row/check.mjs proves each option places exactly TODAY's devices.
// index.html imports this file directly for its ‹ / › rack-layout bar (`name`, `desc` are
// the bar's text), so keep it plain browser-loadable JS with no Node imports.

export const RACK_U = 58;
export const RACKS = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10'];
export const PLACARD_U = 3;

// Product -> height in U, and the family that colours it in the drawings.
export const PRODUCTS = {
  '3926': [1, 'access'], '3984': [1, 'access'], '3928': [1, 'access'],
  '3926 Combo': [1, 'tdm'], '3926 TDM': [1, 'tdm'],
  '5164': [1, 'agg'], '5171': [2, 'agg'], '5130': [1, 'agg'],
  '5170': [1, 'metro'], '5166': [1, 'metro'], '8110': [2, 'metro'], '8112': [1, 'metro'],
  '8114': [2, 'metro'], '8192': [2, 'metro'],
  'ELS OADM': [1, 'els'], 'ELS Terminal': [2, 'els'],
  'RLS R4-600': [4, 'rls'], 'RLS R2-600': [2, 'rls'], 'RLS R2-300': [2, 'rls'], 'OMC': [1, 'rls'],
  '6500-14s (photonic)': [13, 'photonic'], '6500-7s (photonic)': [7, 'photonic'],
  '6500-2s (photonic amp)': [2, 'photonic'],
  '6500-D7 (services/transponder)': [7, 'services'],
  'Waveserver 5': [1, 'dci'], 'WSAi': [1, 'dci'],
  'FMT': [1, 'fmt'],
};
export const height = (product) => {
  if (!PRODUCTS[product]) throw new Error(`unknown product '${product}'`);
  return PRODUCTS[product][0];
};

// Today's plan: rack, bottom U, product (placards: label and span). A10 carries the DCOM and
// Outdoor placards as on the baked layout (anchor U49 and U33, i.e. U48–U50 and U32–U34).
const TODAY_TEXT = `
A1 U48 placard 'Access'
A1 U45 3926
A1 U44 3926
A1 U43 3984
A1 U42 3984
A1 U41 3984
A1 U40 3984
A1 U39 3928
A1 U38 3928
A1 U27 placard 'TDM'
A1 U22 3926 Combo
A1 U21 3926 Combo
A1 U20 3926 TDM
A1 U19 3926 TDM
A2 U48 placard 'Converged Metro' spans 3
A2 U45 5170
A2 U44 5170
A2 U43 5170
A2 U42 5170
A2 U41 5166
A2 U39 8114
A2 U37 8114
A2 U35 8192
A2 U27 placard 'RLS' spans 3
A2 U26 OMC
A2 U25 OMC
A2 U24 OMC
A2 U20 RLS R4-600
A2 U19 FMT
A2 U12 RLS R2-600
A2 U11 FMT
A3 U41 5166
A3 U39 8110
A3 U37 8110
A3 U35 8192
A3 U22 RLS R2-600
A3 U21 FMT
A3 U15 RLS R2-300
A3 U14 FMT
A3 U11 RLS R2-300
A3 U10 FMT
A4 U41 8110
A4 U39 8110
A4 U38 8112
A4 U37 8112
A4 U35 8192
A4 U25 OMC
A4 U24 OMC
A4 U20 RLS R4-600
A4 U19 FMT
A4 U11 RLS R4-600
A4 U10 OMC
A4 U9 FMT
A5 U48 placard 'Aggregation' spans 2
A5 U45 5164
A5 U44 5164
A5 U43 5164
A5 U42 5164
A5 U40 5171
A5 U39 5130
A5 U27 placard 'ELS' spans 2
A5 U24 ELS OADM
A5 U21 ELS Terminal
A5 U16 ELS OADM
A5 U13 ELS Terminal
A6 U45 5164
A6 U44 5164
A6 U43 5164
A6 U42 5164
A6 U40 5171
A6 U39 5130
A6 U24 ELS OADM
A6 U21 ELS Terminal
A6 U16 ELS OADM
A6 U13 ELS Terminal
A7 U48 placard 'Datacenter Interconnect' spans 3
A7 U42 Waveserver 5
A7 U40 WSAi
A7 U27 placard '6500' spans 3
A7 U13 6500-14s (photonic)
A7 U12 FMT
A8 U24 6500-2s (photonic amp)
A8 U16 6500-D7 (services/transponder)
A8 U15 FMT
A8 U13 6500-2s (photonic amp)
A8 U5 6500-D7 (services/transponder)
A8 U4 FMT
A9 U42 Waveserver 5
A9 U40 WSAi
A9 U19 6500-7s (photonic)
A9 U11 6500-7s (photonic)
A10 U48 placard 'DCOM'
A10 U32 placard 'Outdoor'
`;

function parseToday(text) {
  const items = [], placards = [];
  for (const line of text.trim().split('\n')) {
    const m = line.match(/^(A\d+) U(\d+) (.+)$/);
    if (!m) throw new Error(`bad plan line: ${line}`);
    const [, rack, u, rest] = m;
    const p = rest.match(/^placard '([^']+)'(?: spans (\d+))?$/);
    if (p) placards.push({ rack, u: +u, label: p[1], span: +(p[2] || 1) });
    else items.push({ rack, u: +u, product: rest });
  }
  return { items, placards, reserved: [], signs: [] };
}

// Units: devices that must stay together, contiguous in one rack, parts in this order top to
// bottom (today's OMC/FMT pairing). Ring nodes and the RLS-300 pair carry a 1U name sign in
// the U directly below the unit; its tag says terminal or amp. The 6500-D7 services shelves
// are units without a sign.
export const UNITS = {
  Americas: { ring: 'RLS', role: 'Terminal', parts: ['OMC', 'OMC', 'OMC', 'RLS R4-600', 'FMT'] },
  Atlantic: { ring: 'RLS', role: 'Amp',      parts: ['RLS R2-600', 'FMT'] },
  Europe:   { ring: 'RLS', role: 'Terminal', parts: ['OMC', 'OMC', 'RLS R4-600', 'FMT'] },
  Asia:     { ring: 'RLS', role: 'Terminal', parts: ['RLS R4-600', 'OMC', 'FMT'] },
  Pacific:  { ring: 'RLS', role: 'Amp',      parts: ['RLS R2-600', 'FMT'] },
  Downtown: { role: 'RLS-300', parts: ['RLS R2-300', 'FMT'] },
  Uptown:   { role: 'RLS-300', parts: ['RLS R2-300', 'FMT'] },
  Canyon:   { ring: '6500', role: 'Terminal', parts: ['6500-14s (photonic)', 'FMT'] },
  Wind:     { ring: '6500', role: 'Amp',      parts: ['6500-2s (photonic amp)'] },
  Peak:     { ring: '6500', role: 'Terminal', parts: ['6500-7s (photonic)'] },
  Mountain: { ring: '6500', role: 'Terminal', parts: ['6500-7s (photonic)'] },
  Breeze:   { ring: '6500', role: 'Amp',      parts: ['6500-2s (photonic amp)'] },
  'D7 services 1': { parts: ['6500-D7 (services/transponder)', 'FMT'], sign: false },
  'D7 services 2': { parts: ['6500-D7 (services/transponder)', 'FMT'], sign: false },
};
// Ring order (the order the fiber ring visits the nodes).
export const RINGS = {
  RLS: ['Americas', 'Atlantic', 'Europe', 'Asia', 'Pacific'],
  6500: ['Canyon', 'Wind', 'Peak', 'Mountain', 'Breeze'],
};
export const hasSign = (unit) => UNITS[unit].sign !== false;
export const signLabel = (unit) => `${unit} · ${UNITS[unit].role}`;

// Where each unit sits in today's plan: rack and the U of its top part.
const TODAY_UNITS = [
  ['Americas', 'A2', 26], ['Pacific', 'A2', 13], ['Atlantic', 'A3', 23], ['Downtown', 'A3', 16],
  ['Uptown', 'A3', 12], ['Europe', 'A4', 25], ['Asia', 'A4', 14], ['Canyon', 'A7', 25],
  ['Wind', 'A8', 25], ['D7 services 1', 'A8', 22], ['Breeze', 'A8', 14], ['D7 services 2', 'A8', 11],
  ['Peak', 'A9', 25], ['Mountain', 'A9', 17],
];

// Walk a unit's parts down from topU: [{ product, u }], and the sign U below it.
function unitLayout(unit, topU) {
  let top = topU;
  const parts = UNITS[unit].parts.map(product => {
    const u = top - height(product) + 1;
    top = u - 1;
    return { product, u };
  });
  return { parts, signU: hasSign(unit) ? top : null, nextTop: hasSign(unit) ? top - 1 : top };
}

function tagToday(plan) {
  plan.signs = [];
  for (const [unit, rack, topU] of TODAY_UNITS) {
    const { parts, signU } = unitLayout(unit, topU);
    for (const p of parts) {
      const it = plan.items.find(i => i.rack === rack && i.u === p.u && i.product === p.product && !i.unit);
      if (!it) throw new Error(`today's plan: no ${p.product} at ${rack} U${p.u} for ${unit}`);
      it.unit = unit;
    }
    if (signU !== null) plan.signs.push({ rack, u: signU, unit });
  }
  return plan;
}

// Builder: zones are drawn as a placard with stacks of devices hung under it, top down.
// stack(rack, topU, [...products]) puts the first product's top at topU and works down
// with no gaps; '-' leaves a 1U gap. units(rack, topU, [...names]) does the same with
// whole units, each followed by its name sign.
function builder() {
  const o = { items: [], placards: [], reserved: [], signs: [] };
  return {
    placard(rack, u, label, span = 1) { o.placards.push({ rack, u, label, span }); },
    stack(rack, topU, products) {
      let top = topU;
      for (const product of products) {
        if (product === '-') { top -= 1; continue; }
        const u = top - height(product) + 1;
        o.items.push({ rack, u, product });
        top = u - 1;
      }
    },
    units(rack, topU, names) {
      let top = topU;
      for (const unit of names) {
        const { parts, signU, nextTop } = unitLayout(unit, top);
        for (const p of parts) o.items.push({ rack, u: p.u, product: p.product, unit });
        if (signU !== null) o.signs.push({ rack, u: signU, unit });
        top = nextTop;
      }
    },
    reserve(rack, u, h, label) { o.reserved.push({ rack, u, h, label }); },
    done: () => o,
  };
}

const ACCESS = ['3926', '3926', '3984', '3984', '3984', '3984', '3928', '3928'];
const TDM = ['3926 Combo', '3926 Combo', '3926 TDM', '3926 TDM'];
const AGG = ['5164', '5164', '5164', '5164', '5171', '5130'];
const ELS_PAIR = ['ELS OADM', 'ELS Terminal'];
const DCI = ['Waveserver 5', 'WSAi'];

// Option 4: Access to Core. Route/switch runs left to right across the top band; the
// optical layers sit under it as bands, ELS over 6500 over RLS, one ring node per rack in
// ring order.
function option4() {
  const b = builder();
  b.placard('A1', 48, 'Access');                  b.stack('A1', 47, ACCESS);
  b.placard('A2', 48, 'TDM');                     b.stack('A2', 47, TDM);
  b.placard('A3', 48, 'Aggregation', 2);          b.stack('A3', 47, AGG); b.stack('A4', 47, AGG);
  b.placard('A5', 48, 'Converged Metro', 4);
  b.stack('A5', 47, ['5170', '5170', '5170', '5170', '5166', '5166']);
  b.stack('A6', 47, ['8110', '8110', '8110', '8110']);
  b.stack('A7', 47, ['8112', '8112', '8114', '8114']);
  b.stack('A8', 47, ['8192', '8192', '8192']);
  b.placard('A9', 48, 'Datacenter Interconnect'); b.stack('A9', 47, [...DCI, ...DCI]);

  b.placard('A1', 36, 'ELS', 4);
  for (const r of ['A1', 'A2', 'A3', 'A4']) b.stack(r, 35, ELS_PAIR);

  b.placard('A2', 29, '6500', 7);
  ['Canyon', 'Wind', 'Peak', 'Mountain', 'Breeze', 'D7 services 1', 'D7 services 2']
    .forEach((u, i) => b.units(`A${i + 2}`, 28, [u]));

  b.placard('A3', 11, 'RLS', 7);
  ['Americas', 'Atlantic', 'Europe', 'Asia', 'Pacific', 'Downtown', 'Uptown']
    .forEach((u, i) => b.units(`A${i + 3}`, 10, [u]));

  b.placard('A10', 48, 'DCOM'); b.placard('A10', 32, 'Outdoor');
  return b.done();
}

// Option 5: Photonic in the center. Route/switch left, photonic middle (RLS over 6500
// photonic), service interfaces right (6500-D7, Waveserver 5, WSAi).
function option5() {
  const b = builder();
  b.placard('A1', 48, 'Access');                  b.stack('A1', 47, ACCESS);
  b.placard('A1', 23, 'TDM');                     b.stack('A1', 22, TDM);
  b.placard('A2', 48, 'Aggregation');             b.stack('A2', 47, [...AGG, ...AGG]);
  b.placard('A3', 48, 'Converged Metro', 2);
  b.stack('A3', 47, ['5170', '5170', '5170', '5170', '5166', '5166', '8112', '8112', '8114', '8114', '8192']);
  b.stack('A4', 47, ['8110', '8110', '8110', '8110', '8192', '8192']);
  b.placard('A4', 23, 'ELS');                     b.stack('A4', 22, [...ELS_PAIR, ...ELS_PAIR, ...ELS_PAIR, ...ELS_PAIR]);

  b.placard('A5', 48, 'RLS', 3);
  b.units('A5', 47, ['Americas', 'Atlantic']);
  b.units('A6', 47, ['Europe', 'Asia']);
  b.units('A7', 47, ['Pacific', 'Downtown', 'Uptown']);
  b.placard('A5', 23, '6500 Photonic', 3);
  b.units('A5', 22, ['Canyon', 'Wind']);
  b.units('A6', 22, ['Peak', 'Mountain']);
  b.units('A7', 22, ['Breeze']);

  b.placard('A8', 48, 'Datacenter Interconnect', 2);
  b.stack('A8', 47, DCI); b.stack('A9', 47, DCI);
  b.placard('A8', 23, '6500 Services', 2);
  b.units('A8', 22, ['D7 services 1']); b.units('A9', 22, ['D7 services 2']);

  b.placard('A10', 48, 'DCOM'); b.placard('A10', 32, 'Outdoor');
  return b.done();
}

// Option 6: Portfolio vertical slices, one rack per product line. With its node signs the
// 6500 needs 37U photonic + 16U services + two placards = 59U, one over a 58U rack, so the
// services shelves get their own rack next to it.
function option6() {
  const b = builder();
  b.placard('A1', 48, 'Access');                  b.stack('A1', 47, ACCESS);
  b.placard('A1', 27, 'TDM');                     b.stack('A1', 26, TDM);
  b.placard('A2', 48, 'Aggregation');             b.stack('A2', 47, [...AGG, ...AGG]);
  b.placard('A3', 48, 'Converged Metro');
  b.stack('A3', 47, ['5170', '5170', '5170', '5170', '5166', '5166', '8110', '8110', '8110', '8110',
                     '8112', '8112', '8114', '8114', '8192', '8192', '8192']);
  b.placard('A4', 48, 'ELS');
  b.stack('A4', 47, [...ELS_PAIR, '-', ...ELS_PAIR, '-', ...ELS_PAIR, '-', ...ELS_PAIR]);
  b.placard('A5', 48, '6500 Photonic');           b.units('A5', 47, RINGS[6500]);
  b.placard('A6', 48, '6500 Services');           b.units('A6', 47, ['D7 services 1', 'D7 services 2']);
  b.placard('A7', 48, 'RLS');                     b.units('A7', 47, [...RINGS.RLS, 'Downtown', 'Uptown']);
  b.placard('A8', 48, 'Waveserver');              b.stack('A8', 47, [...DCI, ...DCI]);
  b.reserve('A8', 22, 22, 'Reserved: Waveserver E-Series');
  b.placard('A10', 48, 'DCOM'); b.placard('A10', 32, 'Outdoor');
  return b.done();
}

export const TODAY = tagToday(parseToday(TODAY_TEXT));

// The 3D scene's original section re-orders (index.html RACK_LAYOUTS 0–3, kept there verbatim;
// check.mjs proves the two copies match). `blocks` lists today's racks, by number, in their new
// left-to-right order: whole sections move between racks, nothing inside a rack moves.
export const SECTION_LAYOUTS = [
  { name: 'Current', desc: 'TDM · RLS · ELS · 6500 · Outdoor',
    blocks: [[1], [2, 3, 4], [5, 6], [7, 8, 9], [10]] },
  { name: 'Option 1 · Optical core', desc: 'TDM · 6500 · RLS · ELS · Outdoor',
    blocks: [[1], [7, 8, 9], [2, 3, 4], [5, 6], [10]] },
  { name: 'Option 2 · Edge → core', desc: 'Outdoor · TDM · ELS · RLS · 6500',
    blocks: [[10], [1], [5, 6], [2, 3, 4], [7, 8, 9]] },
  { name: 'Option 3 · Aggregation left', desc: 'ELS · Outdoor · TDM · RLS · 6500',
    blocks: [[5, 6], [10], [1], [2, 3, 4], [7, 8, 9]] },
];

// Today's plan with its racks re-ordered per `blocks`, the way the scene's remapLabRacks does it.
function remapPlan(plan, blocks) {
  const newOf = new Map(blocks.flat().map((old, i) => [old, i + 1]));
  const map = (rack) => `A${newOf.get(+rack.slice(1))}`;
  return {
    items: plan.items.map(it => ({ ...it, rack: map(it.rack) })),
    placards: plan.placards.map(p => {
      const a = +map(p.rack).slice(1), b = +map(RACKS[RACKS.indexOf(p.rack) + p.span - 1]).slice(1);
      return { ...p, rack: `A${Math.min(a, b)}` };
    }),
    signs: plan.signs.map(sg => ({ ...sg, rack: map(sg.rack) })),
    reserved: [],
  };
}
const section = (i) => ({ ...SECTION_LAYOUTS[i], plan: remapPlan(TODAY, SECTION_LAYOUTS[i].blocks),
  alignLower: true });    // signs sized like the baked layout's (shared lower-section band)

export const OPTIONS = [
  {
    key: 'option-0-current', title: "Current (today's plan)", short: 'Current', ...section(0),
    story: [
      'A1: Access on top, TDM underneath.',
      'A2–A4: Converged Metro on top, RLS underneath.',
      'A5–A6: Aggregation on top, ELS underneath.',
      'A7–A9: Datacenter Interconnect on top, 6500 underneath.',
      'A10: DCOM and Outdoor.',
    ],
    growth: [
      'More 8100s: Converged Metro (A2–A4) has U30–U34 free under each 8192, plus U42–U47 in A3 and U43–U47 in A4.',
      'More 5164s: Aggregation (A5–A6) has U30–U38 free under each 5130.',
      'Waveserver E-Series: no space is set aside. A7 and A9 have U30–U39 free under the WSAi.',
    ],
    tradeoffs: [
      'Packet and optical share every rack, so no rack tells one story top to bottom.',
      'Aggregation (A5–A6) sits right of Converged Metro (A2–A4), so walking left to right the packet story goes access, metro, aggregation: out of order.',
      'The 6500 photonic and services shelves are mixed across A7–A9, and neither ring reads in ring order: the RLS nodes jump between A2, A3 and A4, and the 6500 nodes between A7, A8 and A9.',
    ],
  },
  {
    key: 'option-1-optical-core', title: 'Option 1: Optical core', short: 'Optical core', ...section(1),
    story: [
      'Whole sections of today\'s plan move between racks; nothing inside a rack moves.',
      'A1: Access over TDM. A2–A4: Datacenter Interconnect over 6500. A5–A7: Converged Metro over RLS, the central three racks. A8–A9: Aggregation over ELS.',
      'A10: DCOM and Outdoor.',
    ],
    growth: [
      'More 8100s: Converged Metro (A5–A7) has U30–U34 free under each 8192, plus U42–U47 in A6 and U43–U47 in A7.',
      'More 5164s: Aggregation (A8–A9) has U30–U38 free under each 5130.',
      'Waveserver E-Series: no space is set aside. A2 and A4 have U30–U39 free under the WSAi.',
    ],
    tradeoffs: [
      'The optical core (6500, RLS) sits in the middle of the row, with RLS on the central racks.',
      'Packet and optical still share every rack, and the packet story reads access, DCI, metro, aggregation: out of order.',
      'Neither ring reads in ring order: RLS nodes jump between A5, A6 and A7, and 6500 nodes between A2, A3 and A4.',
    ],
  },
  {
    key: 'option-2-edge-to-core', title: 'Option 2: Edge → core', short: 'Edge → core', ...section(2),
    story: [
      'Whole sections of today\'s plan move between racks; nothing inside a rack moves.',
      'A1: DCOM and Outdoor. A2: Access over TDM. A3–A4: Aggregation over ELS. A5–A7: Converged Metro over RLS. A8–A10: Datacenter Interconnect over 6500.',
      'DCOM and Outdoor move with their rack to A1, the edge end of the row.',
    ],
    growth: [
      'More 8100s: Converged Metro (A5–A7) has U30–U34 free under each 8192, plus U42–U47 in A6 and U43–U47 in A7.',
      'More 5164s: Aggregation (A3–A4) has U30–U38 free under each 5130.',
      'Waveserver E-Series: no space is set aside. A8 and A10 have U30–U39 free under the WSAi.',
    ],
    tradeoffs: [
      'The packet story reads in network order left to right: access, aggregation, metro, then DCI.',
      'RLS is on the central racks (A5–A7); the 6500 is at the far right.',
      'Packet and optical share every rack, and neither ring reads in ring order.',
    ],
  },
  {
    key: 'option-3-aggregation-left', title: 'Option 3: Aggregation left', short: 'Aggregation left', ...section(3),
    story: [
      'Whole sections of today\'s plan move between racks; nothing inside a rack moves.',
      'A1–A2: Aggregation over ELS. A3: DCOM and Outdoor. A4: Access over TDM. A5–A7: Converged Metro over RLS. A8–A10: Datacenter Interconnect over 6500.',
      'DCOM and Outdoor move with their rack to A3.',
    ],
    growth: [
      'More 8100s: Converged Metro (A5–A7) has U30–U34 free under each 8192, plus U42–U47 in A6 and U43–U47 in A7.',
      'More 5164s: Aggregation (A1–A2) has U30–U38 free under each 5130.',
      'Waveserver E-Series: no space is set aside. A8 and A10 have U30–U39 free under the WSAi.',
    ],
    tradeoffs: [
      'Aggregation and ELS open the row; RLS is on the central racks (A5–A7).',
      'The near-empty DCOM/Outdoor rack (A3) splits the packet sections.',
      'Packet and optical share every rack, and neither ring reads in ring order.',
    ],
  },
  {
    key: 'option-4-access-to-core', title: 'Option 4: Access to Core', short: 'Access to Core',
    name: 'Option 4 · Access to Core', desc: 'Access → Core · ELS / 6500 / RLS',
    plan: option4(),
    story: [
      'Top band, left to right: Access (A1), TDM (A2), Aggregation (A3–A4), Converged Metro (A5–A8), Datacenter Interconnect (A9).',
      'Optical layers stacked under it, top to bottom: ELS (A1–A4); 6500 (A2–A8), one ring node per rack in ring order: Canyon, Wind, Peak, Mountain, Breeze, then the two D7 services shelves; RLS (A3–A9), one ring node per rack in ring order: Americas, Atlantic, Europe, Asia, Pacific, then Downtown and Uptown.',
      'A10: DCOM and Outdoor.',
    ],
    fit: 'Converged Metro needs four racks (A5–A8) to keep the top band 8U deep, so the Waveserver 5 / WSAi pairs move into one Datacenter Interconnect rack (A9). The 6500 band is as deep as Canyon (14s + FMT + sign, 15U) and the RLS band as deep as Americas (3 OMC + R4-600 + FMT + sign, 9U), which puts the RLS nodes at U2–U10.',
    growth: [
      'Waveserver E-Series: A9 has U14–U43 free under the Datacenter Interconnect stack (30U).',
      'More 8100s: Converged Metro (A5–A8) is clear of the ELS band, so it can grow down to U32 (to U39 in A6).',
      'More 5164s: Aggregation (A3–A4) has only U39–U40 before the ELS band. More than 2U each means moving ELS or spilling into another rack.',
    ],
    tradeoffs: [
      'This is the only option where the packet story reads left to right in network order.',
      'Both rings read node by node in ring order across the row, but each ring is spread over five racks.',
      'The RLS band sits at U2–U13, at knee height.',
      'Aggregation is boxed in by the ELS band; Converged Metro and the right-hand racks have room.',
    ],
  },
  {
    key: 'option-5-photonic-center', title: 'Option 5: Photonic in the Center', short: 'Photonic center',
    name: 'Option 5 · Photonic in the Center', desc: 'Packet · RLS over 6500 · Services',
    plan: option5(),
    story: [
      'Left, route/switch: Access over TDM (A1), Aggregation (A2), Converged Metro (A3–A4).',
      'Center, photonic (A5–A7), both rings in ring order: RLS on top (Americas + Atlantic in A5, Europe + Asia in A6, Pacific + the Downtown/Uptown pair in A7); 6500 photonic below (Canyon + Wind in A5, Peak + Mountain in A6, Breeze in A7).',
      'Right, service interfaces (A8–A9): Waveserver 5 + WSAi on top, 6500-D7 services below.',
      'ELS is under Converged Metro in A4, right next to the photonic center: it is a line system, but the brief keeps the center for RLS and 6500.',
      'A10: DCOM and Outdoor.',
    ],
    fit: 'Fits in A1–A9 with no extra racks. The upper zones keep the usual U48 placard line, but the lower ones (TDM, ELS, 6500 Photonic, 6500 Services) sit at U23 instead of U27: a zone sign grows up to 9U into the clear space above its placard, and from U27 the 6500 Photonic sign would cover the node signs under the RLS nodes.',
    growth: [
      'Waveserver E-Series: A8–A9 have U26–U45 free (20U each) under the Waveserver 5 / WSAi, right in the service-interface zone.',
      'More 8100s: A3 has U1–U33 free under Converged Metro; A4 has U26–U35 before ELS.',
      'More 5164s: A2 has U1–U33 free under Aggregation.',
    ],
    tradeoffs: [
      'The photonic center (A5–A7) is the visual anchor and sits on the conference-table axis (A6).',
      'Service interfaces are grouped, so a client-to-line story (A8–A9 → A5–A7) is easy to tell.',
      'ELS is apart from RLS/6500, under the packet gear in A4.',
      'The lower halves of A2–A3 are empty, which looks unfinished until growth arrives.',
    ],
  },
  {
    key: 'option-6-vertical-slices', title: 'Option 6: Portfolio Vertical Slices', short: 'Vertical slices',
    name: 'Option 6 · Portfolio Vertical Slices', desc: 'One rack per product line',
    plan: option6(),
    story: [
      'One rack per product line, left to right: Access + TDM (A1), Aggregation (A2), Converged Metro (A3), ELS (A4), 6500 photonic (A5), 6500 services (A6), RLS (A7), Waveserver (A8).',
      'Each ring is one rack, top to bottom in ring order: 6500 Canyon, Wind, Peak, Mountain, Breeze (A5); RLS Americas, Atlantic, Europe, Asia, Pacific, then Downtown and Uptown (A7).',
      'ELS gets its own rack at A4, on the boundary between packet and optical: it is the access/edge line system, so it starts the optical half next to the packet racks that it carries.',
      'A9 is left empty for a future slice. A10: DCOM and Outdoor.',
    ],
    fit: 'The 6500 no longer fits in one rack: with a name sign under each ring node it needs 37U photonic + 16U services + two placards = 59U, one more than a 58U rack. The two D7 services shelves therefore get their own rack (A6) next to the photonic one, which pushes RLS to A7 and Waveserver to A8. RLS still fits in one rack (40U with signs + placard = 43U).',
    growth: [
      'Waveserver E-Series: A8 has 22U marked as reserved (U22–U43) under the Waveserver 5 / WSAi.',
      'More 8100s: A3 has U1–U21 free (21U) under Converged Metro.',
      'More 5164s: A2 has U1–U33 free (33U) under Aggregation.',
      'A9 is an empty rack for a new slice; A6 (6500 services) has U1–U31 free for more D7 shelves.',
    ],
    tradeoffs: [
      'Each rack is one product line, so it is easy to point at "the 6500 rack" or "the RLS rack".',
      'Each ring reads as one column: five signed nodes, terminals and amps, top to bottom.',
      'The 6500 takes two racks (photonic, services), so "one 6500 rack" becomes a pair; RLS moves to A7, one rack right of the conference-table axis.',
      'The network story is per product, not per network layer, and A9 looks empty until a new slice arrives.',
    ],
  },
];
