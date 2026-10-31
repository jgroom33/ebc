// The morph engine: the EBC room with the option-9 racks, and the same equipment as one network
// standing in front of the rack row: the 6500, RLS and ELS line systems (photonic), the Waveservers
// and 6500-D7s riding them (transport), and the RSP routers and switches over it all (IP / Ethernet).
// One state drives everything, evaluated every frame (no chained tweens), so it scrubs and reverses:
//   t      0..1  the morph: room → network
//   focus  { '6500', rls, els: 0..1 }  how strongly each line system (and what rides on it) shows
//   time   seconds, for the light pulses only
// Renderer-agnostic: it builds a THREE.Group and updates it. No DOM beyond canvas textures, no
// CSS2D, no Line2 (links are meshes, labels are sprites), so a WebXR page can reuse it as is.
import * as THREE from 'three';
import {
  NODES, PH_SYSTEMS, PH_JOINS, WAVES, IP_LINKS, TR_LINKS, LAYERS, LAYER_ORDER, RIBBON, GREY, layerY, R, SYSTEM_KEYS,
} from './model.mjs';
import { zoneSignBands, bigLabelCanvas, nodeSignCanvas } from '../lab-layouts.mjs';

// ---- Room dimensions (as index.html's CONFIG; metres) ----------------------------------------
const FT = 0.3048, IN = FT / 12;
export const ROOM = {
  L: 39.5 * FT, D: 17.5 * FT, H: 9 * FT, W: 6 * FT,
  labL: 31 * FT, labW: 23 * FT, tableLength: 24 * FT, tableWidth: 4 * FT, tableHeight: 0.74,
  frameDepth: 2 * IN, doorWidth: 3.2 * FT,
};
const { L, D, H, W } = ROOM;
const RACK_W = 21 * IN, U_M = 1.75 * IN, RACK_PLINTH = 1.5 * IN, RACK_D = 2.4 * FT;
const RACK_H = RACK_PLINTH + 58 * U_M + 1.5 * IN;
const DEV_FRONT = RACK_D / 2 + 0.3 * IN, DEV_W = 19 * IN, DEV_D = 1.4 * IN;
const PITCH = RACK_W + 6 * IN;
const X_RIGHT = ROOM.labL / 2 - 5 * FT - RACK_W / 2;
const FRONT_Z = -W - 5 * FT - RACK_D / 2, BACK_Z = FRONT_Z - (RACK_D + 3 * FT);
const xOfOrder = (o) => X_RIGHT - PITCH * (10 - o);

// ---- The diorama frame: CAL units → room metres ----------------------------------------------
export const S = 0.15; // metres per CAL unit
const DIORAMA = new THREE.Vector3(
  xOfOrder(5), // A5, the middle of A1–A9; node x is its device's rack, so this only frames the camera
  0.3, // photonic layer height, below every optical shelf so each one drops into place; IP lands 1.8 m above
  FRONT_Z + RACK_D / 2 + 0.72, // the deepest nodes (z -3.4 … -3.6 units) sit just in front of the rack faces
);

// ---- Timeline (all windows in t) -------------------------------------------------------------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
export const PHASES = {
  spot: [0.0, 0.12], // spotlight the network gear, dim the rest
  back: [0.08, 0.16], // the back rack row goes first: it would show through the clearing front row
  signs: [0.1, 0.28],
  shell: [0.12, 0.4], // room shell fades
  racks: [0.16, 0.42], // racks and unrelated devices fade
  ghost: [0.3, 0.5], ghostOut: [0.7, 0.88], // a faint outline of the racks while the gear leaves them
  fly: { ph: [0.3, 0.46], tr: [0.44, 0.58], ip: [0.6, 0.76] }, // all line systems together, then transport, then RSP
  ipStagger: 0.006, // per rack, left to right: the RSP overlay rises as a wave
  slab: { ph: [0.42, 0.54], tr: [0.54, 0.64], ip: [0.74, 0.84] },
  links: { ph: [0.48, 0.56], tr: [0.6, 0.68], ip: [0.8, 0.9] }, // spans and waves, transport, the RSP attaching
  labels: { ph: [0.5, 0.6], tr: [0.62, 0.7], ip: [0.84, 0.94] },
  handover: [0.44, 0.52], // the rack fibres fade as the CAL spans take over
};
const ALL = Object.fromEntries(SYSTEM_KEYS.map((k) => [k, 1]));

// ---- Materials that fade ---------------------------------------------------------------------
function fader(mat, base = mat.opacity ?? 1) {
  mat.userData.base = base;
  mat.userData.alpha = 1;
  return mat;
}
function setAlpha(mat, a) {
  const base = mat.userData.base ?? 1;
  mat.opacity = base * a;
  const tr = a < 0.999 || base < 1;
  if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; }
  mat.depthWrite = !mat.userData.noDepth && a > 0.6;
  mat.userData.alpha = a;
}
class Channel { // a set of materials faded together
  constructor() { this.mats = new Set(); this.groups = []; }
  std(p) { const m = fader(new THREE.MeshStandardMaterial(p)); this.mats.add(m); return m; }
  add(m) { fader(m); this.mats.add(m); return m; }
  set(a) {
    for (const m of this.mats) setAlpha(m, a);
    for (const g of this.groups) g.visible = a > 0.003;
  }
}

