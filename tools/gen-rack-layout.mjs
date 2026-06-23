#!/usr/bin/env node
// Generates the baked lab-rack layout data for index.html from the EBC "split"
// concept CSVs in the sibling ebc-inventory repo, and writes it into index.html
// between the /* LAB-RACKS-START */ … /* LAB-RACKS-END */ markers.
//
// Front display row A1–A10 only (the glass-facing lineup), full detail:
// device blocks (coloured by type, planned/deployed), zone bands, fiber spans.
//
// Regenerate after editing the inventory:  node tools/gen-rack-layout.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const INV = resolve(here, '../../ebc-inventory/lab-rack-layout');
const INDEX = resolve(here, '../index.html');

// Minimal CSV parser (handles quoted fields with commas, e.g. "6,3").
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}
function readTable(rel) {
  const rows = parseCSV(readFileSync(resolve(INV, rel), 'utf8'));
  const head = rows[0];
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

// device_type -> {u, color}
const types = {};
for (const d of readTable('data/device_types.csv')) {
  types[d.device_type] = { u: parseInt(d.u_height, 10) || 1, color: d.color || '#A0AEC0' };
}

// All racks from racks.csv (front row A1..A10 + back row B2..B8), each with its
// row + left-right display order and a list of devices placed by RU.
const meta = {};
for (const r of readTable('data/racks.csv')) {
  meta[r.rack_id] = { row: r.row, order: parseInt(r.display_order, 10) };
}
const racks = Object.fromEntries(Object.keys(meta).map(id => [id, []]));
for (const p of readTable('data/ebc/split/rack_layout.csv')) {
  if (!racks[p.rack_id]) continue;                       // ignore unknown racks
  const t = types[p.device_type] || { u: 1, color: '#A0AEC0' };
  const h = parseInt(p.ru_height, 10) || t.u;            // blank height -> type u_height
  racks[p.rack_id].push({
    name: p.device_name,
    ru: parseInt(p.ru_start, 10),
    h,
    color: t.color,
    state: p.state,                                       // 'planned' | 'deployed'
  });
}

// Zone bands spanning rack ranges at an RU anchor.
const zones = readTable('data/ebc/split/zone_labels.csv')
  .filter(z => racks[z.rack_start])
  .map(z => ({
    rackStart: z.rack_start, rackEnd: z.rack_end, label: z.label,
    ru: parseInt(z.ru_anchor, 10), h: parseInt(z.ru_height, 10) || 1,
  }));

// Fiber spans: pair the two position rows per fiber_id by node_name.
const byId = {};
for (const f of readTable('data/ebc/split/fiber_static.csv')) {
  (byId[f.fiber_id] ||= []).push(f);
}
const fibers = Object.values(byId).map(rows => {
  rows.sort((a, b) => (+a.position) - (+b.position));
  return {
    a: rows[0].node_name, b: rows[1].node_name,
    color: rows[0].stroke, dashed: !!(rows[0].dash && rows[0].dash.trim()),
    label: (rows[0].label || '').trim(),
  };
});

// Compact, readable-ish JSON (one rack per line, in racks.csv order).
const ids = Object.keys(meta);
const json =
  '{\n  racks: {\n' +
  ids.map(id => `    ${id}: ${JSON.stringify({ row: meta[id].row, order: meta[id].order, devices: racks[id] })}`).join(',\n') +
  '\n  },\n  zones: ' + JSON.stringify(zones) +
  ',\n  fibers: ' + JSON.stringify(fibers) + '\n}';

const block = `/* LAB-RACKS-START */\n    const LAB_RACKS = ${json};\n    /* LAB-RACKS-END */`;

let html = readFileSync(INDEX, 'utf8');
const re = /\/\* LAB-RACKS-START \*\/[\s\S]*?\/\* LAB-RACKS-END \*\//;
if (!re.test(html)) {
  console.error('ERROR: LAB-RACKS markers not found in index.html. Add them first:\n' +
                '    /* LAB-RACKS-START */\n    /* LAB-RACKS-END */');
  process.exit(1);
}
html = html.replace(re, block);
writeFileSync(INDEX, html);

const devCount = Object.values(racks).reduce((n, d) => n + d.length, 0);
console.log(`Baked ${devCount} devices across ${ids.length} racks, ${zones.length} zones, ${fibers.length} fibers into index.html`);
