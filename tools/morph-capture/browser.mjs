// Launch headless chromium (software GL) and open morph.html; returns { page, close, rss }.
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execSync } from 'node:child_process';
export async function openMorph(url, { capture = true, width = 1920, height = 1080 } = {}) {
  const server = await chromium.launchServer({ headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'] });
  const top = server.process().pid;
  const browser = await chromium.connect(server.wsEndpoint());
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${url}/morph.html${capture ? '?capture' : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.MORPH, null, { timeout: 90000 });
  const rss = () => { // anon RSS and total RSS (MB) over the chrome process tree, threads excluded
    const pids = execSync(`pstree -pT ${top} | grep -o '([0-9]*)' | tr -d '()'`, { encoding: 'utf8' }).trim().split('\n');
    let anon = 0, rss = 0;
    for (const p of new Set(pids)) { try { const s = fs.readFileSync(`/proc/${p}/status`, 'utf8'); anon += +(s.match(/RssAnon:\s+(\d+)/)?.[1] ?? 0); rss += +(s.match(/VmRSS:\s+(\d+)/)?.[1] ?? 0); } catch {} }
    return { procs: new Set(pids).size, anonMB: Math.round(anon / 1024), rssMB: Math.round(rss / 1024) };
  };
  return { page, errors, rss, close: async () => { await browser.close(); await server.close(); } };
}
