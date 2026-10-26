#!/usr/bin/env node
// Draws the front-row (A1–A10) elevations as SVGs and writes the comparison page:
//   front-row/<option>.svg   one front elevation per option
//   front-row/index.html     the options side by side: story, U used/free, growth, trade-offs
// The layouts live in tools/front-row/options.mjs; tools/front-row/check.mjs checks them.
//
//   node tools/front-row/gen.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { OPTIONS, RACKS, RACK_U, PRODUCTS, PLACARD_U } from './options.mjs';
import { usage } from './layout.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../front-row');

// Drawing scale (px).
const UH = 12, RACK_W = 150, GAP = 14, SCALE_W = 34, TOP = 82, PAD = 18;
const FONT = 'Segoe UI, system-ui, -apple-system, Arial, sans-serif';
const FAMILY = {      // fill, label
  access:   ['#1d5fa8', 'Access'],
  tdm:      ['#2a7f9e', 'TDM'],
  agg:      ['#3a6fd1', 'Aggregation'],
  metro:    ['#5a4fc4', 'Converged Metro'],
  els:      ['#1f8a6b', 'ELS'],
  rls:      ['#b8462e', 'RLS'],
  photonic: ['#a8326e', '6500 photonic'],
  services: ['#8a5a1f', '6500 services'],
  dci:      ['#0e7490', 'Waveserver / WSAi'],
  fmt:      ['#4b5563', 'FMT'],
};
const AMBER = '#f6a623';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rackX = (i) => PAD + SCALE_W + i * (RACK_W + GAP);
const uY = (u) => TOP + (RACK_U - u + 1) * UH;          // y of the top edge of U `u`
const W = rackX(RACKS.length) - GAP + SCALE_W + PAD;
const LEGEND_Y = uY(0) + 34;
const H = LEGEND_Y + 40;

