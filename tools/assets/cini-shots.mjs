// Real-time screenshots of a page in headless Chrome (GPU) via the DevTools Protocol: unlike --virtual-time-budget,
// network loads (GLBs) finish before timers, so the shot shows what a player sees.
// Usage: node cini-shots.mjs <base-url> <out-dir> <spec.json>
// spec.json: [{ "name": "title", "q": "?fresh", "w": 1280, "h": 720, "wait": 6000, "js": "optional expression run after the wait", "after": 500 }]
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, outDir, specFile] = process.argv.slice(2);
const specs = JSON.parse(readFileSync(specFile, 'utf8'));
const CHROME = join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 9400 + Math.floor(Math.random() * 400);
const work = mkdtempSync(join(tmpdir(), 'cshot-'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, 'profile')}`,
  '--window-size=1280,720', '--hide-scrollbars', '--mute-audio', '--ignore-gpu-blocklist',
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
  else if (m.method === 'Runtime.consoleAPICalled' && ['error'].includes(m.params.type)) logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = nextId++;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
});
for (const s of specs) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: s.w || 1280, height: s.h || 720, deviceScaleFactor: 1, mobile: !!s.mobile }, sessionId);
  if (s.mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true }, sessionId);
  await send('Page.navigate', { url: base + (s.q || '') }, sessionId);
  await sleep(s.wait || 6000);
  if (s.js) { const r = await send('Runtime.evaluate', { expression: s.js, awaitPromise: true, returnByValue: true }, sessionId); if (r.result && r.result.value !== undefined) console.log(s.name, 'js ->', JSON.stringify(r.result.value)); await sleep(s.after || 600); }
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(outDir, s.name + '.png'), Buffer.from(shot.data, 'base64'));
  console.log('shot', s.name);
  await send('Target.closeTarget', { targetId });
}
console.log(JSON.stringify(logs));
process.exit(0);
