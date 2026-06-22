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
