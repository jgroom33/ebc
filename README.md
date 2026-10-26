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

Four front-row (A1–A10) arrangements. Step through them live with the **‹ / ›** bar at the
top of the screen (or the ← / → keys), or link straight to one. Spotlight and Fiber Ring
stay on across a switch, so you can watch them move:

| Layout | Front row (A1 → A10) | Link |
| --- | --- | --- |
| Today's plan | Access/TDM · Converged Metro/RLS · Aggregation/ELS · DCI/6500 · Outdoor | `?layout=0` |
| Option 1, Access to Core | Access → TDM → Aggregation → Converged Metro → DCI across the top; ELS over 6500 over RLS below | `?layout=1` |
| Option 2, Photonic in the Center | Route/switch · RLS over 6500 photonic · Waveserver/WSAi over 6500-D7 · Outdoor | `?layout=2` |
| Option 3, Portfolio Vertical Slices | One rack each: Access+TDM · Aggregation · Converged Metro · ELS · 6500 · RLS · Waveserver | `?layout=3` |

Each option places every front-row device and 3U zone sign at its own rack and U; the back
row (B2–B8) never changes. Fibers, fiber rings and the RLS name placards follow their
devices. The **Front-row elevation ›** link at the top right opens the current option's
flat elevation.

## Front-row elevations

The layouts live in `tools/front-row/options.mjs`, the single source for both the 3D scene
(which imports it) and [`front-row/`](front-row/): a flat front elevation per option plus a
comparison page (story, U used/free per rack, room to grow, trade-offs). After changing them:

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
