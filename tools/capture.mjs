// Records a gameplay clip from a page with headless Chrome's screencast (DevTools Protocol) and ffmpeg.
// Usage: node capture.mjs <url> <out-basename> [seconds=12] [warmup=4] [width=1280] [height=720]
// Writes <out-basename>.mp4 (30 fps) and <out-basename>.gif (12 fps, 640 px wide).
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, outBase, secs = '12', warm = '4', W = '1280', H = '720'] = process.argv.slice(2);
if (!url || !outBase) { console.error('usage: node capture.mjs <url> <out-basename> [seconds] [warmup] [w] [h]'); process.exit(1); }
const CHROME = process.env.CHROME || join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 9333 + Math.floor(Math.random() * 500);
const work = mkdtempSync(join(tmpdir(), 'cap-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, 'profile')}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
  // keep rendering at full rate even though no window is visible
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling', 'about:blank',
], { stdio: 'ignore' });
// also clean up Chrome if this script fails midway
// Some Chrome helpers outlive the tree kill, so also stop every process that uses this run's temp profile.
function killChrome() {
  try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* already gone */ }
  const tag = work.split(/[\\/]/).pop();
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
  } catch { /* nothing left */ }
}
process.on('exit', killChrome);

async function wsUrl() {
  for (let i = 0; i < 150; i++) {
    try { return (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(200); }
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await wsUrl());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map(), listeners = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else for (const l of listeners) l(m);
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Emulation.setFocusEmulationEnabled', { enabled: true }, sessionId);
await send('Page.setWebLifecycleState', { state: 'active' }, sessionId).catch(() => {});
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false }, sessionId);
await send('Page.navigate', { url }, sessionId);
await sleep(+warm * 1000);

// GPU check: report the WebGL renderer so a software fallback is visible in the log
const gpu = await send('Runtime.evaluate', { expression: `(() => { const c = document.createElement('canvas').getContext('webgl2'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`, returnByValue: true }, sessionId);
console.log('renderer:', gpu.result.value);
const raf = await send('Runtime.evaluate', { expression: `new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r((n / 2).toFixed(1)); })(); })`, awaitPromise: true, returnByValue: true }, sessionId);
console.log('page rAF fps:', raf.result.value, 'visibility:', (await send('Runtime.evaluate', { expression: 'document.visibilityState', returnByValue: true }, sessionId)).result.value);

// Virtual time: advance the page clock exactly one frame, then screenshot. The clip plays smoothly at 30 fps
// no matter how slowly this machine renders (the screencast API only delivered ~2 fps headless).
const FPS = 30, frames = [];
let budgetDone = null;
listeners.push(m => { if (m.method === 'Emulation.virtualTimeBudgetExpired' && m.sessionId === sessionId && budgetDone) { const r = budgetDone; budgetDone = null; r(); } });
const total = Math.round(+secs * FPS);
for (let i = 0; i < total; i++) {
  const expired = new Promise(r => { budgetDone = r; });
  await send('Emulation.setVirtualTimePolicy', { policy: 'advance', budget: 1000 / FPS }, sessionId);
  await Promise.race([expired, sleep(5000)]);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }, sessionId);
  const file = join(work, `f${String(i).padStart(5, '0')}.jpg`);
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
  frames.push({ file, t: i / FPS });
  if (i % 60 === 0) process.stdout.write(`frame ${i}/${total}\n`);
}
ws.close();
const exited = new Promise(r => chrome.once('exit', r));
killChrome();
await Promise.race([exited, sleep(5000)]);
await sleep(500);

if (frames.length < 2) throw new Error('no frames captured');
const span = frames.at(-1).t - frames[0].t;
console.log(`frames: ${frames.length} over ${span.toFixed(1)} s = ${(frames.length / span).toFixed(1)} fps`);

// variable-rate frames -> concat list with real durations -> constant 30 fps video
let list = '';
frames.forEach((f, i) => {
  const d = i < frames.length - 1 ? frames[i + 1].t - f.t : 1 / 30;
  list += `file '${f.file.replace(/\\/g, '/')}'\nduration ${d.toFixed(4)}\n`;
});
list += `file '${frames.at(-1).file.replace(/\\/g, '/')}'\n`;
const listFile = join(work, 'list.txt');
writeFileSync(listFile, list);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '23', '-preset', 'medium', '-movflags', '+faststart', `${outBase}.mp4`]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${outBase}.mp4`, '-vf', 'fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4', `${outBase}.gif`]);
try { rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }); } catch { console.warn('could not remove temp folder', work); }
console.log('wrote', `${outBase}.mp4`, 'and', `${outBase}.gif`);
