// Rack layouts shared by index.html (the room, ?layout=N) and morph.html (the room → network
// morph): the layout list, and the lab data each layout makes from the baked LAB_RACKS (devices per
// rack and U, zone signs, ring-node signs), plus where each zone sign goes and the sign canvases.
// Moved here unchanged from index.html so both pages lay the racks out with the same code.
// No three.js here; the sign helpers draw onto a canvas, each page wraps it in its own mesh.
import { OPTIONS as FRONT_ROW_OPTIONS, TODAY as FRONT_ROW_TODAY, RACKS as FRONT_RACKS,
         PLACARD_U, UNITS as FRONT_ROW_UNITS, height as productU } from './tools/front-row/options.mjs';

export const RACK_U = 58;                 // rack height in rack units

// The layouts and their lab data, for one baked LAB_RACKS (index.html's generated block).
export function createLabLayouts(LAB_RACKS) {
  // Front-row layout options (RLS centred) for the iPad "Rack Layout" tile / ?layout=N.
  // Each lists the baked racks' CURRENT display orders as section blocks, in their new
  // left→right sequence — so a section's devices, signs, placards, fibers and ring move
  // with it as one block. Racks never move; RLS lands on A5–A7, the most central 3 racks
  // (A6 is ~7.5" right of the conference-table axis). The back row never changes.
  const RACK_LAYOUTS = [
    { name: 'Current',  desc: 'TDM · RLS · ELS · 6500 · Outdoor',
      blocks: [[1], [2, 3, 4], [5, 6], [7, 8, 9], [10]] },
    { name: 'Option 1 · Optical core', desc: 'TDM · 6500 · RLS · ELS · Outdoor',
      blocks: [[1], [7, 8, 9], [2, 3, 4], [5, 6], [10]] },
    { name: 'Option 2 · Edge → core', desc: 'Outdoor · TDM · ELS · RLS · 6500',
      blocks: [[10], [1], [5, 6], [2, 3, 4], [7, 8, 9]] },
    { name: 'Option 3 · Aggregation left', desc: 'ELS · Outdoor · TDM · RLS · 6500',
      blocks: [[5, 6], [10], [1], [2, 3, 4], [7, 8, 9]] },
    // Options 4–6 (?layout=4..6) re-arrange individual devices instead of whole sections:
    // tools/front-row/options.mjs places every front-row device, zone sign and ring-node
    // sign at its own rack and U. Its OPTIONS list all 7 entries in bar order (the 4 above
    // are its SECTION_LAYOUTS, which tools/front-row/check.mjs keeps equal to these).
    ...FRONT_ROW_OPTIONS.filter(o => !o.blocks),
    // Option 9 (?layout=9; `id` keeps the URL number apart from its place on the bar): starts
    // from `base` (Option 1) and re-places devices on top of it. Bottom of the racks photonic,
    // the layer above it transport, packet on top as in Option 1. See moveLabData for the keys.
    { id: 9, base: 1, name: 'Option 9 · Photonic on the bottom',
      desc: 'IP · Transport · Photonic bands',
      // Lower (photonic) sections only — devices topping out below U30; packet stays put.
      // The 6500 (A2–A4) and the RLS (A5–A7) stay where Option 1 has them: no shift.
      moves: [
        // TDM leaves the front row: an empty back-row rack, same U as in A1.
        { name: '3926-TDM-2', rack: 'B4', ru: 19 }, { name: '3926-TDM-1', rack: 'B4', ru: 20 },
        { name: '3926-Combo-2', rack: 'B4', ru: 21 }, { name: '3926-Combo-1', rack: 'B4', ru: 22 },
        // 6500-D7 services shelves (+ FMTs) to A1, under Access, where TDM was: tops at U26 like
        // the photonic nodes, so their sign shares the lower-sign band (U27–U34).
        { name: '6500-D7-2-FMT', rack: 'A1', ru: 11 }, { name: '6500-D7-2', rack: 'A1', ru: 12 },
        { name: '6500-D7-1-FMT', rack: 'A1', ru: 19 }, { name: '6500-D7-1', rack: 'A1', ru: 20 },
        // RLS-300 pair on A8–A9, one node per rack, tops at U26 like the other photonic nodes
        // (node sign U23, FMT U24, R2-300 U25–U26).
        { name: 'Uptown-FMT', rack: 'A8', ru: 24 }, { name: 'Uptown', rack: 'A8', ru: 25 },
        { name: 'Downtown-FMT', rack: 'A9', ru: 24 }, { name: 'Downtown', rack: 'A9', ru: 25 },
        // ELS under the RLS-300 nodes, ELS-x-1 in A8 and ELS-x-2 in A9, same order and 1U gaps
        // as before (terminal, OADM, terminal, OADM), packed down to U5–U13 so the ELS sign
        // fits U14–U22 between them and the RLS-300 node signs.
        { name: 'ELS-2-T-1', rack: 'A8', ru: 5 }, { name: 'ELS-2-O-1', rack: 'A8', ru: 8 },
        { name: 'ELS-1-T-1', rack: 'A8', ru: 10 }, { name: 'ELS-1-O-1', rack: 'A8', ru: 13 },
        { name: 'ELS-2-T-2', rack: 'A9', ru: 5 }, { name: 'ELS-2-O-2', rack: 'A9', ru: 8 },
        { name: 'ELS-1-T-2', rack: 'A9', ru: 10 }, { name: 'ELS-1-O-2', rack: 'A9', ru: 13 },
      ],
      // Three bands across A2–A9, as in the morph's layers. TOP = IP: Converged Metro and
      // Aggregation as one 'Metro & Aggregation' block, U42 up (sign U49+). Each Converged
      // Metro group (one 8192 with its gear) spans two adjacent racks over the 6500 / RLS;
      // Aggregation stays over the ELS (A8–A9). MIDDLE = transport: the Waveserver / WSAi links
      // at U35 (just above the photonic signs), one over the 6500 and one over the RLS, under
      // one 'Datacenter Interconnect and Waveserver' sign (U36–U41).
      stacks: [                                     // bottom-up from `ru`, no gaps
        // A pair is a fibered link: WSAi WS-2P ↔ WS-1P (400G) stays over the 6500 (A2, A4); the
        // Waveserver 5 West ↔ East (800G) moves over the RLS, its ends in A5 and A7 the same way.
        { rack: 'A2', ru: 35, names: ['WS-2P'] }, { rack: 'A4', ru: 35, names: ['WS-1P'] },
        { rack: 'A5', ru: 35, names: ['Waveserver-5-West-1'] }, { rack: 'A7', ru: 35, names: ['Waveserver-5-East-1'] },
        { rack: 'A2', ru: 42, names: ['8192-1', '8114-1', '8114-2'] },
        { rack: 'A3', ru: 42, names: ['5166-1', '5170-4', '5170-3', '5170-2', '5170-1'] },
        { rack: 'A4', ru: 42, names: ['8192-2', '8110-1'] },
        { rack: 'A5', ru: 42, names: ['8110-3', '5166-2'] },
        { rack: 'A6', ru: 42, names: ['8192-3', '8110-4'] },
        { rack: 'A7', ru: 42, names: ['8112-2', '8112-1', '8110-2'] },
        { rack: 'A8', ru: 42, names: ['5130-1', '5171-1', '5164-5', '5164-6', '5164-7', '5164-8'] },
        { rack: 'A9', ru: 42, names: ['5130-2', '5171-2', '5164-1', '5164-2', '5164-3', '5164-4'] },
      ],
      dropZones: ['TDM', 'DCOM', 'Outdoor', 'ELS', 'Converged Metro', 'Aggregation', 'Datacenter Interconnect'],
      addZones: [
        { rackStart: 'A2', rackEnd: 'A9', label: 'Metro & Aggregation', ru: 49, h: 3, keepAspect: true },
        { rackStart: 'A2', rackEnd: 'A9', label: 'Datacenter Interconnect and Waveserver', ru: 36, h: 3, keepAspect: true },
        { rackStart: 'A1', rackEnd: 'A1', label: '6500 Services', ru: 28, h: 3 },
        { rackStart: 'A8', rackEnd: 'A9', label: 'RLS-300', ru: 28, h: 3 },
        { rackStart: 'A8', rackEnd: 'A9', label: 'ELS', ru: 14, h: 3 },
      ],
      // Signs that share the lower band (U27–U34); ELS is left out, so its sign sits in its own
      // gap above the ELS gear.
      alignedZones: ['6500', 'RLS', '6500 Services', 'RLS-300'] },
  ];
  // ?layout=N picks the entry whose `id` is N (an entry's id defaults to its bar position).
  const layoutId = (i) => RACK_LAYOUTS[i].id ?? i;
  // A copy of LAB_RACKS with the front row re-ordered per `layout` (old order → new order).
  function remapLabRacks(layout) {
    const newOf = new Map();
    layout.blocks.flat().forEach((o, i) => newOf.set(o, i + 1));
    const mapId = (id) => (id[0] === 'A' && newOf.has(+id.slice(1))) ? 'A' + newOf.get(+id.slice(1)) : id;
    const racks = {};
    for (const [id, rk] of Object.entries(LAB_RACKS.racks))
      racks[mapId(id)] = rk.row === 'front' ? { ...rk, order: newOf.get(rk.order) ?? rk.order } : rk;
    const zones = LAB_RACKS.zones.map(z => {
      const a = +mapId(z.rackStart).slice(1), b = +mapId(z.rackEnd).slice(1);
      return { ...z, rackStart: 'A' + Math.min(a, b), rackEnd: 'A' + Math.max(a, b) };
    });
    const placards = (LAB_RACKS.placards || []).map(p => ({ ...p, rack: mapId(p.rack) }));
    return { racks, zones, fibers: LAB_RACKS.fibers, rings: LAB_RACKS.rings, placards };
  }

  // Options 4–6: the baked front-row devices are today's plan, so match each to its
  // options.mjs entry by rack + U. Devices in a unit (a ring node with its OMCs/FMT, an
  // RLS-300 node, a D7 + FMT) are keyed by unit + part index, so a node keeps its own named
  // parts; the rest go in per-product queues (in TODAY order) and an option takes the k-th
  // device of a product for its k-th loose entry of it. Fibers and rings (keyed by device
  // name) follow the devices.
  const frontDeviceOf = (() => {
    const byUnit = new Map(), byProduct = new Map(), seen = {};
    for (const it of FRONT_ROW_TODAY.items) {
      const d = LAB_RACKS.racks[it.rack]?.devices.find(dv => dv.ru === it.u && dv.h === productU(it.product))
        || (console.warn(`front row: no baked device for ${it.product} at ${it.rack} U${it.u}`),
            { name: `${it.product} ${it.rack} U${it.u}`, state: 'planned' });
      if (it.unit) byUnit.set(`${it.unit}#${seen[it.unit] = (seen[it.unit] ?? -1) + 1}`, d);
      else { if (!byProduct.has(it.product)) byProduct.set(it.product, []); byProduct.get(it.product).push(d); }
    }
    return { byUnit, byProduct };
  })();

  const nodeSignsOf = (plan) =>
    (plan.signs || []).map(sg => ({ unit: sg.unit, role: FRONT_ROW_UNITS[sg.unit].role, rack: sg.rack, ru: sg.u }));

  // LAB_RACKS with the front row laid out per an options.mjs option (layouts 4–6). Zones use
  // the baked convention (ru = the placard's middle U), so the signs are sized exactly like
  // the baked ones; ring-node signs come from the option.
  function frontRowLabData(layout) {
    const { items, placards: zonePlacards, reserved, signs } = layout.plan;
    const racks = {};
    for (const [id, rk] of Object.entries(LAB_RACKS.racks))
      racks[id] = rk.row === 'front' ? { ...rk, devices: [], reserved: [] } : rk;
    const queues = new Map([...frontDeviceOf.byProduct].map(([p, ds]) => [p, [...ds]]));
    const partIdx = {};
    // Unit parts in top-down order, so part k of a unit maps to part k of today's unit.
    for (const it of [...items].sort((a, b) => b.u - a.u)) {
      const d = it.unit
        ? frontDeviceOf.byUnit.get(`${it.unit}#${partIdx[it.unit] = (partIdx[it.unit] ?? -1) + 1}`)
        : queues.get(it.product).shift();
      racks[it.rack].devices.push({ name: d.name, ru: it.u, h: productU(it.product), state: d.state });
    }
    for (const r of reserved) racks[r.rack].reserved.push({ ru: r.u, h: r.h, label: r.label });
    const zones = zonePlacards.map(z => ({
      rackStart: z.rack, rackEnd: FRONT_RACKS[FRONT_RACKS.indexOf(z.rack) + z.span - 1],
      label: z.label, ru: z.u + Math.floor(PLACARD_U / 2), h: PLACARD_U,
    }));
    const nodeSigns = nodeSignsOf(layout.plan);
    // alignLower: false — the baked layout's shared lower-section sign band only fits the
    // section-reorder layouts; here each zone sign sits in its own clear gap.
    return { racks, zones, fibers: LAB_RACKS.fibers, rings: LAB_RACKS.rings, placards: [], nodeSigns, alignLower: false };
  }
  // A layout with `base` (Option 9) is that layout's lab data with devices re-placed:
  //   shift:  [{ racks, by, belowRU, zones }] — every device in `racks` whose top U is under
  //           belowRU moves `by` racks (all rules read the base, so chains don't cascade), and
  //           the named zones move with it;
  //   moves:  [{ name, rack, ru }] — one device to any rack (front or back) and U; wins over shift;
  //   stacks: [{ rack, ru, names }] — devices stacked bottom-up from `ru` with no gaps (moves);
  //   dropZones / addZones — zone signs removed / added;
  //   alignedZones — the zone labels that share one lower sign band, in place of the default
  //                  6500 / ELS / RLS / TDM.
  // A ring-node sign follows the device just above it (its node's bottom part). Fibers and
  // rings are keyed by device name, so they follow on their own.
  function moveLabData(base, L) {
    const hOf = new Map(Object.values(base.racks).flatMap(rk => rk.devices.map(d => [d.name, d.h])));
    const moveOf = new Map((L.moves || []).map(m => [m.name, m]));
    for (const st of L.stacks || []) {
      let ru = st.ru;
      for (const name of st.names) {
        if (!hOf.has(name)) console.error(`layout ${L.name}: no device '${name}' to stack`);
        moveOf.set(name, { name, rack: st.rack, ru }); ru += hOf.get(name) ?? 1;
      }
    }
    const shiftRack = (id, d) => {
      const s = (L.shift || []).find(s => s.racks.includes(id) && d.ru + d.h - 1 < s.belowRU);
      return s ? 'A' + (+id.slice(1) + s.by) : id;
    };
    const racks = {}, slot = new Map();          // slot: 'rack:U' in base -> new { rack, ru }
    for (const [id, rk] of Object.entries(base.racks)) racks[id] = { ...rk, devices: [] };
    for (const [id, rk] of Object.entries(base.racks)) for (const d of rk.devices) {
      const m = moveOf.get(d.name), to = m ? { rack: m.rack, ru: m.ru } : { rack: shiftRack(id, d), ru: d.ru };
      racks[to.rack].devices.push({ ...d, ru: to.ru });
      slot.set(`${id}:${d.ru}`, to);
    }
    const zoneBy = (label) => (L.shift || []).find(s => (s.zones || []).includes(label))?.by ?? 0;
    const zones = [
      ...base.zones.filter(z => !(L.dropZones || []).includes(z.label)).map(z => {
        const by = zoneBy(z.label);
        return by ? { ...z, rackStart: 'A' + (+z.rackStart.slice(1) + by), rackEnd: 'A' + (+z.rackEnd.slice(1) + by) } : z;
      }),
      ...(L.addZones || []),
    ];
    const nodeSigns = (base.nodeSigns || []).map(ns => {
      const to = slot.get(`${ns.rack}:${ns.ru + 1}`);
      return to ? { ...ns, rack: to.rack, ru: to.ru - 1 } : ns;
    });
    // Sanity: every device inside its rack and no two overlapping (a bad entry shows up as a
    // console error rather than gear drawn through gear).
    for (const [id, rk] of Object.entries(racks)) {
      const used = new Map();
      for (const d of rk.devices) for (let u = d.ru; u < d.ru + d.h; u++) {
        if (u < 1 || u > RACK_U) console.error(`layout ${L.name}: ${d.name} outside ${id} (U${u})`);
        if (used.has(u)) console.error(`layout ${L.name}: ${d.name} overlaps ${used.get(u)} in ${id} U${u}`);
        used.set(u, d.name);
      }
    }
    return { ...base, racks, zones, nodeSigns, alignedZones: L.alignedZones };
  }

  // Layouts 0–3 re-order sections; every layout takes its ring-node signs from options.mjs
  // (OPTIONS is in bar order), in place of the baked RLS name plates.
  const labDataFor = (i) => {
    const L = RACK_LAYOUTS[i];
    if (L.base != null) return moveLabData(labDataFor(L.base), L);
    if (!L.blocks) return frontRowLabData(L);
    return { ...remapLabRacks(L), placards: [], nodeSigns: nodeSignsOf(FRONT_ROW_OPTIONS[i].plan) };
  };
  return { RACK_LAYOUTS, layoutId, labDataFor };
}

