// Zone-sign sizes, computed the way the 3D scene sizes its section signs (index.html,
// buildLab "Section signage"), so the SVG elevations draw them the same size.
//
// A zone's placard anchor is its middle U. Its sign fills the clear gap (devices only) from
// the first free U at or above the anchor, up to 9U, stopping half a U short of the next
// device. With alignLower (the baked layout and its section re-orders) the TDM / RLS / ELS /
// 6500 signs instead share one band: the clear gap common to all their racks around the first
// of them's anchor. A sign under 2U is not drawn.
import { RACKS, RACK_U, PLACARD_U, height } from './options.mjs';

const ALIGNED = new Set(['6500', 'ELS', 'RLS', 'TDM']);

// [{ label, rackStart, rackEnd, span, bottom, hRU }] for the zone signs that get drawn.
export function zoneSigns(plan, { alignLower = false } = {}) {
  const zones = plan.placards.map(p => ({
    label: p.label, span: p.span, rackStart: p.rack,
    rackEnd: RACKS[RACKS.indexOf(p.rack) + p.span - 1], ru: p.u + Math.floor(PLACARD_U / 2),
  }));
  const occupiedFor = (rackStart, rackEnd) => {
    const occ = new Array(60).fill(false);
    for (let i = RACKS.indexOf(rackStart); i <= RACKS.indexOf(rackEnd); i++)
      for (const it of plan.items.filter(it => it.rack === RACKS[i]))
        for (let ru = it.u; ru < it.u + height(it.product); ru++) if (ru >= 1 && ru <= 59) occ[ru] = true;
    return occ;
  };
  const gapBand = (occ, anchor) => {
    let bottom = anchor; while (bottom <= RACK_U && occ[bottom]) bottom++;
    while (bottom - 1 >= 1 && !occ[bottom - 1]) bottom--;
    let top = bottom; while (top + 1 <= RACK_U && !occ[top + 1]) top++;
    return { bottom, hRU: Math.min(9, top - bottom + 1 - 0.5) };
  };
  const lowerZones = alignLower ? zones.filter(z => ALIGNED.has(z.label)) : [];
  let alignedBand = null;
  if (lowerZones.length) {
    const occ = new Array(60).fill(false);
    for (const z of lowerZones) { const o2 = occupiedFor(z.rackStart, z.rackEnd); for (let i = 0; i < 60; i++) if (o2[i]) occ[i] = true; }
    alignedBand = gapBand(occ, lowerZones[0].ru);
  }
  const out = [];
  for (const z of zones) {
    const { bottom, hRU } = (ALIGNED.has(z.label) && alignedBand)
      ? alignedBand
      : (() => { let b = z.ru; const occ = occupiedFor(z.rackStart, z.rackEnd);
          while (b <= RACK_U && occ[b]) b++; let t = b; while (t + 1 <= RACK_U && !occ[t + 1]) t++;
          return { bottom: b, hRU: Math.min(9, t - b + 1 - 0.5) }; })();
    if (hRU < 2) continue;
    out.push({ label: z.label, rackStart: z.rackStart, rackEnd: z.rackEnd, span: z.span, bottom, hRU });
  }
  return out;
}
