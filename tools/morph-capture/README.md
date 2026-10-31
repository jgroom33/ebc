# morph-capture

Headless tooling for `morph.html` (Playwright + chromium with software GL). Nothing here is
served by the site; it renders the page over a local static server and writes files elsewhere.

```bash
cd tools/morph-capture && npm install          # playwright 1.62 (+ its chromium), static ffmpeg / ffprobe
ROOT=../..                                     # the repo root, served at http://127.0.0.1:<port>/

node capture.mjs $ROOT ~/ebc-ar-vr-evidence/frames            # 1920x1080 PNGs of the scripted sequence, 30 fps
node capture.mjs $ROOT ~/ebc-ar-vr-evidence/frames --limit 300 # a test run
node stills.mjs  $ROOT ~/ebc-ar-vr-evidence                   # ws6500 / wsrls at t = 0, 0.5, 1
node seqframes.mjs $ROOT out 25 31 39                         # single frames at sequence seconds
node measure.mjs $ROOT 300 [--shot] [--live]                  # memory probe: renderer.info, JS heap, Chrome RSS
node index-check.mjs $ROOT                                    # index.html loads with no console errors
```

`capture.mjs` is batch-safe: it relaunches the browser every 150 frames, writes each frame to a
`.tmp.png` and renames it, resumes from the frames already on disk, logs Chrome's RSS and
`renderer.info` per batch to `capture.log`, and stops cleanly after `--max-seconds` (default 540,
so it fits a 10-minute job slot; rerun to continue). Encode the frames with ffmpeg:

```bash
./node_modules/ffmpeg-static/ffmpeg -framerate 30 -i frames/frame-%05d.png \
  -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart ebc-morph-1080p.mp4
```

Chrome RSS is summed over the process tree with `pstree -pT` (threads excluded): summing
`/proc/<tid>/status` over threads over-counts a ~350 MB browser as ~8 GB.

`rotation-probe.mjs <root> <outdir>` prints the camera's yaw / pitch / roll across the 2D-to-3D
segment (Sequence, and scrub with the capture camera, both views) and saves frames of it; yaw
should stay constant until the scripted orbit at 25 s.

`travel-probe.mjs <root>` prints, per CAL node and view, the rack slot it flies from, the node it
lands on and the dx / dy / dz between them (optical nodes should be a near-vertical drop).
`scrubframes.mjs <root> <outdir> <view> <t>...` saves stills of one view at given t values.
`default-check.mjs <root> <outdir>` opens morph.html with the UI (plain and `?view=ws6500`) and
reports the view it starts on, the highlighted tab and the sequence's start / end view.

`room-match.mjs <root>` checks that the morph's room is `index.html?layout=9`: identical lab data
and identical zone / ring-node sign rectangles. `index-baseline.mjs <root> <outdir>` dumps
index.html's lab data and built lab (every object) for each layout, to diff before / after a change
to `lab-layouts.mjs`. `joinlog.mjs <root>` prints the morph's CAL-node → device joins.

`autoplay-check.mjs <root> [loops]` checks the opening autoplay: capture camera, the sequence looping
(Chrome RSS and renderer.info per 12 s over the loops), pause on each interaction, resume with Loop / P,
`?autoplay=0` and `?capture` paused, and a recording as one pass.

`mobile-check.mjs <root> <outdir> [--loop]` emulates iPhone 15 (393x852 @3x) and Pixel 8 (412x915 @2.625x),
portrait and landscape: navs hidden, snapshots at t = 0, mid-morph, t = 1 and the orbit's ends, tap
pause / resume, a live rotation, and (with --loop) Chrome RSS over one loop. `browser.mjs` takes a
`device` option (deviceScaleFactor, isMobile, hasTouch); `MORPH.snapAt(sec)` returns one frame of the
sequence as a PNG data URL outside capture mode.
