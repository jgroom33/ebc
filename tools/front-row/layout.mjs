// Shared occupancy maths for the front-row elevations: what fills each U of each rack.
import { RACKS, RACK_U, PLACARD_U, height, signLabel } from './options.mjs';

// Every occupied block of one option, per rack: devices, placards (one block in each rack
// they span), node name signs (1U) and reserved space. { kind, label, u, h }.
export function blocks(plan) {
  const out = Object.fromEntries(RACKS.map(r => [r, []]));
  for (const it of plan.items) out[it.rack].push({ kind: 'device', label: it.product, u: it.u, h: height(it.product) });
  for (const p of plan.placards) {
    const i = RACKS.indexOf(p.rack);
    for (let k = 0; k < p.span; k++) {
      const rack = RACKS[i + k];
      if (!rack) throw new Error(`placard '${p.label}' spans past ${RACKS.at(-1)}`);
      out[rack].push({ kind: 'placard', label: p.label, u: p.u, h: PLACARD_U });
    }
  }
  for (const r of plan.reserved) out[r.rack].push({ kind: 'reserved', label: r.label, u: r.u, h: r.h });
  for (const sg of plan.signs || []) out[sg.rack].push({ kind: 'sign', label: signLabel(sg.unit), u: sg.u, h: 1 });
  return out;
}

// U used / free per rack. Signs and reserved space count as used (they are spoken for).
export function usage(plan) {
  const res = {};
  for (const [rack, bs] of Object.entries(blocks(plan))) {
    const sum = (k) => bs.filter(b => b.kind === k).reduce((n, b) => n + b.h, 0);
    const devices = sum('device'), placards = sum('placard'), reserved = sum('reserved'), signs = sum('sign');
    const used = devices + placards + reserved + signs;
    res[rack] = { devices, placards, signs, reserved, used, free: RACK_U - used, freeRanges: freeRanges(bs) };
  }
  return res;
}

// Free U as 'U1–U21' style ranges, bottom up.
export function freeRanges(bs) {
  const occ = new Set();
  for (const b of bs) for (let u = b.u; u < b.u + b.h; u++) occ.add(u);
  const ranges = [];
  for (let u = 1; u <= RACK_U; u++) {
    if (occ.has(u)) continue;
    const start = u;
    while (u + 1 <= RACK_U && !occ.has(u + 1)) u++;
    ranges.push(start === u ? `U${u}` : `U${start}–U${u}`);
  }
  return ranges;
}
