// Camera yaw / pitch / roll across the 2D-to-3D segment, in Sequence mode and in scrub + capture-path
// mode, plus frames of the segment.  node rotation-probe.mjs <root> <outdir>
import { serve } from './serve.mjs';
import { openMorph } from './browser.mjs';
import fs from 'node:fs';
const [root, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const { url, close } = await serve(root);
const b = await openMorph(url);
const pose = () => b.page.evaluate(() => {
  const c = MORPH.camera, T = MORPH.THREE, d = c.getWorldDirection(new T.Vector3());
  const yaw = Math.atan2(d.x, -d.z) * 180 / Math.PI, pitch = Math.asin(d.y) * 180 / Math.PI;
  const r = new T.Vector3(1, 0, 0).applyQuaternion(c.quaternion); // camera right: roll if it has a y part
  const roll = Math.atan2(r.y, Math.hypot(r.x, r.z)) * 180 / Math.PI;
  return { yaw: +yaw.toFixed(2), pitch: +pitch.toFixed(2), roll: +roll.toFixed(2), x: +c.position.x.toFixed(2), y: +c.position.y.toFixed(2), z: +c.position.z.toFixed(2), t: +MORPH.state.t.toFixed(3), s: +0 };
});
console.log('# Sequence (capture camera)');
for (const sec of [3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 28, 31, 35, 39, 45]) {
  await b.page.evaluate((sec) => MORPH.renderAt(sec), sec);
  const p = await pose();
  console.log(JSON.stringify({ sec, ...p }));
  if ([7, 11, 15, 19, 23, 25].includes(sec)) await b.page.screenshot({ path: `${out}/seq-${String(sec).padStart(2, '0')}s.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
}
for (const view of ['all', 'rls']) { // focus
  console.log(`# Scrub + Camera: capture path, focus ${view}`);
  for (const t of [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
    await b.page.evaluate(({ t, focus }) => MORPH.still({ t, focus, cam: 'path' }), { t, focus: view });
    console.log(JSON.stringify({ view, ...(await pose()) }));
    if ([0.2, 0.5, 0.8].includes(t)) await b.page.screenshot({ path: `${out}/scrub-${view}-t${t.toFixed(1).replace('.', '_')}.png`, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
  }
}
await b.close(); close();
