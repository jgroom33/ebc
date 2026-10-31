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
