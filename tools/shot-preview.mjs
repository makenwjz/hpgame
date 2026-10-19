// tools/shot-preview.mjs —— 给预览页截图（七页各一张 + 创角页）
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT = process.cwd();
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9336;
const OUT = path.join(ROOT, 'dist', 'preview', 'shots');
fs.mkdirSync(OUT, { recursive: true });

const httpJson = url => new Promise((res, rej) => {
  http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu',
  '--hide-scrollbars', '--no-first-run', '--force-device-scale-factor=2',
  '--disable-application-cache', '--disk-cache-size=1', '--media-cache-size=1',
  '--incognito',
  '--user-data-dir=' + path.join(ROOT, 'dist', 'preview', '_edge_' + Date.now()), 'about:blank'], { stdio: 'ignore' });

try {
  for (let i = 0; i < 60; i++) { try { await httpJson(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(300); } }
  const tabs = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  };
  const send = (method, params = {}) => { const mid = ++id; return new Promise((res, rej) => { pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); }); };
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 1400, deviceScaleFactor: 2, mobile: false });

  // ---- 创角页 ----
  await send('Page.navigate', { url: 'file:///' + path.join(ROOT, 'dist', 'preview', 'create.html').replace(/\\/g, '/') });
  await sleep(3000);
  let shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'create.png'), Buffer.from(shot.data, 'base64'));
  console.log('已截图 create.png');

  // ---- 状态栏 ----
  await send('Page.navigate', { url: 'file:///' + path.join(ROOT, 'dist', 'preview', 'status.html').replace(/\\/g, '/') });
  await sleep(3000);
  await ev(`(() => { const h = document.getElementById('cw-status-head'); const t = h.querySelector('[data-cw-toggle]'); if (t && /collapsed/.test(h.innerHTML)) t.click(); })()`);
  await sleep(800);

  const names = await ev(`[...document.getElementById('cw-status-head').querySelectorAll('[data-cw-page]')].map(t => (t.textContent||'').trim())`);
  for (let i = 0; i < names.length; i++) {
    await ev(`document.getElementById('cw-status-head').querySelectorAll('[data-cw-page]')[${i}].click()`);
    await sleep(400);
    const s = await send('Page.captureScreenshot', { format: 'png' });
    const file = `status-${i + 1}-${names[i]}.png`;
    fs.writeFileSync(path.join(OUT, file), Buffer.from(s.data, 'base64'));
    console.log('已截图', file);
  }
  ws.close();
} finally { try { proc.kill(); } catch {} }
