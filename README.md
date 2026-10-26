# Ciena EBC — Glass-Walled Conference Room

A real-time 3D rendering of an Executive Briefing Center conference room, built with
[three.js](https://threejs.org/). The room's long wall is glass; beyond it runs a
hallway, and the far side of the hallway is a **second glass wall of equal length** —
so you can see straight through: room → glass → hallway → glass → beyond.

Orbit with the mouse to inspect it. The whole thing is a **single, self-contained
`index.html`** (three.js loads from a CDN), so it runs on GitHub Pages with no build step.

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

Racks never move; whole sections (devices, signs, placards, fibers, fiber ring) move
between them. In every option the RLS / Converged Metro section is on A5–A7, the most
central three racks (A6 sits ~7.5" right of the conference-table axis).
The options live in `RACK_LAYOUTS` in `index.html`,
outside the generated `LAB-RACKS` block, so regenerating the inventory keeps them.

## Front-row elevations

[`front-row/`](front-row/) has flat front elevations of the customer-facing row, racks
A1–A10, for today's plan and three re-arrangements (Access to Core, Photonic in the Center,
Portfolio Vertical Slices), plus a comparison page (story, U used/free per rack, room to grow,
trade-offs). The **Front-row elevations ›** link at the top right of the 3D scene opens it.
These are separate from the 3D switcher's layouts above: they move individual devices, not
whole sections.

The layouts live in `tools/front-row/options.mjs`. After changing them:

```bash
node tools/front-row/check.mjs   # every device placed once, no overlaps, every rack <= 58U
node tools/front-row/gen.mjs     # redraw front-row/*.svg and front-row/index.html
```

## Lab rack data

The racks, zone signs, fiber rings and RLS name plates are baked into `index.html` from the
EBC layout in the [na-sales-lab](https://github.com/ciena-corp/na-sales-lab) inventory YAML
(`provisioner/inventory/`). To refresh after an inventory change:

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