// Where each zone sign goes: in the clear RU gap above its equipment (so it never overlaps gear),
// the labels in labData.alignedZones (default 6500 / ELS / RLS / TDM) sharing one aligned band —
// the clear gap common to their racks. One entry per zone: { zone, bottom, hRU } (U of the sign's
// bottom, height in U); a page skips hRU < 2 and 'Outdoor Units', as index.html always has.
export function zoneSignBands(labData) {
  const orderOf = (id) => parseInt(id.slice(1), 10);
  const occupiedFor = (rackStart, rackEnd) => {
    const occ = new Array(60).fill(false);
    for (let o = orderOf(rackStart); o <= orderOf(rackEnd); o++)
      for (const d of (labData.racks['A' + o]?.devices || []))
        for (let ru = d.ru; ru < d.ru + d.h; ru++) if (ru >= 1 && ru <= 59) occ[ru] = true;
    return occ;
  };
  const gapBand = (occ, anchor) => {                 // clear gap around the anchor RU
    let bottom = anchor; while (bottom <= 58 && occ[bottom]) bottom++;
    while (bottom - 1 >= 1 && !occ[bottom - 1]) bottom--;
    let top = bottom; while (top + 1 <= 58 && !occ[top + 1]) top++;
    return { bottom, hRU: Math.min(9, top - bottom + 1 - 0.5) };
  };
  const ALIGNED = new Set(labData.alignedZones || ['6500', 'ELS', 'RLS', 'TDM']);
  const lowerZones = labData.alignLower === false ? [] : labData.zones.filter(z => ALIGNED.has(z.label));
  let alignedBand = null;
  if (lowerZones.length) {
    const occ = new Array(60).fill(false);
    for (const z of lowerZones) { const o2 = occupiedFor(z.rackStart, z.rackEnd); for (let i = 0; i < 60; i++) if (o2[i]) occ[i] = true; }
    alignedBand = gapBand(occ, lowerZones[0].ru);
  }
  return labData.zones.map((z) => {
    const { bottom, hRU } = (ALIGNED.has(z.label) && alignedBand)
      ? alignedBand
      : (() => { let b = z.ru, occ = occupiedFor(z.rackStart, z.rackEnd);
          while (b <= 58 && occ[b]) b++; let t = b; while (t + 1 <= 58 && !occ[t + 1]) t++;
          return { bottom: b, hRU: Math.min(9, t - b + 1 - 0.5) }; })();
    return { zone: z, bottom, hRU };
  });
}