// ---- Canvas textures (labels and signs) ------------------------------------------------------
const FONT = '"Segoe UI", Arial, sans-serif';
function canvasTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
// `text` may hold newlines; hM is the whole sprite's height (all lines).
export function textSprite(text, hM, { fg = '#ffffff', bg = 'rgba(16,22,30,0.82)', weight = 700, accent = null } = {}) {
  const cv = document.createElement('canvas'), lines = String(text).split('\n');
  const ctx = cv.getContext('2d'), fs = 64, pad = 26, lh = 96;
  ctx.font = `${weight} ${fs}px ${FONT}`;
  cv.width = Math.ceil(Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2 + (accent ? 18 : 0)); cv.height = lh * lines.length;
  if (bg) {
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(0, 0, cv.width, cv.height, 22); ctx.fill();
  }
  if (accent) { ctx.fillStyle = accent; ctx.fillRect(14, 22, 8, cv.height - 44); }
  ctx.font = `${weight} ${fs}px ${FONT}`;
  ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, cv.width / 2 + (accent ? 9 : 0), lh * i + lh / 2 + 3));
  const mat = fader(new THREE.SpriteMaterial({ map: canvasTex(cv), transparent: true, depthWrite: false }));
  mat.userData.noDepth = true;
  const sp = new THREE.Sprite(mat);
  sp.scale.set(hM * cv.width / cv.height, hM, 1);
  sp.center.set(0.5, 0);
  return sp;
}
function labelPlane(text, wM, hM, mat) { // rack IDs
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.max(64, Math.round(512 * hM / wM));
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#eaf1f8'; ctx.font = `700 80px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
  mat.map = canvasTex(cv);
  return new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), mat);
}
// Zone and ring-node signs: the canvases index.html draws (lab-layouts.mjs), on a fading material.
function signMesh(cv, wM, hM, mat) {
  mat.map = canvasTex(cv);
  return new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), mat);
}
function spectrumTexture() { // a span's DWDM ribbon: the full spectrum, bottom to top
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 128;
  const ctx = cv.getContext('2d'), g = ctx.createLinearGradient(0, cv.height, 0, 0);
  ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#2d93ff', '#8b5cf6'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
  return canvasTex(cv);
}
function dashTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 4, 38);
  const t = canvasTex(cv);
  t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter;
  return t;
}

// ---- Geometry helpers ------------------------------------------------------------------------
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT_BOX);
const UNIT_CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3();

// A straight link between two moving points: a unit cylinder stretched each frame.
class Seg {
  constructor(parent, mat, r, dash = 0) {
    this.mat = mat; this.r = r; this.dash = dash;
    this.mesh = new THREE.Mesh(UNIT_CYL, mat);
    this.mesh.renderOrder = 2;
    parent.add(this.mesh);
  }
  set(a, b) {
    _v.subVectors(b, a);
    const len = _v.length();
    this.mesh.position.addVectors(a, b).multiplyScalar(0.5);
    this.mesh.quaternion.setFromUnitVectors(UP, len > 1e-6 ? _v.divideScalar(len) : UP);
    this.mesh.scale.set(this.r, Math.max(len, 1e-4), this.r);
    if (this.dash) this.mat.map.repeat.set(1, len / this.dash);
  }
  show(a) { this.mesh.visible = a > 0.003; setAlpha(this.mat, a); }
}
// A standing ribbon between two points (its bottom edge on a→b, `h` tall).
class Ribbon {
  constructor(parent, mat, h) {
    this.mat = mat; this.h = h;
    const g = new THREE.PlaneGeometry(1, 1); g.translate(0, 0.5, 0);
    this.mesh = new THREE.Mesh(g, mat);
    parent.add(this.mesh);
  }
  set(a, b) {
    _v.subVectors(b, a);
    this.mesh.position.addVectors(a, b).multiplyScalar(0.5);
    this.mesh.rotation.set(0, -Math.atan2(_v.z, _v.x), 0);
    this.mesh.scale.set(Math.hypot(_v.x, _v.z), this.h, 1);
  }
  show(a) { this.mesh.visible = a > 0.003; setAlpha(this.mat, a); }
}

// ---- CAL node meshes (in CAL units, scaled by S) ---------------------------------------------
const RED = 0xdc0000;
const CAPTION_LINE = 0.27; // metres per line of a layer caption (node labels are 0.075 m)
const PH_H = RIBBON.y0 + RIBBON.h + 0.12;
function nodeMesh(type) {
  const g = new THREE.Group(), mats = [];
  const M = (p) => { const m = fader(new THREE.MeshStandardMaterial(p)); mats.push(m); return m; };
  const glyph = () => { const m = fader(new THREE.MeshBasicMaterial({ color: 0xffffff })); mats.push(m); return m; };
  let height;
  if (type === 'router' || type === 'xpdr') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.38, 40),
      M({ color: type === 'router' ? RED : 0x9aa0ad, roughness: 0.38, metalness: 0.15, emissive: type === 'router' ? 0x400000 : 0x202226 }));
    body.position.y = 0.19 + 0.04;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.64, 0.08, 40), M({ color: 0xd8dae0, roughness: 0.6 }));
    base.position.y = 0.04;
    g.add(base, body);
    const gm = glyph();
    for (let i = 0; i < 4; i++) { // the router glyph: four arrows, two in and two out
      const a = new THREE.Group(), out = i % 2 === 0;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.05), gm); arm.position.x = 0.26;
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.13, 3), gm);
      head.rotation.z = out ? -Math.PI / 2 : Math.PI / 2; head.position.x = out ? 0.44 : 0.1;
      a.add(arm, head); a.position.y = 0.43; a.rotation.y = (i * Math.PI) / 2;
      g.add(a);
    }
    height = 0.44;
  } else if (type === 'roadm') {
    const base = box(1.3, 0.22, 1.3, M({ color: 0x15161a, roughness: 0.6 })); base.position.y = 0.11;
    const top = box(1.3, PH_H - 0.22, 1.3, M({ color: RED, roughness: 0.4, metalness: 0.1, emissive: 0x400000 }));
    top.position.y = 0.22 + (PH_H - 0.22) / 2;
    const gm = glyph();
    const h = box(0.8, 0.01, 0.05, gm), v = box(0.05, 0.01, 0.8, gm);
    h.position.y = v.position.y = PH_H + 0.005;
    g.add(base, top, h, v);
    height = PH_H;
  } else if (type === 'switch') { // RSP switch: a flat slab with a white stripe
    const body = box(1.1, 0.24, 0.78, M({ color: 0xb30012, roughness: 0.45, metalness: 0.1, emissive: 0x300000 }));
    body.position.y = 0.12 + 0.03;
    const base = box(1.14, 0.06, 0.82, M({ color: 0xd8dae0, roughness: 0.6 })); base.position.y = 0.03;
    const gm = glyph(), st = box(0.8, 0.01, 0.06, gm); st.position.y = 0.275;
    g.add(base, body, st);
    height = 0.28;
  } else if (type === 'filter') { // ELS terminal (filter): a low block with three white bars
    const hh = PH_H * 0.62;
    const base = box(1.2, 0.18, 0.9, M({ color: 0x15161a, roughness: 0.6 })); base.position.y = 0.09;
    const top = box(1.2, hh - 0.18, 0.9, M({ color: RED, roughness: 0.4, emissive: 0x400000 })); top.position.y = 0.18 + (hh - 0.18) / 2;
    const gm = glyph();
    for (const dz of [-0.22, 0, 0.22]) { const b = box(0.8, 0.01, 0.06, gm); b.position.set(0, hh + 0.005, dz); g.add(b); }
    g.add(base, top);
    height = hh;
  } else if (type === 'oadm') { // ELS OADM: a low drum with a white cross
    const hh = PH_H * 0.62;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 32), M({ color: 0x15161a, roughness: 0.6 })); base.position.y = 0.08;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, hh - 0.16, 32), M({ color: RED, roughness: 0.4, emissive: 0x400000 }));
    top.position.y = 0.16 + (hh - 0.16) / 2;
    const gm = glyph(), h = box(0.7, 0.01, 0.05, gm), v = box(0.05, 0.01, 0.7, gm);
    h.position.y = v.position.y = hh + 0.005;
    g.add(base, top, h, v);
    height = hh;
  } else { // amp: a triangular prism
    const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, PH_H - 0.14, 3), M({ color: RED, roughness: 0.4, emissive: 0x400000 }));
    tri.position.y = 0.14 + (PH_H - 0.14) / 2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.14, 3), M({ color: 0x15161a, roughness: 0.6 }));
    base.position.y = 0.07;
    g.add(base, tri);
    height = PH_H;
  }
  g.scale.setScalar(S);
  const width = ({ amp: 1.44, roadm: 1.3, switch: 1.14, filter: 1.2, oadm: 1.2 }[type] ?? 1.28) * S;
  return { group: g, mats, height: height * S, width };
}
const nodeEdge = (n) => ({ amp: 0.8, filter: 0.62, oadm: 0.6 }[n.type] ?? 0.68) * S; // a ribbon starts at a node's edge

