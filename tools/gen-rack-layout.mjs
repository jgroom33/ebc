#!/usr/bin/env node
// Generates the baked lab-rack layout data for index.html from the na-sales-lab inventory
// YAML (ciena-corp/na-sales-lab, provisioner/inventory/) and writes it into index.html
// between the /* LAB-RACKS-START */ … /* LAB-RACKS-END */ markers.
//
// Reads the EBC layout straight from the lab repo's latest commit: it fetches `origin` and
// reads each file at origin/main with `git show`, so the checkout's working tree (and any
// local edits in it) is never used or touched. YAML is parsed by python3 + PyYAML, which the
// lab repo already requires.
//
//   node tools/gen-rack-layout.mjs                      # lab repo at ../lab, ref origin/main
//   LAB_REPO=~/src/lab LAB_REF=origin/main node tools/gen-rack-layout.mjs
//   node tools/gen-rack-layout.mjs --no-fetch           # use the ref as already fetched
//
// Racks: layouts.yml EBC placements (front face only; rear-mounted gear and 0U items are not
// drawn), heights from device_types*.yml, planned vs deployed from devices*.yml `status`.
// Zone signs: the Placard-3U devices (label from their notes, span from `rack_span`).
// Laser rings / dashed spans / RLS name placards: optical_systems.yml.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(here, '../index.html');
const LAB = resolve((process.env.LAB_REPO || resolve(here, '../../lab')).replace(/^~(?=\/|$)/, homedir()));
const REF = process.env.LAB_REF || 'origin/main';
const LAYOUT = 'EBC';

// Waveserver line spans the page draws. The inventory models only their Calient patching
// (fibers.yml), not the line side, so these display-only spans live here.
const DISPLAY_FIBERS = [
  { a: 'Waveserver-5-West-1', b: 'Waveserver-5-East-1', color: '#0891B2', dashed: false, label: '(800G)' },
  { a: 'WS-2P', b: 'WS-1P', color: '#0EA5E9', dashed: false, label: '(400G)' },
];
const SPAN_COLOR = '#0284C7';           // dashed linear-system spans (ELS, RLS-300)
const PLACARD_FAMILIES = new Set(['RLS']);   // optical families whose nodes get a name placard

