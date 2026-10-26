#!/usr/bin/env node
// Checks every front-row option against today's plan:
//   - places every device of today's plan exactly once (same products, same counts),
//   - every block sits inside U1–U58 and no two blocks in a rack overlap,
//   - every rack is at or under 58U, every placard is 3U.
// Exits non-zero on any failure.
//
//   node tools/front-row/check.mjs
import { OPTIONS, TODAY, RACKS, RACK_U } from './options.mjs';
import { blocks, usage } from './layout.mjs';

const count = (items) => {
  const m = new Map();
  for (const it of items) m.set(it.product, (m.get(it.product) || 0) + 1);
  return m;
};
const want = count(TODAY.items);

let failed = 0;
for (const opt of OPTIONS) {
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

  const n = opt.plan.items.length;
  const maxUsed = Math.max(...RACKS.map(r => use[r].used));
  const line = `${opt.title.padEnd(36)} ${String(n).padStart(3)} devices (plan ${TODAY.items.length}), ` +
    `${opt.plan.placards.length} placards, fullest rack ${maxUsed}/${RACK_U}U`;
  if (errs.length) {
    failed++;
    console.log(`FAIL ${line}`);
    for (const e of errs) console.log(`     - ${e}`);
  } else console.log(`ok   ${line}`);
}
console.log(failed ? `\n${failed} option(s) failed` : `\nall ${OPTIONS.length} options pass: every device placed exactly once, no overlaps, every rack <= ${RACK_U}U`);
process.exit(failed ? 1 : 0);
