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

Racks never move; whole sections (devices, signs, placards, fibers, fiber ring) move
between them. In options 1–3 the RLS / Converged Metro section is on A5–A7, the most
central three racks (A6 sits ~7.5" right of the conference-table axis).
The options live in `RACK_LAYOUTS` in `index.html`,
outside the generated `LAB-RACKS` block, so regenerating the inventory keeps them.

Options 4–6 instead re-place individual devices, from `tools/front-row/options.mjs`: every
front-row device and zone sign sits at its own rack and U, and the back row (B2–B8) never
changes. Zone signs are sized exactly as in options 0–3 (each fills the clear space above its
placard, up to 9U). DCOM and Outdoor stay in A10. The RLS and 6500 rings are 5 nodes each
(3 terminals, 2 amps): every node stays whole in one rack (its OMCs and FMT with it), in ring
order, with a 1U name sign just below it tagged **TERMINAL** or **AMP** (options 0–3 show the
same tagged node signs). Fibers and fiber rings follow their devices. The **Front-row
elevation ›** link at the top right opens the flat elevation of whichever layout is showing.

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
