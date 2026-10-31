# Ciena EBC — Glass-Walled Conference Room

A real-time 3D rendering of an Executive Briefing Center conference room, built with
[three.js](https://threejs.org/). The room's long wall is glass; beyond it runs a
hallway, and the far side of the hallway is a **second glass wall of equal length** —
so you can see straight through: room → glass → hallway → glass → beyond.

Orbit with the mouse to inspect it. The whole thing is a **single `index.html`** (three.js loads from a CDN; the front-row
layouts load from `tools/front-row/options.mjs`), so it runs on GitHub Pages with no build step.

## What's in the scene

- Floor + ceiling (the side and rear walls are intentionally left **open** so you
  can orbit/pan around the room from any angle without a wall blocking the view)
- **Near glass wall** (the room's long wall) with a glass **door**
- **Hallway** (6 ft) with a polished floor and its own ceiling lights
- **Far glass wall**, equal length, on the other side of the hallway
- A long conference table with chairs (heads + both long sides)
- A freestanding **media wall** carrying the display, **CIENA** logo, and a brand-blue accent bar
- Recessed ceiling lights + raking sun through the glass for soft shadows

## Viewing it

### GitHub Pages
In the repo, go to **Settings → Pages**, set **Source = Deploy from a branch**,
**Branch = `main`**, folder **`/ (root)`**, and save. The site publishes at
`https://jgroom33.github.io/ebc/`. (Needs internet, since three.js loads from a CDN.)

### Locally
`index.html` uses ES modules + an import map, which don't load from a `file://`
URL, so serve it over HTTP:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
# or:  npx serve .
```

## Rack layout options

Alternative front-row arrangements, all with the **RLS centred**. Step through them live
with the **‹ / ›** bar at the bottom of the screen (or the ← / → keys), or link straight to one.
Spotlight and Fiber Ring stay on across a switch, so you can watch them move:

| Layout | Front row (A1 → A10) | Link |
| --- | --- | --- |
| Current | TDM · RLS · ELS · 6500 · Outdoor | `?layout=0` |
| Option 1, optical core | TDM · 6500 · **RLS** · ELS · Outdoor | `?layout=1` |
| Option 2, edge → core | Outdoor · TDM · ELS · **RLS** · 6500 | `?layout=2` |
| Option 3, aggregation left | ELS · Outdoor · TDM · **RLS** · 6500 | `?layout=3` |
| Option 4, Access to Core | Access → TDM → Aggregation → Converged Metro → DCI across the top; ELS over 6500 over RLS below | `?layout=4` |
| Option 5, Photonic in the Center | Route/switch · RLS over 6500 photonic · Waveserver/WSAi over 6500-D7 · DCOM/Outdoor | `?layout=5` |
| Option 6, Portfolio Vertical Slices | One rack each: Access+TDM · Aggregation · Converged Metro · ELS · 6500 photonic · 6500 services · RLS · Waveserver · DCOM/Outdoor | `?layout=6` |
| Option 9, Photonic on the bottom | Three bands across A2–A9: **Metro & Aggregation** (IP) on top, **Datacenter Interconnect and Waveserver** (transport) in the middle, photonic at the bottom: 6500 (A2–A4) · RLS (A5–A7) · RLS-300 over ELS (A8–A9). A1: Access over 6500 Services; A10 empty; TDM to the back row (B4) | `?layout=9` |

Racks never move; whole sections (devices, signs, placards, fibers, fiber ring) move
between them. In options 1–3 the RLS / Converged Metro section is on A5–A7, the most
central three racks (A6 sits ~7.5" right of the conference-table axis).
The options live in `RACK_LAYOUTS` in [`lab-layouts.mjs`](lab-layouts.mjs) (shared by `index.html`
and `morph.html`, together with the lab data per layout, the zone-sign placement and the sign
canvases), outside the generated `LAB-RACKS` block, so regenerating the inventory keeps them.

Options 4–6 instead re-place individual devices, from `tools/front-row/options.mjs`: every
front-row device and zone sign sits at its own rack and U, and the back row (B2–B8) never
changes. Zone signs are sized exactly as in options 0–3 (each fills the clear space above its
placard, up to 9U). DCOM and Outdoor stay in A10. The RLS and 6500 rings are 5 nodes each
(3 terminals, 2 amps): every node stays whole in one rack (its OMCs and FMT with it), in ring
order, with a 1U name sign just below it tagged **TERMINAL** or **AMP** (options 0–3 show the
same tagged node signs). Fibers and fiber rings follow their devices. The **Front-row
elevation ›** link at the top right opens the flat elevation of whichever layout is showing.

Option 9 (the 8th dot on the bar; its `id: 9` keeps the URL number) starts from Option 1
(`base: 1`) and re-places devices on top of it as three bands across A2–A9, the same layers as
the morph: IP on top, transport in the middle, photonic at the bottom.

- Bottom (photonic, U1–U26, signs in one band at U27–U34): 6500 on A2–A4 and RLS on A5–A7 as in
  Option 1; Uptown (A8) and Downtown (A9) at U23–U26 under **RLS-300**, with the ELS shelves
  below them (U5–U13) under an **ELS** sign at U14–U22.
- Middle (transport), U35: the two fibered links, ends spread over their line system like the
  terminals: WSAi WS-2P ↔ WS-1P (400G) over the 6500 in A2 / A4, Waveserver 5 West ↔ East
  (800G) over the RLS in A5 / A7; one **Datacenter Interconnect and Waveserver** sign across
  A2–A9 (U36–U41).
- Top (IP, U42 up): all Converged Metro and Aggregation gear under one **Metro & Aggregation**
  sign across A2–A9 (U49+). Each Converged Metro group (an 8192 with its gear) spans two
  adjacent racks over the 6500 / RLS (A2–A3, A4–A5, A6–A7); Aggregation stays over the ELS.
- A1 keeps Access on top with the two 6500-D7 services shelves below (U11–U26, **6500
  Services** sign). A10 is empty. TDM goes to the empty back-row rack B4 (same U).

The layout entry's keys, applied by `moveLabData`: `moves` (one device to a rack and U),
`stacks` (devices stacked bottom-up from a U), `shift` (a rack's lower section N racks; unused
by Option 9 now), `dropZones` / `addZones`, and `alignedZones` (the signs sharing the lower
band). A zone with `keepAspect` draws its sign texture at the sign's own aspect, so the 8-rack
signs aren't stretched. Ring-node signs follow the device just above them; fibers and rings
follow by device name. `moveLabData` logs a console error if a move puts gear outside a rack
or on top of other gear. Option 9 has no flat elevation in `front-row/` yet.

## Front-row elevations

[`front-row/`](front-row/) has a flat A1–A10 front elevation for each of the seven layouts
plus a comparison page (story, U used/free per rack, room to grow, trade-offs). They come from
`tools/front-row/options.mjs`: options 4–6 directly, Current and options 1–3 as today's plan
re-ordered by the same rack blocks as `RACK_LAYOUTS` (the check keeps the two in step).
After changing them:

```bash
node tools/front-row/check.mjs   # all 7 layouts: every device once, no overlaps, every rack <= 58U,
                                 # every node whole, in order, with its sign; DCOM + Outdoor placed
node tools/front-row/check.mjs --selftest   # proves the check catches broken layouts
node tools/front-row/gen.mjs     # redraw front-row/*.svg and front-row/index.html
```

## Lab rack data

The racks, zone signs, fiber rings and RLS name plates are baked into `index.html` from the
EBC layout in the [na-sales-lab](https://github.com/ciena-corp/na-sales-lab) inventory YAML
(`provisioner/inventory/`); options 4–6 take front-row positions and zone signs from
`tools/front-row/options.mjs` instead, and every layout takes its ring-node signs from it. To refresh after an inventory change:

```bash
node tools/gen-rack-layout.mjs        # fetches ../lab and reads origin/main
```

`LAB_REPO` / `LAB_REF` point it at another checkout or ref, and `--no-fetch` skips the fetch.
It reads files with `git show`, so the lab checkout's working tree is never used. Needs
`python3` with PyYAML.

## Room → network morph (`morph.html`)

[`morph.html`](morph.html) starts in the room with the racks in **option 9** (exactly
`index.html?layout=9`, signs included: both pages lay the racks out with `lab-layouts.mjs`) and
morphs them into a network view: the equipment moves out of the racks into a standing three-layer
diorama in front of the rack row (photonic, transport, IP; about 0.15 m per network-view unit).
Option 9's three bands are the diorama's layers, and each node stands under or over the rack its device
lives in, so nothing moves sideways. It is **one network**: the 6500 ring (A2–A4), the RLS ring
(A5–A7) and the ELS with the RLS-300 pair (A8–A9) drop together into one photonic layer; the
Waveservers ride the line system under their racks (the Waveserver 5 800G link over the RLS, the
WSAi 400G link over the 6500) with the 6500-D7s (A1) on the 6500; then every RSP router and switch
of the top band rises into the IP / Ethernet layer and attaches straight down, only to gear in its own
rack column: a grey **1310** client into the Waveserver below it, or a **direct** pluggable into the
line system below it (orange 6500, green RLS, yellow ELS; the legend says so). The tabs at the top are
focus filters (**All**, **6500**, **RLS**, **ELS**; keys 1–4, `?focus=rls`) that bring one line system
and what rides on it forward.

- One value `t` (0 = room, 1 = network) drives the whole morph and is evaluated every frame, so it
  scrubs and reverses: slider, ← / → (shift for bigger steps), Home / End, space to play.
  1–4 set the focus (All / 6500 / RLS / ELS, the tabs' order).
- **Camera: capture path** rides a scripted camera (a conference-room seat, then a dolly over the
  glass, on one azimuth); **Sequence** plays the full 72 s script (spotlight → the line systems drop →
  transport → the RSP overlay attaches → a tour of the 6500, RLS and ELS in focus → back to the room);
  **Record 1080p** records that sequence at 1920×1080 to a `.webm` (MediaRecorder).
- `morph.html?capture` renders a fixed 1920×1080 frame on demand with `MORPH.renderAt(seconds)`,
  for frame-exact offline capture; `tools/morph-capture/` has the batch-safe headless capture.
- `morph/model.mjs` holds the option-9 racks (`index.html`'s generated `LAB-RACKS` block laid out by
  `lab-layouts.mjs`, so a re-bake or a layout change reaches it) and the network: names, layer, type,
  placement and links only, from the CAL network views (line systems, Waveserver 5, 6500-D7,
  8192 / 8110 / 8112 / 8114), the lab's LAB_RACKS fibres, and inferred links for the rest of the RSP gear
  (patched per reservation, so it has no fixed links); every link carries its
  source (`cal`, `lab` or `inferred`). Missing joins are logged to the console. `morph/engine.mjs` is
  renderer-agnostic (meshes and sprite labels, no CSS2D), so a WebXR page can reuse it.

## Customising

Everything is parametric. Open `index.html` and edit the `CONFIG` block near the top
of the inlined `<script type="module">` — all dimensions are in feet (`FT`) or inches (`IN`):

| Setting | What it changes |
| --- | --- |
| `roomLength` / `roomDepth` / `ceilingHeight` | Room (and glass-wall length) proportions |
| `hallWidth` | Gap between the two glass walls |
| `doorWidth` / `doorHeight` | The opening in the near glass wall |
| `tableLength` / `tableWidth` / `chairsPerSide` | Furniture |
| `lightCols` / `lightRows` | Ceiling-light grid |
| `cienaRed` | The CIENA logo colour |
| `color.*` | Full palette, including `brandBlue` |

Each element is its own `THREE.Group` (named in the scene graph), so it's easy to
find and tweak. The scene objects are also exposed on `window.EBC` for live
experimentation in the browser console (e.g. `EBC.CONFIG`, `EBC.mat.glass`).

## Tech notes

- Glass uses `MeshPhysicalMaterial` with `transmission`, lit by an image-based
  `RoomEnvironment` (baked through a `PMREMGenerator`) so it reflects/refracts
  believably without any external HDR file.
- Ceiling fixtures use `RectAreaLight`s for soft fill; a shadow-casting
  `DirectionalLight` provides the key light and contact shadows.
- Pinned to `three@0.160.0` via the import map in `index.html`.
