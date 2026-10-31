// The morph engine: the EBC room with the layout-1 racks, and the same equipment as the CAL
// network view standing in front of the rack row. One state drives everything, evaluated every
// frame (no chained tweens), so it scrubs and reverses:
//   t  0..1  the morph: room → network
//   s  0..1  the view: 0 = ws6500 (6500 ring), 1 = wsrls (RLS ring)
//   time     seconds, for the light pulses only
// Renderer-agnostic: it builds a THREE.Group and updates it. No DOM beyond canvas textures, no
// CSS2D, no Line2 (links are meshes, labels are sprites), so a WebXR page can reuse it as is.
import * as THREE from 'three';
import {
  NODES, PH_SYSTEMS, WAVES, IP_LINKS, DROPS, TR_LINKS, LAYERS, LAYER_ORDER, VIEWS, RIBBON, GREY, layerY,
} from './model.mjs';

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
  (xOfOrder(4) + xOfOrder(5)) / 2, // the A4 / A5 midline: node x is measured from it, in rack pitches (model R)
  0.3, // photonic layer height, below every optical shelf so each one drops into place; IP lands 1.8 m above
  FRONT_Z + RACK_D / 2 + 0.72, // the deepest ring node (z -3.4 units) sits just in front of the rack faces
);
const nodeBase = (n) => new THREE.Vector3(DIORAMA.x + n.pos[0] * S, DIORAMA.y + layerY(n.layer) * S, DIORAMA.z + n.pos[1] * S);