function text(x, y, s, { size = 10, weight = 400, fill = '#eaf1f8', anchor = 'middle' } = {}) {
  // Centre on y by hand (dominant-baseline is not honoured by every SVG renderer).
  return `<text x="${x}" y="${(y + size * 0.35).toFixed(1)}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;
}

function deviceLabel(product, x, y, w, h) {
  const m = product.match(/^(.*?) \((.+)\)$/);
  const cx = x + w / 2, cy = y + h / 2;
  if (!m) return text(cx, cy, product, { size: 9.5, weight: 600 });
  if (h >= 3 * UH - 1) return text(cx, cy - 6, m[1], { size: 10, weight: 700 }) + text(cx, cy + 7, m[2], { size: 8.5, fill: '#d6e2ee' });
  return text(cx, cy, product, { size: 9, weight: 600 });
}

function svg(opt) {
  const p = opt.plan, use = usage(p);
  const parts = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#0b0f14"/>`);
  parts.push(text(PAD, 22, opt.title, { size: 18, weight: 700, anchor: 'start' }));
  parts.push(text(PAD, 42, 'EBC front row A1–A10 · front elevation · 19" racks, 58U each, U1 at the bottom · devices at true U height',
    { size: 11, fill: '#9fb3c8', anchor: 'start' }));

  // U scales (both sides) and rack frames with a faint U grid.
  for (const sx of [PAD + SCALE_W - 6, rackX(RACKS.length) - GAP + 6])
    for (let u = 1; u <= RACK_U; u++)
      if (u === 1 || u % 5 === 0)
        parts.push(text(sx, uY(u) + UH / 2, u, { size: 8.5, fill: '#7d8fa3', anchor: sx < W / 2 ? 'end' : 'start' }));
  RACKS.forEach((rack, i) => {
    const x = rackX(i);
    parts.push(`<rect x="${x - 3}" y="${uY(RACK_U) - 3}" width="${RACK_W + 6}" height="${RACK_U * UH + 6}" rx="3" fill="#121922" stroke="#3a4a5c" stroke-width="1.5"/>`);
    for (let u = 1; u <= RACK_U; u++)
      parts.push(`<line x1="${x}" x2="${x + RACK_W}" y1="${uY(u)}" y2="${uY(u)}" stroke="#1c2633" stroke-width="0.6"/>`);
    parts.push(text(x + RACK_W / 2, TOP - 12, rack, { size: 14, weight: 700 }));
    const u0 = use[rack];
    parts.push(text(x + RACK_W / 2, uY(0) + 13, `${u0.used}U used · ${u0.free}U free`, { size: 9.5, fill: '#9fb3c8' }));
  });

  // Reserved space: dashed, labelled.
  for (const r of p.reserved) {
    const x = rackX(RACKS.indexOf(r.rack)), y = uY(r.u + r.h - 1), h = r.h * UH;
    parts.push(`<rect x="${x + 1}" y="${y + 1}" width="${RACK_W - 2}" height="${h - 2}" fill="rgba(246,166,35,0.08)" stroke="${AMBER}" stroke-width="1.5" stroke-dasharray="6 4"/>`);
    const [a, b] = r.label.split(': ');
    parts.push(text(x + RACK_W / 2, y + h / 2 - 8, a, { size: 11, weight: 700, fill: AMBER }));
    if (b) parts.push(text(x + RACK_W / 2, y + h / 2 + 8, b, { size: 11, weight: 600, fill: AMBER }));
  }

  // Devices.
  for (const it of p.items) {
    const [h, fam] = PRODUCTS[it.product];
    const x = rackX(RACKS.indexOf(it.rack)) + 4, y = uY(it.u + h - 1) + 0.5, w = RACK_W - 8, hh = h * UH - 1;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="1.5" fill="${FAMILY[fam][0]}" stroke="${AMBER}" stroke-width="0.8"/>`);
    parts.push(deviceLabel(it.product, x, y, w, hh));
  }

  // Zone placards (3U), one panel across the racks they span.
  for (const z of p.placards) {
    const i = RACKS.indexOf(z.rack), x = rackX(i) - 1, w = z.span * RACK_W + (z.span - 1) * GAP + 2;
    const y = uY(z.u + PLACARD_U - 1) + 1, h = PLACARD_U * UH - 2;
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="#eaf1f8" stroke="#0056b4" stroke-width="2"/>`);
    const label = z.label.toUpperCase(), size = Math.min(13, (w - 10) / (label.length * 0.72));
    parts.push(text(x + w / 2, y + h / 2, label, { size: +size.toFixed(1), weight: 800, fill: '#0b2a4f' }));
  }

  // Legend.
  const fams = [...new Set(p.items.map(it => PRODUCTS[it.product][1]))];
  let lx = PAD + SCALE_W;
  for (const f of Object.keys(FAMILY).filter(f => fams.includes(f))) {
    parts.push(`<rect x="${lx}" y="${LEGEND_Y - 6}" width="12" height="12" rx="2" fill="${FAMILY[f][0]}" stroke="${AMBER}" stroke-width="0.8"/>`);
    parts.push(text(lx + 18, LEGEND_Y, FAMILY[f][1], { size: 11, fill: '#cdd8e3', anchor: 'start' }));
    lx += 36 + FAMILY[f][1].length * 6.6;
  }
  if (p.reserved.length) {
    parts.push(`<rect x="${lx}" y="${LEGEND_Y - 6}" width="12" height="12" fill="none" stroke="${AMBER}" stroke-dasharray="3 2"/>`);
    parts.push(text(lx + 18, LEGEND_Y, 'Reserved space', { size: 11, fill: '#cdd8e3', anchor: 'start' }));
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="${FONT}">\n` +
    `<title>${esc(opt.title)}: EBC front row A1–A10</title>\n${parts.join('\n')}\n</svg>\n`;
}

function page() {
  const sections = OPTIONS.map((opt) => {
    const use = usage(opt.plan);
    const rows = RACKS.map(r => {
      const u = use[r];
      return `<tr><th>${r}</th><td>${u.devices}</td><td>${u.placards}</td><td>${u.reserved || ''}</td>` +
        `<td><b>${u.used}</b></td><td><b>${u.free}</b></td><td class="ranges">${esc(u.freeRanges.join(', ') || 'none')}</td></tr>`;
    }).join('\n');
    const total = RACKS.reduce((n, r) => n + use[r].used, 0);
    const li = (xs) => xs.map(x => `<li>${esc(x)}</li>`).join('');
    return `
<section id="${opt.key}">
  <h2>${esc(opt.title)}</h2>
  <a class="elev" href="${opt.key}.svg"><img src="${opt.key}.svg" alt="${esc(opt.title)} front elevation, racks A1 to A10" loading="lazy"></a>
  <div class="cols">
    <div>
      <h3>The story, left to right</h3><ul>${li(opt.story)}</ul>
      ${opt.fit ? `<h3>Fit</h3><p>${esc(opt.fit)}</p>` : ''}
      <h3>Room to grow</h3><ul>${li(opt.growth)}</ul>
      <h3>Trade-offs</h3><ul>${li(opt.tradeoffs)}</ul>
    </div>
    <div>
      <h3>U used and free per rack</h3>
      <table>
        <thead><tr><th>Rack</th><th>Devices</th><th>Placards</th><th>Reserved</th><th>Used</th><th>Free</th><th>Free U</th></tr></thead>
        <tbody>
${rows}
        </tbody>
        <tfoot><tr><th>Row</th><td colspan="3"></td><td><b>${total}</b></td><td><b>${RACKS.length * RACK_U - total}</b></td><td>of ${RACKS.length * RACK_U}U</td></tr></tfoot>
      </table>
    </div>
  </div>
</section>`;
  }).join('\n');

  const nav = OPTIONS.map(o => `<a href="#${o.key}">${esc(o.short)}</a>`).join(' · ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EBC Front-Row Options</title>
  <link rel="icon" href="data:," />
  <!-- Generated by tools/front-row/gen.mjs from tools/front-row/options.mjs. Do not edit by hand. -->
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #0b0f14; color: #eaf1f8;
           font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif; line-height: 1.45; }
    main { max-width: 1240px; margin: 0 auto; padding: 28px 16px 60px; }
    .logo { font-size: 26px; font-weight: 700; letter-spacing: 4px; color: #e4002b; }
    .sub { font-size: 12px; letter-spacing: 2px; opacity: 0.85; }
    h1 { font-size: 26px; margin: 18px 0 6px; }
    h2 { font-size: 21px; margin: 0 0 12px; color: #8fb8e6; }
    h3 { font-size: 13px; letter-spacing: 1.5px; text-transform: uppercase; color: #9fb3c8; margin: 18px 0 6px; }
    a { color: #6fb1f2; }
    p, li { color: #d6e2ee; }
    ul { padding-left: 20px; margin: 0; }
    .preferred { display: inline-block; margin: 10px 0 4px; padding: 8px 14px; border-radius: 10px;
                 border: 1px solid rgba(120,170,230,0.35); background: rgba(14,20,29,0.8); font-weight: 600; }
    nav { margin: 12px 0 8px; }
    section { margin-top: 36px; padding-top: 24px; border-top: 1px solid #1f2a37; }
    .elev { display: block; overflow-x: auto; border: 1px solid #1f2a37; border-radius: 8px; background: #0b0f14; }
    .elev img { display: block; width: 100%; min-width: 900px; height: auto; }
    .cols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
    @media (max-width: 860px) { .cols { grid-template-columns: 1fr; } }
    .cols > div { min-width: 0; overflow-x: auto; }
    table { border-collapse: collapse; font-size: 13px; width: 100%; }
    th, td { padding: 4px 8px; border-bottom: 1px solid #1f2a37; text-align: right; }
    th:first-child, td.ranges, thead th:last-child { text-align: left; }
    td.ranges { color: #9fb3c8; font-size: 12px; }
    thead th { color: #9fb3c8; font-weight: 600; }
    .note { color: #9fb3c8; font-size: 13px; }
  </style>
</head>
<body>
<main>
  <div class="logo">CIENA</div>
  <div class="sub">EXECUTIVE BRIEFING CENTER</div>
  <h1>Front-row options, racks A1–A10</h1>
  <p class="note">Ten 19" racks, 58U each, U1 at the bottom. Every option places the same ${OPTIONS[0].plan.items.length} devices as today's plan, each once, at true U height;
  zone placards are 3U. U used counts devices, placards and reserved space. These are separate from the rack layouts in the
  <a href="../">3D scene</a>'s ‹ / › switcher, which only move whole sections between racks.</p>
  <div class="preferred">Preferred option: TBD</div>
  <nav>${nav}</nav>
${sections}
</main>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
for (const opt of OPTIONS) writeFileSync(resolve(OUT, `${opt.key}.svg`), svg(opt));
writeFileSync(resolve(OUT, 'index.html'), page());
console.log(`Wrote ${OPTIONS.length} elevations and the comparison page to front-row/`);
