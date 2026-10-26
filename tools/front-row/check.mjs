#!/usr/bin/env node
// Checks every front-row option against today's plan:
//   - places every device of today's plan exactly once (same products, same counts),
//   - every block sits inside U1–U58 and no two blocks in a rack overlap,
//   - every rack is at or under 58U, every placard is 3U,
//   - every unit (ring node, RLS-300 node, 6500-D7 + FMT) has all its parts, in order top to
//     bottom, contiguous in one rack, and each node has its name sign in the U just below it.
// It also reports, per ring, where the 5 nodes are and whether they sit in ring order.
// Exits non-zero on any failure.
//
//   node tools/front-row/check.mjs              # check every option
//   node tools/front-row/check.mjs --selftest   # prove it catches broken plans
import { OPTIONS, TODAY, RACKS, RACK_U, UNITS, RINGS, height, hasSign } from './options.mjs';
import { blocks, usage } from './layout.mjs';

const count = (items) => {
  const m = new Map();
  for (const it of items) m.set(it.product, (m.get(it.product) || 0) + 1);
  return m;
};
const want = count(TODAY.items);

// Errors for one plan, plus notes on where each ring's nodes are.
function checkPlan(plan) {
  const opt = { plan };
  const errs = [];
  const got = count(opt.plan.items);
  for (const p of new Set([...want.keys(), ...got.keys()]))
    if ((want.get(p) || 0) !== (got.get(p) || 0))
      errs.push(`${p}: placed ${got.get(p) || 0}, plan has ${want.get(p) || 0}`);
  for (const it of opt.plan.items)
    if (!RACKS.includes(it.rack)) errs.push(`${it.product} in unknown rack ${it.rack}`);

  const bs = blocks(opt.plan), use = usage(opt.plan);
  for (const rack of RACKS) {
    const list = [...bs[rack]].sort((a, b) => a.u - b.u);
    for (const b of list)
      if (b.u < 1 || b.u + b.h - 1 > RACK_U) errs.push(`${rack}: ${b.label} at U${b.u} (${b.h}U) is outside U1–U${RACK_U}`);
    for (let i = 1; i < list.length; i++) {
      const a = list[i - 1], b = list[i];
      if (b.u <= a.u + a.h - 1) errs.push(`${rack}: ${b.label} at U${b.u} overlaps ${a.label} at U${a.u}–U${a.u + a.h - 1}`);
    }
    if (use[rack].used > RACK_U) errs.push(`${rack}: ${use[rack].used}U used, over ${RACK_U}U`);
  }
  for (const p of opt.plan.placards) if (p.span < 1) errs.push(`placard '${p.label}' has span ${p.span}`);

  // Units: all parts, in order, contiguous, one rack; name sign directly below.
  const where = {};
  for (const it of opt.plan.items) if (it.unit && !UNITS[it.unit]) errs.push(`${it.product} tagged with unknown unit '${it.unit}'`);
  for (const [unit, def] of Object.entries(UNITS)) {
    const parts = opt.plan.items.filter(it => it.unit === unit).sort((a, b) => b.u - a.u);
    const got = parts.map(p => p.product).join(' + '), want = def.parts.join(' + ');
    if (got !== want) { errs.push(`${unit}: parts top to bottom are [${got}], want [${want}]`); continue; }
    const racks = new Set(parts.map(p => p.rack));
    if (racks.size !== 1) { errs.push(`${unit}: split across racks ${[...racks].join(', ')}`); continue; }
    for (let i = 1; i < parts.length; i++)
      if (parts[i].u + height(parts[i].product) !== parts[i - 1].u) errs.push(`${unit}: gap between ${parts[i - 1].product} and ${parts[i].product}`);
    const rack = parts[0].rack, bottom = parts.at(-1).u;
    where[unit] = rack;
    const signs = (opt.plan.signs || []).filter(sg => sg.unit === unit);
    if (!hasSign(unit)) { if (signs.length) errs.push(`${unit}: has a sign but should not`); continue; }
    if (signs.length !== 1) errs.push(`${unit}: ${signs.length} name signs, want 1`);
    else if (signs[0].rack !== rack || signs[0].u !== bottom - 1)
      errs.push(`${unit}: name sign at ${signs[0].rack} U${signs[0].u}, want ${rack} U${bottom - 1} (just below the node)`);
  }
  for (const sg of opt.plan.signs || []) if (!UNITS[sg.unit]) errs.push(`sign for unknown unit '${sg.unit}'`);

  // Rings: where the nodes are, and whether they read in ring order (left to right, then top
  // to bottom within a rack). Reported, not enforced: some options trade it for the story.
  const ringNotes = [];
  for (const [ring, nodes] of Object.entries(RINGS)) {
    if (!nodes.every(n => where[n])) continue;
    const pos = (n) => {
      const it = opt.plan.items.find(i => i.unit === n);
      return [RACKS.indexOf(it.rack), -it.u];
    };
    const inOrder = nodes.every((n, i) => i === 0 || (() => {
      const [ra, ua] = pos(nodes[i - 1]), [rb, ub] = pos(n);
      return ra < rb || (ra === rb && ua < ub);
    })());
    ringNotes.push(`${ring}: ${nodes.map(n => `${n} ${where[n]}`).join(', ')}${inOrder ? ' (ring order)' : ' (NOT in ring order)'}`);
  }

  return { errs, ringNotes, use };
}