// ---- Timeline (all windows in t) -------------------------------------------------------------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;
export const PHASES = {
  spot: [0.0, 0.12], // spotlight the view's devices, dim the rest
  signs: [0.1, 0.28],
  shell: [0.12, 0.4], // room shell fades
  racks: [0.16, 0.42], // racks and unrelated devices fade
  back: [0.08, 0.16], // the back rack row goes first: it would show through the clearing front row, offset by perspective
  ghost: [0.3, 0.55], // a faint outline of the racks while the devices leave, so you can see where they came from
  ghostOut: [0.6, 0.85], // and gone before the network has formed (labels come at 0.88)
  fly: { ph: [0.3, 0.6], tr: [0.4, 0.68], ip: [0.48, 0.78] }, // staggered photonic, transport, IP
  slab: { ph: [0.56, 0.76], tr: [0.62, 0.82], ip: [0.68, 0.88] },
  handover: [0.78, 0.9], // device-to-device fibres fade, CAL links and wavelengths fade in
  labels: [0.88, 0.98],
};
// The ring swap: the old ring flies home first, then the other ring comes up.
const presence = (view, s) => (view === 'ws6500' ? 1 - smooth(0, 0.5, s) : smooth(0.5, 1, s));

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
function bigSign(text, wM, hM, mat) { // zone signs, as index.html's makeBigLabel
  const cv = document.createElement('canvas');
  cv.width = 1024; cv.height = Math.max(128, Math.round(1024 * hM / wM));
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  ctx.fillStyle = '#1b2838'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e4002b'; ctx.fillRect(0, h - h * 0.09, w, h * 0.09);
  ctx.fillStyle = '#ffffff';
  let fs = Math.round(h * 0.62);
  ctx.font = `700 ${fs}px ${FONT}`;
  while (ctx.measureText(text).width > w * 0.9 && fs > 12) { fs -= 4; ctx.font = `700 ${fs}px ${FONT}`; }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 - h * 0.02);
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
  } else { // amp: a triangular prism
    const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, PH_H - 0.14, 3), M({ color: RED, roughness: 0.4, emissive: 0x400000 }));
    tri.position.y = 0.14 + (PH_H - 0.14) / 2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.14, 3), M({ color: 0x15161a, roughness: 0.6 }));
    base.position.y = 0.07;
    g.add(base, tri);
    height = PH_H;
  }
  g.scale.setScalar(S);
  const width = (type === 'amp' ? 1.44 : type === 'roadm' ? 1.3 : 1.28) * S;
  return { group: g, mats, height: height * S, width };
}
const nodeEdge = (n) => (n.type === 'amp' ? 0.8 : 0.68) * S; // a ribbon starts at a node's edge

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
  // ---- Zone signs (a 4U plate centred on each zone's RU) ----
  const signs = mk('Signs', ch.signs);
  for (const z of lab.zones) {
    const a = xOfOrder(+z.rackStart.slice(1)), b = xOfOrder(+z.rackEnd.slice(1));
    const left = Math.min(a, b) - RACK_W / 2, right = Math.max(a, b) + RACK_W / 2, hM = 4 * U_M;
    const sign = bigSign(z.label, right - left, hM, ch.signs.add(new THREE.MeshBasicMaterial()));
    signs.add(at(sign, (left + right) / 2, RACK_PLINTH + (z.ru - 1.5) * U_M + hM / 2, FRONT_Z + RACK_D / 2 + 6.5 * IN));
  }

  // ---- Network nodes and the devices that fly to them ----
  const net = mk('Network');
  const nodeById = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const nodes = {}; // id -> { n, mesh, mats, height, base, primary flyer, label }
  for (const n of NODES) {
    if (!model.joins.some((j) => j.node.id === n.id)) continue;
    const nm = nodeMesh(n.type);
    net.add(nm.group);
    const label = textSprite(n.name, 0.075, { accent: n.layer === 'tr' ? '#9aa0ad' : '#dc0000' });
    label.material.depthTest = false; label.renderOrder = 10; // never hidden behind another node
    // Photonic labels hang in front of their node, clear of the transport layer above. An amp sits
    // on a span at the ring's side, under the drops of the Waveserver in front of it, so its label
    // is set to the outside (left of a left-hand amp, right of a right-hand one).
    if (n.layer === 'ph') label.center.set(n.type === 'amp' ? (n.pos[0] < 0 ? 1 : 0) : 0.5, 1);
    net.add(label);
    nodes[n.id] = { n, ...nm, base: nodeBase(n), cur: nodeBase(n), label, c: 0 };
  }
  // one flyer per joined device; a device in both views (routers, Waveservers) has one node in both
  const flyers = new Map();
  const layerIdx = {};
  for (const j of model.joins) {
    const names = [j.primary, ...j.helpers];
    names.forEach((name, i) => {
      let f = flyers.get(name);
      if (!f) {
        const dv = devOf.get(name);
        const mat = fader(new THREE.MeshStandardMaterial({ color: 0xccd2d9, emissive: 0xccd2d9, roughness: 0.55, metalness: 0.12 }));
        mat.userData.emissive = dv.state === 'deployed' ? 0.16 : 0.06;
        const mesh = new THREE.Mesh(UNIT_BOX, mat);
        const edgeMat = fader(new THREE.LineBasicMaterial({ color: 0xf6a623 }));
        const edges = new THREE.LineSegments(UNIT_EDGES, edgeMat);
        net.add(mesh, edges);
        f = { name, from: devPos.get(name), size: new THREE.Vector3(DEV_W, dv.h * U_M - 0.18 * IN, DEV_D), mesh, mat, edges, edgeMat,
          views: {}, pos: devPos.get(name).clone(), k: 0 };
        flyers.set(name, f);
      }
      const key = `${j.view}:${j.node.layer}`;
      if (i === 0) layerIdx[key] = (layerIdx[key] ?? -1) + 1;
      f.views[j.view] = { node: j.node.id, primary: i === 0, delay: (layerIdx[key] ?? 0) * 0.012 + (i ? 0.008 : 0) };
      if (i === 0) nodes[j.node.id].primary = f;
    });
  }

  // ---- Layer slabs and captions ----
  const slabs = {};
  for (const k of LAYER_ORDER) {
    const [w, d] = LAYERS[k].size, [cx, cz] = LAYERS[k].center;
    const g = new THREE.Group();
    g.position.set(DIORAMA.x + cx * S, DIORAMA.y + layerY(k) * S - 0.03, DIORAMA.z + cz * S);
    const mat = fader(new THREE.MeshStandardMaterial({ color: 0xe8edf3, roughness: 0.85, transparent: true, opacity: 0.16 }), 0.16);
    mat.userData.noDepth = true;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w * S, 0.22 * S, d * S), mat); slab.renderOrder = -1;
    const eMat = fader(new THREE.LineBasicMaterial({ color: 0x9fb3c8, transparent: true, opacity: 0.8 }), 0.8);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(slab.geometry), eMat);
    g.add(slab, edge);
    net.add(g);
    // The layer caption: the biggest text on the diorama (readable from the back row), standing just
    // where no node, link or label crosses it: outside the front-left corner for the photonic and
    // transport slabs; above the back edge for the IP slab (its client drops sweep off to the left).
    const above = LAYERS[k].caption === 'above';
    const captions = Object.fromEntries(Object.entries(VIEWS).map(([v, V]) => {
      const text = V.layers[k], n = text.split('\n').length;
      const sp = textSprite(text, CAPTION_LINE * n, { bg: 'rgba(10,14,20,0.7)', fg: '#eaf1f8', weight: 700 });
      if (above) {
        sp.center.set(0.5, 0);
        sp.position.set(g.position.x, g.position.y + 0.3, g.position.z - (d / 2) * S);
      } else {
        sp.center.set(1, 0);
        sp.position.set(g.position.x - (w / 2) * S - 0.08, g.position.y + 0.02, g.position.z + (d / 2) * S);
      }
      net.add(sp);
      return [v, sp];
    }));
    slabs[k] = { g, mats: [mat, eMat], captions };
  }

  // ---- Links ----
  const links = mk('Links');
  const dashTex = dashTexture(), specTex = spectrumTexture();
  const basic = (color, opacity = 1) => fader(new THREE.MeshBasicMaterial({ color, transparent: true, opacity }), opacity);
  const dashed = (color) => { const mm = basic(color); mm.map = dashTex.clone(); mm.map.needsUpdate = true; mm.alphaTest = 0.5; return mm; };
  const cal = []; // { view|null, update() , show(a) }
  const top = (id) => _w.copy(nodes[id].cur).setY(nodes[id].cur.y + nodes[id].height);
  // photonic ring spans: spectrum ribbons from node edge to node edge
  for (const sys of PH_SYSTEMS) {
    const ids = sys.nodes.filter((id) => nodes[id]);
    for (let i = 0; i < (sys.ring ? ids.length : ids.length - 1); i++) {
      const a = ids[i], b = ids[(i + 1) % ids.length];
      const mat = fader(new THREE.MeshBasicMaterial({ map: specTex, transparent: true, opacity: 0.42, side: THREE.DoubleSide }), 0.42);
      mat.userData.noDepth = true;
      const rb = new Ribbon(links, mat, RIBBON.h * S);
      const pa = new THREE.Vector3(), pb = new THREE.Vector3();
      cal.push({ view: sys.views[0], show: (al) => rb.show(al), update: () => {
        pa.copy(nodes[a].cur); pb.copy(nodes[b].cur);
        _v.subVectors(pb, pa).setY(0).normalize();
        pa.addScaledVector(_v, nodeEdge(nodes[a].n)); pb.addScaledVector(_v, -nodeEdge(nodes[b].n));
        pa.y = pb.y = nodes[a].cur.y + RIBBON.y0 * S;
        rb.set(pa, pb);
      } });
    }
  }
  // wavelengths: a coloured line on the ribbons at the band's height, with light pulses running along it
  for (const W_ of Object.values(WAVES)) {
    if (!W_.path.every((id) => nodes[id])) continue;
    const segs = [], mat = basic(W_.color);
    for (let i = 1; i < W_.path.length; i++) segs.push(new Seg(links, mat, 0.008));
    const pulseMat = basic(0xffffff);
    const pulses = [0, 1, 2].map(() => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), pulseMat); links.add(p); return p; });
    const lbl = textSprite(W_.rate, 0.06, { bg: 'rgba(10,14,20,0.75)', fg: '#' + W_.color.toString(16).padStart(6, '0') });
    links.add(lbl);
    const pts = W_.path.map(() => new THREE.Vector3());
    const y = (RIBBON.y0 + W_.band * RIBBON.h) * S;
    let total = 0;
    const along = (u, out) => { // a point at fraction u along the path
      let d = u * total;
      for (let i = 1; i < pts.length; i++) {
        const l = pts[i].distanceTo(pts[i - 1]);
        if (d <= l || i === pts.length - 1) return out.lerpVectors(pts[i - 1], pts[i], l ? Math.min(1, d / l) : 0);
        d -= l;
      }
      return out;
    };
    cal.push({ view: W_.views[0], wave: true,
      show: (al) => { segs.forEach((sg) => sg.show(al)); pulses.forEach((p) => (p.visible = al > 0.5)); setAlpha(pulseMat, al); },
      showLabel: (al) => { lbl.visible = al > 0.003; setAlpha(lbl.material, al); },
      update: (time) => {
        W_.path.forEach((id, i) => pts[i].copy(nodes[id].cur).setY(nodes[id].cur.y + y));
        total = 0;
        for (let i = 1; i < pts.length; i++) { segs[i - 1].set(pts[i - 1], pts[i]); total += pts[i].distanceTo(pts[i - 1]); }
        pulses.forEach((p, i) => along(((time * 0.09) / Math.max(total, 0.1) + i / 3) % 1, p.position));
        along(W_.at ?? (pts.length > 2 ? 0.27 : 0.5), lbl.position).y += (RIBBON.h - W_.band * RIBBON.h) * S + 0.02;
      } });
  }
  // IP adjacencies (dashed, in the colour of the wavelength that carries them in each view)
  for (const [a, b, via] of IP_LINKS) {
    for (const [view, wl] of Object.entries(via)) {
      const sg = new Seg(links, dashed(WAVES[wl].color), 0.006, 0.05);
      const pa = new THREE.Vector3(), pb = new THREE.Vector3();
      cal.push({ view, show: (al) => sg.show(al), update: () => {
        pa.copy(nodes[a].cur).setY(nodes[a].cur.y + nodes[a].height * 0.5);
        pb.copy(nodes[b].cur).setY(nodes[b].cur.y + nodes[b].height * 0.5);
        sg.set(pa, pb);
      } });
    }
  }
  // cross-layer drops: grey clients, or a coherent optic in its wavelength's colour
  for (const [a, b, views, optic, off = [0, 0]] of DROPS) {
    if (!nodes[a] || !nodes[b]) continue;
    const sg = new Seg(links, basic(optic === 'grey' ? GREY : WAVES[optic].color), optic === 'grey' ? 0.004 : 0.005);
    const pa = new THREE.Vector3(), pb = new THREE.Vector3();
    cal.push({ view: views.length > 1 ? null : views[0], show: (al) => sg.show(al), update: () => {
      pa.copy(nodes[a].cur).add(_v.set(off[0] * S, 0, off[1] * S));
      pb.copy(top(b)).add(_v.set(off[0] * S, 0, off[1] * S));
      sg.set(pa, pb);
    } });
  }
  // transport adjacencies (dashed, set apart sideways)
  for (const [a, b, views, wl, off] of TR_LINKS) {
    const sg = new Seg(links, dashed(WAVES[wl].color), 0.006, 0.05);
    const pa = new THREE.Vector3(), pb = new THREE.Vector3();
    cal.push({ view: views[0], show: (al) => sg.show(al), update: () => {
      _v.subVectors(nodes[b].cur, nodes[a].cur).setY(0).normalize();
      _w.set(-_v.z, 0, _v.x).multiplyScalar(off * S);
      pa.copy(nodes[a].cur).add(_w).setY(nodes[a].cur.y + nodes[a].height * 0.5);
      pb.copy(nodes[b].cur).add(_w).setY(nodes[b].cur.y + nodes[b].height * 0.5);
      sg.set(pa, pb);
    } });
  }

  // ---- EBC fibres that follow the devices until the handover: the laser ring, the Waveserver line ----
  const ebc = [];
  const ringOf = { ws6500: lab.rings['6500'], wsrls: lab.rings.RLS };
  for (const [view, ring] of Object.entries(ringOf)) {
    const fl = ring.map((n) => flyers.get(n)).filter(Boolean);
    const mat = basic(0xffe000);
    const segs = fl.map(() => new Seg(links, mat, 0.006));
    ebc.push({ view, show: (al) => segs.forEach((sg) => sg.show(al)),
      update: () => fl.forEach((f, i) => segs[i].set(f.fibre, fl[(i + 1) % fl.length].fibre)) });
  }
  for (const fb of lab.fibers) {
    const fa = flyers.get(fb.a), fbb = flyers.get(fb.b);
    if (!fa || !fbb) continue;
    const sg = new Seg(links, basic(new THREE.Color(fb.color).getHex()), 0.006);
    ebc.push({ view: null, show: (al) => sg.show(al), update: () => sg.set(fa.fibre, fbb.fibre) });
  }

  // ---- Per-frame evaluation ----
  const ph = PHASES;
  const vec = new THREE.Vector3();
  function update({ t = 0, s = 0, time = 0 } = {}) {
    const pres = { ws6500: presence('ws6500', s), wsrls: presence('wsrls', s) };
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

    // flyers
    for (const f of flyers.values()) {
      let k = 0, rel = 0, pick = null;
      for (const [view, r] of Object.entries(f.views)) {
        const p = Object.keys(f.views).length === 2 ? 1 : pres[view]; // in both views: always present
        const [a, b] = ph.fly[nodeById[r.node].layer];
        const kv = smooth(a + r.delay, b + r.delay, t) * p;
        rel = Math.max(rel, p);
        if (kv >= k) { k = kv; pick = r; }
      }
      pick ||= Object.values(f.views)[0];
      const node = nodes[pick.node], e = easeInOut(k);
      const target = vec.copy(node.base).setY(node.base.y + node.height / 2);
      f.pos.lerpVectors(f.from, target, e);
      // an arc up and over, only for a flight that goes somewhere sideways; a drop stays a drop
      const arc = clamp01((Math.hypot(target.x - f.from.x, target.z - f.from.z) - 0.5) / 0.8);
      f.pos.y += Math.sin(Math.PI * e) * 0.35 * arc;
      f.pos.z += Math.sin(Math.PI * e) * 0.15 * arc;
      f.k = k;
      // body: a rack panel that shrinks toward the node's size, then crossfades into the node mesh
      const sx = lerp(f.size.x, node.width * 0.9, e), sy = lerp(f.size.y, node.height * 0.9, e), sz = lerp(f.size.z, node.width * 0.9, e);
      const merge = pick.primary ? 1 : 1 - smooth(0.7, 1, k); // helper shelves merge into the node
      f.mesh.position.copy(f.pos); f.edges.position.copy(f.pos);
      f.mesh.scale.set(sx * merge, sy * merge, sz * merge); f.edges.scale.copy(f.mesh.scale);
      const inRack = Math.max(racksA, 0.22 * ghostA);
      const bodyA = lerp(inRack, 1, rel) * (pick.primary ? 1 - smooth(0.8, 1, k) : 1 - smooth(0.6, 0.95, k));
      f.mesh.visible = f.edges.visible = bodyA > 0.003 && merge > 0.01;
      setAlpha(f.mat, bodyA); setAlpha(f.edgeMat, bodyA);
      const glow = spot * rel;
      f.mat.emissiveIntensity = f.mat.userData.emissive * (1 - 0.85 * spot) + 0.75 * glow;
      f.edgeMat.color.setHex(0xf6a623).multiplyScalar(1 + 0.6 * glow);
      // where a fibre attaches: proud of the rack face while in the rack
      f.fibre ||= new THREE.Vector3();
      f.fibre.copy(f.pos).z += 0.09 * (1 - e);
      if (pick.primary) node.c = Math.max(node.c, smooth(0.8, 1, k));
    }
    // node meshes ride on their primary flyer and fade in as it lands
    for (const nd of Object.values(nodes)) {
      const f = nd.primary;
      const c = nd.c; nd.c = 0;
      nd.cur.copy(f.pos).setY(f.pos.y - nd.height / 2);
      nd.group.position.copy(nd.cur);
      nd.group.scale.setScalar(S * lerp(0.7, 1, c));
      nd.group.visible = c > 0.003;
      nd.mats.forEach((mm) => setAlpha(mm, c));
      const la = smooth(...ph.labels, t) * c;
      nd.label.visible = la > 0.003; setAlpha(nd.label.material, la);
      if (nd.n.layer === 'ph') {
        const side = nd.n.type === 'amp' ? Math.sign(nd.n.pos[0]) * nd.width * 0.55 : 0;
        nd.label.position.copy(nd.cur).add(_v.set(side, 0.01, nd.width * (side ? 0.5 : 0.75)));
      } else nd.label.position.copy(nd.cur).setY(nd.cur.y + nd.height + 0.02);
    }
    // slabs grow, captions appear
    const lab_ = smooth(...ph.labels, t);
    for (const [k, sl] of Object.entries(slabs)) {
      const g = smooth(...ph.slab[k], t);
      sl.g.scale.set(Math.max(g, 1e-3), 1, Math.max(g, 1e-3));
      sl.g.visible = g > 0.003;
      sl.mats.forEach((mm) => setAlpha(mm, g));
      for (const [v, sp] of Object.entries(sl.captions)) {
        const a = lab_ * g * (k === 'ph' ? pres[v] : v === 'ws6500' ? 1 - s : s);
        sp.visible = a > 0.003; setAlpha(sp.material, a);
      }
    }
    // links: device fibres hand over to the CAL links and wavelengths
    const ebcA = smooth(0.02, 0.1, t) * (1 - smooth(...ph.handover, t));
    for (const l of ebc) { const a = ebcA * (l.view ? pres[l.view] : 1); l.show(a); if (a > 0.003) l.update(time); }
    const calA = smooth(ph.handover[0] + 0.04, ph.handover[1] + 0.04, t);
    for (const l of cal) {
      const a = (l.label ? lab_ : calA) * (l.view ? pres[l.view] : 1);
      l.show(a);
      l.showLabel?.(lab_ * a);
      if (a > 0.003) l.update(time);
    }
  }
  update({ t: 0, s: 0 });

  return {
    group: root, lights, update, flyers, nodes,
    diorama: DIORAMA.clone(), rackFace: FRONT_Z + RACK_D / 2,
    rackX: (id) => xOfOrder(+id.slice(1)),
  };
}