const git = (...args) => execFileSync('git', ['-C', LAB, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
if (!process.argv.includes('--no-fetch')) git('fetch', '-q', 'origin');
const commit = git('log', '-1', '--format=%h %s', REF).trim();

// YAML → JSON through python3 + PyYAML (no node dependencies in this repo).
function readYaml(file) {
  const text = git('show', `${REF}:provisioner/inventory/${file}`);
  const json = execFileSync('python3', ['-c',
    'import sys, json, yaml; json.dump(yaml.safe_load(sys.stdin), sys.stdout, default=str)'],
    { input: text, encoding: 'utf8', maxBuffer: 64 << 20 });
  return JSON.parse(json);
}

const devices = {}, types = {};
for (const f of ['devices.yml', 'devices_mgt.yml']) for (const d of readYaml(f).devices) devices[d.name] = d;
for (const f of ['device_types.yml', 'device_types_mgt.yml']) for (const t of readYaml(f).device_types) types[t.model] = t;
const layout = readYaml('layouts.yml').layouts.find(l => l.name === LAYOUT);
if (!layout) { console.error(`ERROR: layout '${LAYOUT}' not found in layouts.yml @ ${REF}`); process.exit(1); }
const systems = readYaml('optical_systems.yml').optical_systems;

// EBC racks in racks.yml order: A* = front display row, B* = back row; order = the number.
const rackIds = readYaml('racks.yml').racks.filter(r => r.location === LAYOUT).map(r => r.name);
const racks = Object.fromEntries(rackIds.map(id => [id, {
  row: id[0] === 'A' ? 'front' : 'back', order: parseInt(id.slice(1), 10), devices: [],
}]));

const zones = [];
for (const p of layout.placements) {
  if (!racks[p.rack]) continue;
  const d = devices[p.device];
  if (!d) { console.warn(`skipping '${p.device}': not in devices*.yml`); continue; }
  const h = types[d.device_type]?.u_height ?? 1;
  if (d.device_type.startsWith('Placard-')) {            // zone sign across rack_span racks
    const label = (d.notes || '').match(/zone placard "([^"]+)"/)?.[1];
    if (!label) { console.warn(`skipping placard '${p.device}': no zone label in its notes`); continue; }
    const i = rackIds.indexOf(p.rack), span = p.rack_span || 1;
    // ru = the placard's middle U (the plan's anchor): position 48 of a 3U panel -> 49.
    zones.push({ rackStart: p.rack, rackEnd: rackIds[i + span - 1], label, ru: p.position + Math.floor(h / 2), h });
    continue;
  }
  if (p.face === 'rear' || !h) continue;                 // only the front faces are drawn
  racks[p.rack].devices.push({ name: p.device, ru: p.position, h, state: d.status === 'planned' ? 'planned' : 'deployed' });
}
for (const r of Object.values(racks)) r.devices.sort((a, b) => a.ru - b.ru);
const placed = new Map();                                  // device -> rack id
for (const [id, r] of Object.entries(racks)) for (const d of r.devices) placed.set(d.name, id);

// Laser rings, per optical family: its ring-topology system's nodes; a family with only
// linear systems (ELS) loops their terminals instead.
const rings = {};
for (const fam of new Set(systems.map(s => s.family))) {
  const fs = systems.filter(s => s.family === fam);
  const ringSys = fs.filter(s => s.topology === 'ring');
  const nodes = ringSys.length
    ? ringSys.flatMap(s => s.nodes.map(n => n.node))
    : fs.flatMap(s => s.nodes.filter(n => n.role === 'terminal').map(n => n.node));
  const drawn = nodes.filter(n => placed.has(n));
  if (drawn.length >= 3) rings[fam] = drawn;
}

// Dashed fibers: every span of a linear system (the rings are drawn by the laser loop).
const fibers = [];
for (const s of systems.filter(s => s.topology === 'linear'))
  for (const sp of s.spans || [])
    if (placed.has(sp.a.node) && placed.has(sp.z.node))
      fibers.push({ a: sp.a.node, b: sp.z.node, color: SPAN_COLOR, dashed: true, label: '' });
for (const f of DISPLAY_FIBERS) {
  if (placed.has(f.a) && placed.has(f.b)) fibers.push(f);
  else console.warn(`display fiber ${f.a} - ${f.b}: an end is not placed in ${LAYOUT}, skipped`);
}

// Name placards for the PLACARD_FAMILIES nodes, in the free U just below the shelf (else just
// above, else on the shelf itself).
const placards = [];
for (const s of systems.filter(s => PLACARD_FAMILIES.has(s.family)))
  for (const { node: name } of s.nodes) {
    const rackId = placed.get(name);
    if (!rackId) continue;
    const devs = racks[rackId].devices, d = devs.find(dv => dv.name === name);
    const occ = new Set();
    for (const dv of devs) for (let ru = dv.ru; ru < dv.ru + dv.h; ru++) occ.add(ru);
    const below = d.ru - 1, above = d.ru + d.h;
    let ru, position;
    if (below >= 1 && !occ.has(below)) { ru = below; position = 'below'; }
    else if (above <= 58 && !occ.has(above)) { ru = above; position = 'above'; }
    else { ru = d.ru + d.h - 1; position = 'inside'; }
    placards.push({ name, label: name, rack: rackId, ru, position });
  }

// Compact, readable-ish JSON (one rack per line, in racks.yml order).
const json =
  '{\n  racks: {\n' +
  rackIds.map(id => `    ${id}: ${JSON.stringify(racks[id])}`).join(',\n') +
  '\n  },\n  zones: ' + JSON.stringify(zones) +
  ',\n  fibers: ' + JSON.stringify(fibers) +
  ',\n  rings: ' + JSON.stringify(rings) +
  ',\n  placards: ' + JSON.stringify(placards) + '\n}';

const block = `/* LAB-RACKS-START */\n    // na-sales-lab @ ${commit.replace(/\*\//g, '* /')}\n    const LAB_RACKS = ${json};\n    /* LAB-RACKS-END */`;

let html = readFileSync(INDEX, 'utf8');
const re = /\/\* LAB-RACKS-START \*\/[\s\S]*?\/\* LAB-RACKS-END \*\//;
if (!re.test(html)) {
  console.error('ERROR: LAB-RACKS markers not found in index.html. Add them first:\n' +
                '    /* LAB-RACKS-START */\n    /* LAB-RACKS-END */');
  process.exit(1);
}
html = html.replace(re, () => block);
writeFileSync(INDEX, html);

const devCount = Object.values(racks).reduce((n, r) => n + r.devices.length, 0);
console.log(`Baked ${devCount} devices across ${rackIds.length} racks, ${zones.length} zones, ` +
  `${fibers.length} fibers, ${Object.keys(rings).length} rings, ${placards.length} placards ` +
  `from na-sales-lab @ ${commit}`);
