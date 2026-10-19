// tools/st-live.mjs —— 真机验证（最终版）
// 步骤：干净浏览器 → 打开 ST → 角色列表出现我们的卡 → 点开 → 等卡内脚本执行 → 验证 MVU/core/正则/状态栏
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT = process.cwd();
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9361;
const ST = 'http://127.0.0.1:8000';
const OUT = path.join(ROOT, 'dist', 'live');
fs.mkdirSync(OUT, { recursive: true });

const httpJson = url => new Promise((res, rej) => {
  http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

const errs = [];
const oks = [];
const logs = [];
let ws;

const PROFILE = path.join(OUT, '_live_' + Date.now());
const proc = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, '--disable-gpu',
  '--hide-scrollbars', '--no-first-run', '--window-size=1400,1900',
  '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });

try {
  for (let i = 0; i < 80; i++) { try { await httpJson(`http://127.0.0.1:${PORT}/json/version`); break; } catch { await sleep(300); } }
  const tabs = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
  ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  let id = 0; const pending = new Map();
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
    else if (m.method === 'Runtime.consoleAPICalled') logs.push({ t: m.params.type, s: (m.params.args || []).map(a => a.value ?? a.description ?? '').join(' ') });
    else if (m.method === 'Runtime.exceptionThrown') logs.push({ t: 'exc', s: m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text ?? '' });
  };
  const send = (method, params = {}) => { const mid = ++id; return new Promise((res, rej) => { pending.set(mid, { res, rej }); ws.send(JSON.stringify({ id: mid, method, params })); }); };
  const ev = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) return { __err: r.exceptionDetails.exception?.description ?? r.exceptionDetails.text };
    return r.result.value;
  };

  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: ST });

  for (let i = 0; i < 120; i++) { await sleep(1000); if (await ev(`!!document.getElementById('send_textarea')`) === true) break; }

  // 等角色列表出现我们的卡
  let found = null;
  for (let i = 0; i < 40; i++) {
    found = await ev(`
      (() => {
        try {
          const ctx = window.SillyTavern.getContext();
          const arr = Array.isArray(ctx.characters) ? ctx.characters : Object.values(ctx.characters || {});
          const t = arr.find(c => c && c.name === '哈莉·波特·行间');
          return t ? JSON.stringify({ name: t.name, avatar: t.avatar, total: arr.length }) : null;
        } catch (e) { return null; }
      })()
    `);
    if (found) break;
    await sleep(1000);
  }
  if (found) oks.push(`前端角色列表找到卡：${found}`);
  else errs.push('前端角色列表里没有我们的卡');

  // 启用角色脚本（酒馆助手默认不启用新角色的脚本）
  await ev(`
    (() => {
      const ctx = window.SillyTavern.getContext();
      const th = ctx.extensionSettings.tavern_helper;
      if (!th?.script) return;
      th.script.enabled ??= { global: true, presets: [], characters: [] };
      th.script.enabled.characters ??= [];
      if (!th.script.enabled.characters.includes('哈莉·波特·行间.png')) th.script.enabled.characters.push('哈莉·波特·行间.png');
      ctx.saveSettingsDebounced?.();
    })()
  `);

  // 打开角色（UI 点击）
  const clicked = await ev(`
    (async () => {
      try {
        const nav = document.getElementById('rightNavDrawerIcon');
        if (nav) nav.click();
        await new Promise(r => setTimeout(r, 1500));
        const cards = [...document.querySelectorAll('#rm_print_characters_block .character_select')];
        const card = cards.find(el => (el.querySelector('.ch_name')?.textContent || '').trim() === '哈莉·波特·行间');
        if (!card) return 'no-card-el:' + cards.length;
        card.click();
        await new Promise(r => setTimeout(r, 6000));
        const ctx = window.SillyTavern.getContext();
        const ch = ctx.characters?.[ctx.characterId];
        return JSON.stringify({ clicked: true, characterId: ctx.characterId, name: ch?.name, chatId: ctx.chatId });
      } catch (e) { return 'ERR:' + e.message; }
    })()
  `);
  console.log('[live] 打开角色:', clicked);
  if (typeof clicked === 'string' && clicked.includes('"clicked":true')) oks.push(`已打开角色聊天：${clicked}`);
  else errs.push(`打开角色失败：${clicked}`);

  // 等脚本执行（MVU 要从 CDN 拉，给足时间）
  console.log('[live] 等待卡内脚本执行…');
  let marks = null;
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    marks = await ev(`JSON.stringify({
      Mvu: typeof window.Mvu,
      mvVer: window.__HP_MVU_VERSION__ || null,
      mvuLoading: !!window.__HP_MVU_LOADING__,
      reverb: !!window.__HP_REVERB_INSTALLED__,
      reverbVer: window.__HP_REVERB_VERSION__ || null,
      reverbLoading: !!window.__HP_REVERB_LOADING__,
      iframes: document.querySelectorAll('iframe').length,
      hpKeys: Object.keys(window).filter(k => /HP_|Mvu|Cardwright/.test(k)),
    })`);
    console.log(`  +${(i + 1) * 5}s`, marks);
    if (typeof marks === 'string' && marks.includes('"reverb":true') && marks.includes('"Mvu":"object"')) break;
  }

  const m = typeof marks === 'string' ? JSON.parse(marks) : {};
  if (m.Mvu === 'object') oks.push(`MVU 已就绪（${m.mvVer || '?'}）`);
  else errs.push('MVU 未就绪');
  if (m.reverb) oks.push(`core 已安装（${m.reverbVer || '?'}）`);
  else errs.push('core 未安装');

  // 日志
  const rel = logs.filter(l => /HP-Reverb|MVU|MagVar|Cardwright/.test(l.s));
  console.log('\n[live] 相关日志：');
  for (const l of rel.slice(0, 30)) console.log('   ', l.t, '|', l.s.slice(0, 220));
  if (rel.some(l => /核心已加载/.test(l.s))) oks.push('日志：核心已加载');
  if (rel.some(l => /MVU.*已加载/.test(l.s))) oks.push('日志：MVU 已加载');

  // 截图
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(OUT, 'st-live.png'), Buffer.from(shot.data, 'base64'));
  console.log('[live] 截图 → dist/live/st-live.png');

  const excs = logs.filter(l => l.t === 'exc');
  if (excs.length === 0) oks.push('无未捕获异常');
  else for (const e of excs.slice(0, 5)) errs.push('异常：' + e.s.slice(0, 200));

} catch (e) {
  errs.push('检查异常：' + e.message);
} finally {
  try { ws?.close(); } catch {}
  try { proc.kill(); } catch {}
}

console.log('\n=== 真机验证 ===');
for (const o of oks) console.log('  ✓', o);
for (const e of errs) console.log('  ✗', e);
console.log(errs.length ? `\n失败 ${errs.length} 项` : '\n全部通过');
process.exit(errs.length ? 1 : 0);