// A zone sign's canvas: dark-slate plate, Ciena-red base bar, white label shrunk to fit.
// keepAspect: size the canvas to the sign's aspect (up to 4096 px wide) instead of 1024 px with a
// 128 px floor, which stretches the text on very wide, short signs (Option 9's 8-rack bands).
export function bigLabelCanvas(text, wM, hM, { keepAspect = false } = {}) {
  const cv = document.createElement('canvas');
  if (keepAspect) { cv.width = Math.min(4096, Math.round(256 * wM / hM)); cv.height = Math.round(cv.width * hM / wM); }
  else { cv.width = 1024; cv.height = Math.max(128, Math.round(1024 * hM / wM)); }
  const ctx = cv.getContext('2d'), W = cv.width, Hc = cv.height;
  ctx.fillStyle = '#1b2838'; ctx.fillRect(0, 0, W, Hc);        // solid dark-slate plate
  ctx.fillStyle = '#e4002b'; ctx.fillRect(0, Hc - Hc * 0.09, W, Hc * 0.09);  // Ciena-red base bar
  ctx.fillStyle = '#ffffff';
  const font = (s) => `700 ${s}px "Segoe UI", Arial, sans-serif`;
  let fs = Math.round(Hc * 0.62);                              // shrink to fit narrow signs
  ctx.font = font(fs);
  while (ctx.measureText(text).width > W * 0.9 && fs > 12) { fs -= 4; ctx.font = font(fs); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, Hc / 2 - Hc * 0.02);
  return cv;
}

// Ring-node name sign's canvas: dark plate with the node name, and a coloured role tag on the
// right (blue TERMINAL, orange AMP, gray RLS-300) — the same look as the SVG elevations.
export const ROLE_COLOR = { Terminal: '#0056b4', Amp: '#c2410c', 'RLS-300': '#4b5563' };
export function nodeSignCanvas(name, role, wM, hM) {
  const cv = document.createElement('canvas');
  cv.height = 96; cv.width = Math.min(4096, Math.round(96 * wM / hM));
  const ctx = cv.getContext('2d'), W = cv.width, Hc = cv.height, tagW = W * 0.36;
  ctx.fillStyle = '#1b2838'; ctx.fillRect(0, 0, W, Hc);
  ctx.fillStyle = ROLE_COLOR[role] || '#4b5563'; ctx.fillRect(W - tagW, 0, tagW, Hc);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff'; ctx.font = '800 66px "Segoe UI", Arial, sans-serif';
  ctx.fillText(name, (W - tagW) / 2, Hc / 2 + 3);
  ctx.font = '800 50px "Segoe UI", Arial, sans-serif';
  ctx.fillText(role.toUpperCase(), W - tagW / 2, Hc / 2 + 3);
  return cv;
}