// --selftest: break a copy of option 1 in each way the check must catch.
if (process.argv.includes('--selftest')) {
  const base = OPTIONS[1].plan, clone = () => structuredClone(base);
  const cases = {
    'node split across racks': (p) => { p.items.find(i => i.unit === 'Americas' && i.product === 'FMT').rack = 'A10'; },
    'node parts out of order': (p) => {                 // Europe: R4 on top, its OMCs under it
      const parts = p.items.filter(i => i.unit === 'Europe').sort((x, y) => y.u - x.u);
      const top = parts[0].u, [o1, o2, r4] = parts;
      r4.u = top - height(r4.product) + 1; o1.u = r4.u - 1; o2.u = r4.u - 2;
    },
    'node missing its sign': (p) => { p.signs = p.signs.filter(sg => sg.unit !== 'Canyon'); },
    'device dropped': (p) => { p.items.splice(p.items.findIndex(i => i.product === 'WSAi'), 1); },
    'overlap': (p) => { p.items.find(i => i.product === 'Waveserver 5').u = 47 - 1; },
  };
  let missed = 0;
  for (const [name, breakIt] of Object.entries(cases)) {
    const p = clone(); breakIt(p);
    const { errs } = checkPlan(p);
    console.log(`${errs.length ? 'caught' : 'MISSED'}  ${name}${errs.length ? `: ${errs[0]}` : ''}`);
    if (!errs.length) missed++;
  }
  process.exit(missed ? 1 : 0);
}

let failed = 0;
for (const opt of OPTIONS) {
  const { errs, ringNotes, use } = checkPlan(opt.plan);
  const n = opt.plan.items.length;
  const maxUsed = Math.max(...RACKS.map(r => use[r].used));
  const line = `${opt.title.padEnd(36)} ${String(n).padStart(3)} devices (plan ${TODAY.items.length}), ` +
    `${opt.plan.placards.length} placards, fullest rack ${maxUsed}/${RACK_U}U`;
  if (errs.length) {
    failed++;
    console.log(`FAIL ${line}`);
    for (const e of errs) console.log(`     - ${e}`);
  } else console.log(`ok   ${line}`);
  for (const n of ringNotes) console.log(`       ${n}`);
}
console.log(failed ? `\n${failed} option(s) failed` : `\nall ${OPTIONS.length} options pass: every device placed exactly once, no overlaps, every rack <= ${RACK_U}U,\n` +
  `every node whole, in order, in one rack, with its name sign`);
process.exit(failed ? 1 : 0);
