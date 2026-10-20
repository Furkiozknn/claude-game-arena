// Çini Ustası check in headless Chrome (GPU): fps + draw calls on a busy board, then the ?auto bot fast-forwarded
// through all 30 levels with window.ciniSim. Usage: node cini-check.mjs <base-url> [w=1280] [h=720] [mode=all|fps|bot]
// Prints JSON lines: {fps, dbg} and {levelsDone, stars, errors, maxSolveMs, ms}.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, W = '1280', H = '720', mode = 'all'] = process.argv.slice(2);
const CHROME = join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 9400 + Math.floor(Math.random() * 400);
const work = mkdtempSync(join(tmpdir(), 'cini-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, 'profile')}`,
  `--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio', '--ignore-gpu-blocklist',
  '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
  '--disable-features=CalculateNativeWinOcclusion,IntensiveWakeUpThrottling', 'about:blank'], { stdio: 'ignore' });
function killChrome() {
  try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* gone */ }
  const tag = work.split(/[\\/]/).pop();
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${tag}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore' });
  } catch { /* nothing left */ }
}
process.on('exit', killChrome);

let wsu;
for (let i = 0; i < 150 && !wsu; i++) { try { wsu = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch { await sleep(200); } }
const ws = new WebSocket(wsu);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map(), logs = [];
ws.addEventListener('message', ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('exception: ' + m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
  else if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);
await send('Page.bringToFront', {}, sessionId); // a background target gets no requestAnimationFrame
const evalv = async expr => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }, sessionId)).result.value;
const sep = base.includes('?') ? '&' : '?';

if (mode === 'all' || mode === 'fps') {
  await send('Page.navigate', { url: base + sep + 'level=30&debug&nohowto&fresh' }, sessionId);
  await sleep(9000);
  console.log(await evalv(`new Promise(res => { let n = 0; const t0 = performance.now(); const tick = () => { n++; if (performance.now() - t0 < 4000) requestAnimationFrame(tick); else {
    res(JSON.stringify({ fps: +(n * 1000 / (performance.now() - t0)).toFixed(1), dbg: document.getElementById('debug').textContent,
      gl: (() => { const c = document.createElement('canvas').getContext('webgl'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'; })() })); } };
    requestAnimationFrame(tick); })`));
}
if (mode === 'all' || mode === 'bot') {
  await send('Page.navigate', { url: base + sep + 'auto&debug&fresh&nohowto' }, sessionId);
  await sleep(7000);
  console.log(await evalv(`new Promise(res => { const t0 = performance.now(); let maxSolve = 0;
    const step = () => { const G = window.cini; for (let i = 0; i < 6 && !G.bot.done; i++) { window.ciniSim(2); maxSolve = Math.max(maxSolve, G.bot.solveMs || 0); }
      if (!G.bot.done && performance.now() - t0 < 240000) return setTimeout(step, 0);
      let stars = 0; for (const k in (G.progress || {}).best || {}) stars += G.progress.best[k].stars;
      res(JSON.stringify({ levelsDone: G.bot.levelsDone, done: G.bot.done, screen: G.screen, starsText: document.getElementById('debug').textContent.split('\\n')[3], errors: window.__ciniErrors, maxSolveMs: +maxSolve.toFixed(1), ms: Math.round(performance.now() - t0) })); };
    step(); })`));
}
console.log(JSON.stringify(logs));
process.exit(0);