// =============================================================================================
export function createMorph(model, { log = console } = {}) {
  const root = new THREE.Group(); root.name = 'EBCMorph';
  const ch = { shell: new Channel(), racks: new Channel(), back: new Channel(), signs: new Channel(), ghost: new Channel() };
  const mk = (name, channel) => { const g = new THREE.Group(); g.name = name; root.add(g); if (channel) channel.groups.push(g); return g; };

  // ---- Lights (dim for the spotlight, then a key light for the diorama) ----
  const lights = {
    hemi: new THREE.HemisphereLight(0xdfe9f5, 0x2a2f36, 0.9),
    sun: new THREE.DirectionalLight(0xfff3e0, 2.0),
    fill: new THREE.DirectionalLight(0xbfd4ff, 0.4),
    key: new THREE.DirectionalLight(0xffffff, 0),
    spot: new THREE.PointLight(0xfff1d6, 0, 6, 1.6),
  };
  lights.sun.position.set(L * 0.3, H * 2.2, -W - 8 * FT);
  lights.fill.position.set(-L * 0.4, H, D * 1.5);
  lights.key.position.set(DIORAMA.x + 2, DIORAMA.y + 4, DIORAMA.z + 4);
  lights.key.target.position.copy(DIORAMA);
  lights.spot.position.set(DIORAMA.x, 2.6, FRONT_Z + 1.6); // washes the rack faces during the spotlight
  const lightGroup = mk('Lights');
  Object.values(lights).forEach((l) => lightGroup.add(l));
  lightGroup.add(lights.key.target);

  // ---- Room shell ----
  const shell = mk('Shell', ch.shell);
  const S_ = (p) => ch.shell.std(p);
  const m = {
    floorRoom: S_({ color: 0x3c3f46, roughness: 0.95 }),
    floorHall: S_({ color: 0x9aa3ab, roughness: 0.25, metalness: 0.1 }),
    labFloor: S_({ color: 0xc2c7cd, roughness: 0.3, metalness: 0.1 }),
    ceiling: S_({ color: 0xededed, roughness: 0.96 }),
    wall: S_({ color: 0xe1ded7, roughness: 0.92 }),
    infill: S_({ color: 0x2c3038, roughness: 0.85, metalness: 0.05 }),
    frame: S_({ color: 0x2a2e33, roughness: 0.4, metalness: 0.85 }),
    tableTop: S_({ color: 0x2a1c12, roughness: 0.45, metalness: 0.05 }),
    tableBase: S_({ color: 0x1e1e21, roughness: 0.5, metalness: 0.7 }),
    brand: S_({ color: 0x0056b4, roughness: 0.5, emissive: 0x0056b4, emissiveIntensity: 0.15 }),
    lens: S_({ color: 0xfff6e6, emissive: 0xfff6e6, emissiveIntensity: 1.3, roughness: 0.6 }),
    glass: ch.shell.add(new THREE.MeshStandardMaterial({ color: 0xcfe3ea, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.14 })),
  };
  m.glass.userData.noDepth = true;
  const labH = H + 2 * FT, labCz = -W - ROOM.labW / 2, xHalf = ROOM.labL / 2, wt = 6 * IN;
  // floors and ceilings
  shell.add(at(box(L + 0.4, 2 * IN, D, m.floorRoom), 0, -IN, D / 2));
  shell.add(at(box(L + 0.4, 2 * IN, W, m.floorHall), 0, -IN, -W / 2));
  shell.add(at(box(ROOM.labL, 2 * IN, ROOM.labW, m.labFloor), 0, -IN, labCz));
  shell.add(at(box(L + 0.4, 4 * IN, D + W, m.ceiling), 0, H + 2 * IN, (D - W) / 2));
  shell.add(at(box(ROOM.labL + 2 * wt, 4 * IN, ROOM.labW, m.ceiling), 0, labH + 2 * IN, labCz));
  // lab walls: back, sides, the bulkhead over the glass
  shell.add(at(box(ROOM.labL + 2 * wt, labH, wt, m.wall), 0, labH / 2, -W - ROOM.labW - wt / 2));
  for (const sx of [-1, 1]) shell.add(at(box(wt, labH, ROOM.labW, m.wall), sx * (xHalf + wt / 2), labH / 2, labCz));
  shell.add(at(box(ROOM.labL + 2 * wt, labH - H, wt, m.wall), 0, (H + labH) / 2, -W + wt / 2));
  // the two glass walls: rails, mullions, panes (the room's corners are opaque infill)
  const fd = ROOM.frameDepth, labDoorCx = ROOM.labL / 2 - 1.5 * FT;
  for (const z of [0, -W]) {
    shell.add(at(box(L, fd, fd, m.frame), 0, fd / 2, z), at(box(L, fd, fd, m.frame), 0, H - fd / 2, z));
    const mulls = z === 0 ? [-L / 2, -labDoorCx - ROOM.doorWidth / 2, -labDoorCx + ROOM.doorWidth / 2, labDoorCx - ROOM.doorWidth / 2, labDoorCx + ROOM.doorWidth / 2, L / 2]
      : [-L / 2, -xHalf, labDoorCx - 1.5 * FT, labDoorCx + 1.5 * FT, xHalf, L / 2];
    for (const x of mulls) shell.add(at(box(fd, H, fd, m.frame), x, H / 2, z));
    const glassFrom = z === 0 ? -labDoorCx - ROOM.doorWidth / 2 : -L / 2, glassTo = -glassFrom;
    const pane = box(glassTo - glassFrom, H - fd, IN, m.glass); pane.renderOrder = 1;
    shell.add(at(pane, 0, H / 2, z));
    if (z === 0) for (const sx of [-1, 1]) {
      const w = L / 2 - (labDoorCx + ROOM.doorWidth / 2);
      shell.add(at(box(w, H - fd, fd, m.infill), sx * (L / 2 - w / 2), H / 2, z));
    }
  }
  // table (no chairs on this page: the morph plays from a seat at the table), ceiling lights
  const cz = D / 2, topY = ROOM.tableHeight - IN;
  shell.add(at(box(ROOM.tableLength, 2 * IN, ROOM.tableWidth, m.tableTop), 0, topY, cz));
  shell.add(at(box(ROOM.tableLength * 0.5, 0.4 * IN, 3 * IN, m.brand), 0, topY + IN, cz));
  for (const sx of [-1, 1]) shell.add(at(box(2 * IN, ROOM.tableHeight - 2 * IN, ROOM.tableWidth * 0.55, m.tableBase), sx * ROOM.tableLength * 0.28, (ROOM.tableHeight - 2 * IN) / 2, cz));
  for (let c = 0; c < 8; c++) {
    const x = -L / 2 + L * 0.12 + (L * 0.76) * (c / 7);
    for (const z of [D * 0.18, D * 0.82]) shell.add(at(box(2 * FT, IN, 2 * FT, m.lens), x, H - IN, z));
    shell.add(at(box(2 * FT, IN, FT, m.lens), x, H - IN, -W / 2));
  }
  for (let c = 0; c < 4; c++) for (const z of [-W - ROOM.labW * 0.2, -W - ROOM.labW * 0.8])
    shell.add(at(box(2 * FT, IN, 2 * FT, m.lens), -xHalf + ROOM.labL * 0.16 + ROOM.labL * 0.68 * (c / 3), labH - IN, z));

  // ---- Racks (cabinets, cable managers, IDs, the devices that stay) ----
  const lab = model.lab;
  const flyerNames = new Set(model.joins.flatMap((j) => [j.primary, ...j.helpers]));
  const racks = mk('Racks', ch.racks);
  const rk = {
    rack: ch.racks.std({ color: 0x14171c, roughness: 0.5, metalness: 0.6 }),
    mgr: ch.racks.std({ color: 0x0c0f14, roughness: 0.55, metalness: 0.45 }),
    devD: ch.racks.std({ color: 0xccd2d9, emissive: 0xccd2d9, emissiveIntensity: 0.16, roughness: 0.5, metalness: 0.12 }),
    devP: ch.racks.std({ color: 0xccd2d9, emissive: 0xccd2d9, emissiveIntensity: 0.06, roughness: 0.62, metalness: 0.12 }),
    edge: ch.racks.add(new THREE.LineBasicMaterial({ color: 0xf6a623 })),
  };
  rk.devD.userData.emissive = 0.16; rk.devP.userData.emissive = 0.06;
  // The back row (servers and lab switches, in neither network view) has its own copies on the `back`
  // channel, so it is gone before the front cabinets turn see-through.
  const backRow = mk('BackRow', ch.back);
  const bk = Object.fromEntries(Object.entries(rk).map(([key, mat]) => {
    const c = mat.clone(); c.userData = { ...mat.userData }; return [key, ch.back.add(c)];
  }));
  const ghosts = mk('RackGhosts', ch.ghost);
  const ghostMat = ch.ghost.add(new THREE.LineBasicMaterial({ color: 0x6f8396, transparent: true, opacity: 0.35 }));
  const devPos = new Map(), devOf = new Map();
  const rowOrders = { front: [], back: [] };
  for (const [id, r] of Object.entries(lab.racks)) {
    const x = xOfOrder(r.order), z = r.row === 'back' ? BACK_Z : FRONT_Z;
    const [grp, M, labelCh] = r.row === 'back' ? [backRow, bk, ch.back] : [racks, rk, ch.racks];
    grp.add(at(box(RACK_W, RACK_H, RACK_D, M.rack), x, RACK_H / 2, z));
    if (r.row === 'front') {
      const gh = new THREE.LineSegments(UNIT_EDGES, ghostMat);
      gh.scale.set(RACK_W, RACK_H, RACK_D); gh.position.set(x, RACK_H / 2, z);
      ghosts.add(gh);
    }
    const lbl = labelPlane(id, 0.26, 0.1, labelCh.add(new THREE.MeshBasicMaterial({ transparent: true })));
    grp.add(at(lbl, x, RACK_H + 0.07, z + RACK_D / 2 - 0.01));
    for (const dv of r.devices) {
      const y = RACK_PLINTH + (dv.ru - 1 + dv.h / 2) * U_M;
      devPos.set(dv.name, new THREE.Vector3(x, y, z + DEV_FRONT));
      devOf.set(dv.name, dv);
      if (flyerNames.has(dv.name)) continue;
      const panel = at(box(DEV_W, dv.h * U_M - 0.18 * IN, DEV_D, dv.state === 'deployed' ? M.devD : M.devP), x, y, z + DEV_FRONT);
      const e = new THREE.LineSegments(UNIT_EDGES, M.edge);
      e.scale.set(DEV_W, dv.h * U_M - 0.18 * IN, DEV_D); e.position.copy(panel.position);
      grp.add(panel, e);
    }
    rowOrders[r.row].push(r.order);
  }
  for (const [row, orders] of Object.entries(rowOrders)) {
    orders.sort((a, b) => a - b);
    for (let i = 0; i < orders.length - 1; i++) {
      if (orders[i + 1] - orders[i] !== 1) continue;
      const z = (row === 'back' ? BACK_Z : FRONT_Z) + 3 * IN;
      (row === 'back' ? backRow : racks).add(at(box(6 * IN - 0.2 * IN, RACK_H, RACK_D + 6 * IN, (row === 'back' ? bk : rk).mgr), (xOfOrder(orders[i]) + xOfOrder(orders[i + 1])) / 2, RACK_H / 2, z));
    }
  }
  // ---- Zone signs and ring-node signs, placed as index.html places them (lab-layouts.mjs) ----
  const signs = mk('Signs', ch.signs);
  for (const { zone: z, bottom, hRU } of zoneSignBands(lab)) {
    if (z.label === 'Outdoor Units' || hRU < 2) continue; // as index.html: not signed / no room
    const a = xOfOrder(+z.rackStart.slice(1)), b = xOfOrder(+z.rackEnd.slice(1));
    const left = Math.min(a, b) - RACK_W / 2, right = Math.max(a, b) + RACK_W / 2, hM = hRU * U_M;
    const sign = signMesh(bigLabelCanvas(z.label, right - left, hM, { keepAspect: !!z.keepAspect }), right - left, hM,
      ch.signs.add(new THREE.MeshBasicMaterial()));
    signs.add(at(sign, (left + right) / 2, RACK_PLINTH + (bottom - 1) * U_M + hM / 2, FRONT_Z + RACK_D / 2 + 6.5 * IN));
  }
  for (const ns of lab.nodeSigns || []) { // a 1U plate in the U below each ring node
    const rk = lab.racks[ns.rack];
    if (!rk) continue;
    const w = 19 * IN, h = U_M - 0.18 * IN;
    const plate = signMesh(nodeSignCanvas(ns.unit, ns.role, w, h), w, h, ch.signs.add(new THREE.MeshBasicMaterial()));
    signs.add(at(plate, xOfOrder(rk.order), RACK_PLINTH + (ns.ru - 1 + 0.5) * U_M, (rk.row === 'back' ? BACK_Z : FRONT_Z) + DEV_FRONT));
  }


  // ---- Network nodes and the devices that move to them ----
  // A node stands over (or under) its device's rack: x is the device's, z its own depth in the network.
  const net = mk('Network');
  const sysOf = (id) => model.sysOf[id] || [];
  const nodes = {}; // id -> { n, group, mats, height, width, base, cur, label, primary, c, sys }
  const centroidX = {}; // per line system, for setting an amp's label to the outside
  for (const j of model.joins) {
    const n = j.node, nm = nodeMesh(n.type), from = devPos.get(j.primary);
    const base = new THREE.Vector3(from.x + (n.dx || 0) * R * S, DIORAMA.y + layerY(n.layer) * S, DIORAMA.z + n.z * S);
    net.add(nm.group);
    const hM = n.layer === 'ip' ? (n.type === 'switch' ? 0.05 : 0.07) : n.layer === 'tr' ? 0.062 : 0.058;
    const label = textSprite(n.name, hM, { accent: n.layer === 'tr' ? '#9aa0ad' : '#dc0000' });
    label.material.depthTest = false; label.renderOrder = 10; // never hidden behind another node
    net.add(label);
    nodes[n.id] = { n, ...nm, base, cur: base.clone(), label, c: 0, sys: sysOf(n.id) };
    if (n.layer === 'ph') (centroidX[n.sys] ||= []).push(base.x);
  }
  for (const k of Object.keys(centroidX)) centroidX[k] = centroidX[k].reduce((a, b) => a + b, 0) / centroidX[k].length;
  for (const nd of Object.values(nodes)) {
    const n = nd.n;
    if (n.layer !== 'ph') continue;
    // photonic labels hang in front of their node, clear of the transport layer above; an amp's sits outside the ring
    nd.side = n.type === 'amp' ? Math.sign(nd.base.x - centroidX[n.sys]) || 1 : 0;
    nd.label.center.set(nd.side ? (nd.side < 0 ? 1 : 0) : 0.5, 1);
  }
  // one flyer per device: the node's own device, and its helper shelves, which merge into it
  const flyers = new Map();
  for (const j of model.joins) {
    const node = nodes[j.node.id];
    const delay = j.node.layer === 'ip' ? (lab.racks[j.rack].order - 1) * PHASES.ipStagger : 0;
    [j.primary, ...j.helpers].forEach((name, i) => {
      const dv = devOf.get(name);
      const mat = fader(new THREE.MeshStandardMaterial({ color: 0xccd2d9, emissive: 0xccd2d9, roughness: 0.55, metalness: 0.12 }));
      mat.userData.emissive = dv.state === 'deployed' ? 0.16 : 0.06;
      const mesh = new THREE.Mesh(UNIT_BOX, mat);
      const edgeMat = fader(new THREE.LineBasicMaterial({ color: 0xf6a623 }));
      const edges = new THREE.LineSegments(UNIT_EDGES, edgeMat);
      net.add(mesh, edges);
      const f = { name, node, primary: i === 0, delay: delay + (i ? 0.006 : 0), from: devPos.get(name),
        size: new THREE.Vector3(DEV_W, dv.h * U_M - 0.18 * IN, DEV_D), mesh, mat, edges, edgeMat,
        pos: devPos.get(name).clone(), fibre: new THREE.Vector3(), k: 0 };
      flyers.set(name, f);
      if (i === 0) node.primary = f;
    });
  }

  // ---- Layer slabs (sized to their nodes) and the big captions ----
  const slabs = {};
  for (const k of LAYER_ORDER) {
    const ns = Object.values(nodes).filter((nd) => nd.n.layer === k);
    const zs = ns.map((nd) => nd.base.z);
    if (k === 'ph') for (const [, , lane] of PH_JOINS) zs.push(DIORAMA.z + lane * S); // the RLS-300 lanes in front
    const mg = LAYERS[k].margin * S;
    const x0 = Math.min(...ns.map((nd) => nd.base.x)) - mg, x1 = Math.max(...ns.map((nd) => nd.base.x)) + mg;
    const z0 = Math.min(...zs) - mg, z1 = Math.max(...zs) + mg, w = x1 - x0, d = z1 - z0;
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, DIORAMA.y + layerY(k) * S - 0.03, (z0 + z1) / 2);
    const mat = fader(new THREE.MeshStandardMaterial({ color: 0xe8edf3, roughness: 0.85, transparent: true, opacity: 0.16 }), 0.16);
    mat.userData.noDepth = true;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22 * S, d), mat); slab.renderOrder = -1;
    const eMat = fader(new THREE.LineBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.8 }), 0.8);
    g.add(slab, new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), eMat));
    net.add(g);
    // the layer caption: the biggest text on the diorama, where no node, link or label crosses it — outside
    // the slab's front-left corner, or above its back edge for the IP slab (its drops sweep down in front)
    const text = LAYERS[k].caption, cap = textSprite(text, CAPTION_LINE * text.split('\n').length, { bg: 'rgba(10,14,20,0.7)', fg: '#eaf1f8', weight: 700 });
    if (LAYERS[k].place === 'above') { cap.center.set(0.5, 0); cap.position.set(g.position.x, g.position.y + 0.3, z0); }
    else { cap.center.set(1, 0); cap.position.set(x0 - 0.08, g.position.y + 0.02, z1); }
    net.add(cap);
    slabs[k] = { g, mats: [mat, eMat], cap };
  }

  // ---- Links ----
  const links = mk('Links');
  const dashTex = dashTexture(), specTex = spectrumTexture();
  const basic = (color, opacity = 1) => fader(new THREE.MeshBasicMaterial({ color, transparent: true, opacity }), opacity);
  const dashed = (color) => { const mm = basic(color); mm.map = dashTex.clone(); mm.map.needsUpdate = true; mm.alphaTest = 0.5; return mm; };
  const net_ = []; // { layer, sys[], show(a), update(time), label? }
  const top = (id) => _w.copy(nodes[id].cur).setY(nodes[id].cur.y + nodes[id].height);
  const mid = (id, out) => out.copy(nodes[id].cur).setY(nodes[id].cur.y + nodes[id].height * 0.5);
  const both = (a, b) => { const s1 = sysOf(a), s2 = sysOf(b), i = s1.filter((x) => s2.includes(x)); return i.length ? i : [...new Set([...s1, ...s2])]; };
  // photonic spans: spectrum ribbons from node edge to node edge
  for (const sysDef of PH_SYSTEMS) {
    const ids = sysDef.nodes.filter((id) => nodes[id]);
    for (let i = 0; i < (sysDef.ring ? ids.length : ids.length - 1); i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length];
      const mat = fader(new THREE.MeshBasicMaterial({ map: specTex, transparent: true, opacity: 0.42, side: THREE.DoubleSide }), 0.42);
      mat.userData.noDepth = true;
      const rb = new Ribbon(links, mat, RIBBON.h * S);
      const pa = new THREE.Vector3(), pb = new THREE.Vector3();
      net_.push({ layer: 'ph', sys: [sysDef.sys], show: (al) => rb.show(al), update: () => {
        pa.copy(nodes[a].cur); pb.copy(nodes[b].cur);
        _v.subVectors(pb, pa).setY(0).normalize();
        pa.addScaledVector(_v, nodeEdge(nodes[a].n)); pb.addScaledVector(_v, -nodeEdge(nodes[b].n));
        pa.y = pb.y = nodes[a].cur.y + RIBBON.y0 * S;
        rb.set(pa, pb);
      } });
    }
  }
  // the RLS-300 joining the rings: fibres on lanes in front of the rings
  for (const [a, b, lane, step] of PH_JOINS) {
    if (!nodes[a] || !nodes[b]) continue;
    const mat = basic(0x7fd0e6), segs = [0, 1, 2, 3].map(() => new Seg(links, mat, 0.007));
    const p = [0, 1, 2, 3, 4].map(() => new THREE.Vector3());
    net_.push({ layer: 'ph', sys: [nodes[a].n.sys, nodes[b].n.sys], show: (al) => segs.forEach((sg) => sg.show(al)), update: () => {
      const y = nodes[a].cur.y + (RIBBON.y0 + 0.5 * RIBBON.h) * S, lz = DIORAMA.z + lane * S;
      p[0].copy(nodes[a].cur).setY(y);
      p[1].copy(p[0]).x += step * R * S;
      p[2].set(p[1].x, y, lz); p[3].set(nodes[b].cur.x, y, lz);
      p[4].copy(nodes[b].cur).setY(y);
      for (let i = 0; i < 4; i++) segs[i].set(p[i], p[i + 1]);
    } });
  }
  // wavelengths: a coloured line on the ribbons at the band's height, with light pulses running along it
  for (const W_ of Object.values(WAVES)) {
    if (!W_.path.every((id) => nodes[id])) continue;
    const segs = [], mat = basic(W_.color);
    for (let i = 1; i < W_.path.length; i++) segs.push(new Seg(links, mat, 0.008));
    const pulseMat = basic(0xffffff);
    const pulses = [0, 1, 2].map(() => { const pm = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), pulseMat); links.add(pm); return pm; });
    const lbl = textSprite(W_.rate, 0.05, { bg: 'rgba(10,14,20,0.75)', fg: '#' + W_.color.toString(16).padStart(6, '0') });
    links.add(lbl);
    const pts = W_.path.map(() => new THREE.Vector3());
    const y = (RIBBON.y0 + W_.band * RIBBON.h) * S;
    let total = 0;
    const along = (u, out) => { // a point at fraction u along the path
      let dd = u * total;
      for (let i = 1; i < pts.length; i++) {
        const l = pts[i].distanceTo(pts[i - 1]);
        if (dd <= l || i === pts.length - 1) return out.lerpVectors(pts[i - 1], pts[i], l ? Math.min(1, dd / l) : 0);
        dd -= l;
      }
      return out;
    };
    net_.push({ layer: 'ph', sys: [nodes[W_.path[0]].n.sys],
      show: (al) => { segs.forEach((sg) => sg.show(al)); pulses.forEach((pm) => (pm.visible = al > 0.5)); setAlpha(pulseMat, al); },
      showLabel: (al) => { lbl.visible = al > 0.003; setAlpha(lbl.material, al); },
      update: (time) => {
        W_.path.forEach((id, i) => pts[i].copy(nodes[id].cur).setY(nodes[id].cur.y + y));
        total = 0;
        for (let i = 1; i < pts.length; i++) { segs[i - 1].set(pts[i - 1], pts[i]); total += pts[i].distanceTo(pts[i - 1]); }
        pulses.forEach((pm, i) => along(((time * 0.09) / Math.max(total, 0.1) + i / 3) % 1, pm.position));
        along(W_.at ?? 0.5, lbl.position).y += (RIBBON.h - W_.band * RIBBON.h) * S + 0.02;
      } });
  }
  // transport adjacencies (dashed)
  for (const [a, b] of TR_LINKS) {
    if (!nodes[a] || !nodes[b]) continue;
    const sg = new Seg(links, dashed(0xc8d6e5), 0.006, 0.05), pa = new THREE.Vector3(), pb = new THREE.Vector3();
    net_.push({ layer: 'tr', sys: both(a, b), show: (al) => sg.show(al), update: () => sg.set(mid(a, pa), mid(b, pb)) });
  }
  // cross-layer drops: grey clients, or a coherent optic in its wavelength's colour; a drop shows with its upper layer
  for (const d of model.drops) {
    const coh = d.optic !== 'grey' && WAVES[d.optic];
    const sg = new Seg(links, basic(coh ? WAVES[d.optic].color : GREY), coh ? 0.005 : 0.0035);
    const pa = new THREE.Vector3();
    net_.push({ layer: nodes[d.a].n.layer, sys: sysOf(d.b).length ? sysOf(d.b) : sysOf(d.a),
      show: (al) => sg.show(al), update: () => sg.set(pa.copy(nodes[d.a].cur), top(d.b)) });
  }
  // RSP adjacencies (dashed, light)
  for (const [a, b] of IP_LINKS) {
    if (!nodes[a] || !nodes[b]) continue;
    const sg = new Seg(links, dashed(0xd7e3f0), 0.0045, 0.04), pa = new THREE.Vector3(), pb = new THREE.Vector3();
    net_.push({ layer: 'ip', sys: both(a, b), show: (al) => sg.show(al), update: () => sg.set(mid(a, pa), mid(b, pb)) });
  }

  // ---- EBC fibres that follow the devices until the handover: the laser rings, the patch fibres ----
  const ebc = [];
  for (const [label_, ring] of Object.entries(lab.rings || {})) {
    const fl = (ring || []).map((n) => flyers.get(n)).filter(Boolean);
    if (fl.length < 3) continue;
    const mat = basic(0xffe000);
    const segs = fl.map(() => new Seg(links, mat, 0.006));
    ebc.push({ ring: true, show: (al) => segs.forEach((sg) => sg.show(al)),
      update: () => fl.forEach((f, i) => segs[i].set(f.fibre, fl[(i + 1) % fl.length].fibre)) });
  }
  // The lab's patch fibres, as index.html draws them in the room: a cable bowed 2.5 in toward the
  // glass, dashed where the inventory says so, with its label (e.g. "(800G)") above the middle.
  // Between two moving devices the cable follows them; the rest stay in the racks and fade with them.
  const fibreLabel = (text) => {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.round(512 * 0.10 / 0.34);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#cdeafe'; ctx.font = `700 52px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, cv.width / 2, cv.height / 2 + 2);
    return new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.10), ch.racks.add(new THREE.MeshBasicMaterial({ map: canvasTex(cv), transparent: true })));
  };
  for (const fb of lab.fibers) {
    const fa = flyers.get(fb.a), fbb = flyers.get(fb.b), pa = devPos.get(fb.a), pb = devPos.get(fb.b);
    if (!pa || !pb) continue;
    const color = new THREE.Color(fb.color).getHex();
    const m_ = pa.clone().add(pb).multiplyScalar(0.5); m_.z += 2.5 * IN;
    if (fb.label) racks.add(at(fibreLabel(fb.label), m_.x, m_.y + 0.12, m_.z + 0.5 * IN));
    if (fa && fbb) {
      const sg = new Seg(links, fb.dashed ? dashed(color) : basic(color), 0.006, fb.dashed ? 0.1 : 0);
      ebc.push({ show: (al) => sg.show(al), update: () => sg.set(fa.fibre, fbb.fibre) });
      continue;
    }
    const mat = ch.racks.add(fb.dashed ? dashed(color) : basic(color));
    const a = pa.clone().setZ(pa.z + 2.5 * IN), b = pb.clone().setZ(pb.z + 2.5 * IN);
    for (const [p, q] of [[a, m_], [m_, b]]) new Seg(racks, mat, 0.006, fb.dashed ? 0.1 : 0).set(p, q);
  }

  // ---- Per-frame evaluation ----
  const ph = PHASES;
  const vec = new THREE.Vector3();
  const hl = (sys, focus) => (sys.length ? 0.1 + 0.9 * Math.max(...sys.map((k) => focus[k] ?? 1)) : 1);
  function update({ t = 0, focus = ALL, time = 0 } = {}) {
    const spot = smooth(...ph.spot, t);
    const shellA = 1 - smooth(...ph.shell, t), racksA = 1 - smooth(...ph.racks, t);
    const ghostA = smooth(...ph.ghost, t) * (1 - smooth(...ph.ghostOut, t));
    ch.shell.set(shellA); ch.signs.set(1 - smooth(...ph.signs, t)); ch.racks.set(racksA); ch.back.set(1 - smooth(...ph.back, t)); ch.ghost.set(ghostA);
    // lights: the room dims for the spotlight, the diorama gets a key light
    const dio = smooth(0.4, 0.75, t);
    lights.hemi.intensity = 0.9 * (1 - 0.75 * spot) + 0.55 * dio;
    lights.sun.intensity = 2.0 * (1 - 0.85 * spot);
    lights.fill.intensity = 0.4 * (1 - 0.6 * spot) + 0.3 * dio;
    lights.key.intensity = 1.6 * dio;
    lights.spot.intensity = 2.2 * spot * (1 - smooth(0.35, 0.6, t));
    m.lens.emissiveIntensity = 1.3 * (1 - 0.9 * spot);
    for (const mm of [rk.devD, rk.devP, bk.devD, bk.devP]) mm.emissiveIntensity = mm.userData.emissive * (1 - 0.85 * spot);

    // the devices move straight to their nodes: photonic together, then transport, then the RSP overlay
    for (const f of flyers.values()) {
      const node = f.node, [a, b] = ph.fly[node.n.layer];
      const k = smooth(a + f.delay, b + f.delay, t), e = easeInOut(k);
      const target = vec.copy(node.base).setY(node.base.y + node.height / 2);
      f.pos.lerpVectors(f.from, target, e);
      f.k = k;
      // body: a rack panel that shrinks toward the node's size, then crossfades into the node mesh
      const sx = lerp(f.size.x, node.width * 0.9, e), sy = lerp(f.size.y, node.height * 0.9, e), sz = lerp(f.size.z, node.width * 0.9, e);
      const merge = f.primary ? 1 : 1 - smooth(0.7, 1, k); // helper shelves merge into the node
      f.mesh.position.copy(f.pos); f.edges.position.copy(f.pos);
      f.mesh.scale.set(sx * merge, sy * merge, sz * merge); f.edges.scale.copy(f.mesh.scale);
      const bodyA = (f.primary ? 1 - smooth(0.8, 1, k) : 1 - smooth(0.6, 0.95, k)) * lerp(1, hl(node.sys, focus), e);
      f.mesh.visible = f.edges.visible = bodyA > 0.003 && merge > 0.01;
      setAlpha(f.mat, bodyA); setAlpha(f.edgeMat, bodyA);
      f.mat.emissiveIntensity = f.mat.userData.emissive * (1 - 0.85 * spot) + 0.75 * spot;
      f.edgeMat.color.setHex(0xf6a623).multiplyScalar(1 + 0.6 * spot);
      f.fibre.copy(f.pos).z += 0.09 * (1 - e); // where a fibre attaches: proud of the rack face while in the rack
      if (f.primary) node.c = smooth(0.8, 1, k);
    }
    // node meshes ride on their primary device and fade in as it lands
    for (const nd of Object.values(nodes)) {
      const f = nd.primary, c = nd.c, h = hl(nd.sys, focus);
      nd.cur.copy(f.pos).setY(f.pos.y - nd.height / 2);
      nd.group.position.copy(nd.cur);
      nd.group.scale.setScalar(S * lerp(0.7, 1, c));
      nd.group.visible = c > 0.003;
      nd.mats.forEach((mm) => setAlpha(mm, c * h));
      const la = smooth(...ph.labels[nd.n.layer], t) * c * h;
      nd.label.visible = la > 0.003; setAlpha(nd.label.material, la);
      if (nd.n.layer === 'ph') nd.label.position.copy(nd.cur).add(_v.set(nd.side * nd.width * 0.55, 0.01, nd.width * (nd.side ? 0.5 : 0.75)));
      else nd.label.position.copy(nd.cur).setY(nd.cur.y + nd.height + 0.02);
    }
    // slabs grow, captions appear
    for (const [k, sl] of Object.entries(slabs)) {
      const g = smooth(...ph.slab[k], t);
      sl.g.scale.set(Math.max(g, 1e-3), 1, Math.max(g, 1e-3));
      sl.g.visible = g > 0.003;
      sl.mats.forEach((mm) => setAlpha(mm, g));
      const a = smooth(...ph.labels[k], t) * g;
      sl.cap.visible = a > 0.003; setAlpha(sl.cap.material, a);
    }
    // the rack fibres hand over to the network's spans, links and drops, layer by layer
    const ebcA = 1 - smooth(...ph.handover, t), ringA = smooth(0.02, 0.1, t) * ebcA;
    for (const l of ebc) { const a = l.ring ? ringA : ebcA; l.show(a); if (a > 0.003) l.update(time); }
    for (const l of net_) {
      const a = smooth(...ph.links[l.layer], t) * hl(l.sys, focus);
      l.show(a);
      l.showLabel?.(smooth(...ph.labels[l.layer], t) * a);
      if (a > 0.003) l.update(time);
    }
  }
  update({ t: 0 });

  return {
    group: root, lights, update, flyers, nodes,
    diorama: DIORAMA.clone(), rackFace: FRONT_Z + RACK_D / 2,
    rackX: (id) => xOfOrder(+id.slice(1)),
  };
}
