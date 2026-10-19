// tools/check-preview.mjs —— 用无头 Edge 打开预览页，检查七页是否都渲染出来、关键数值是否正确
// 不装 Playwright：直接用 CDP（Chrome DevTools Protocol）+ Node 内置 WebSocket。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const ROOT = process.cwd();
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const PORT = 9333;
const PAGE = path.join(ROOT, 'dist', 'preview', 'status.html');
const errs = [];
const oks = [];

function httpJson(url) {
  return new Promise((res, rej) => {
    http.get(url, r => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej);
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitForEndpoint(timeout = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { return await httpJson(`http://127.0.0.1:${PORT}/json/version`); } catch { await sleep(300); }
  }
  throw new Error('CDP 端点未就绪');
}

/** 极简 CDP 客户端 */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    } else if (msg.method) events.push(msg);
  };
  return {
    ready,
    events,
    send(method, params = {}) {
      const mid = ++id;
      return new Promise((resolve, reject) => {
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
    },
    close: () => ws.close(),
  };
}

const proc = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--user-data-dir=' + path.join(ROOT, 'dist', 'preview', '_edge-profile'),
  'about:blank',
], { stdio: 'ignore' });

let client;
try {
  await waitForEndpoint();
  const tabs = await httpJson(`http://127.0.0.1:${PORT}/json/list`);
  const target = tabs.find(t => t.type === 'page');
  client = connect(target.webSocketDebuggerUrl);
  await client.ready;

  await client.send('Runtime.enable');
  await client.send('Page.enable');

  const fileUrl = 'file:///' + PAGE.replace(/\\/g, '/');
  await client.send('Page.navigate', { url: fileUrl });
  await sleep(2500); // 等渲染器 boot（它内部有 waitMvu(2500) 超时）

  const evalJs = async expr => {
    const r = await client.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + JSON.stringify(r.exceptionDetails.exception?.description ?? ''));
    return r.result.value;
  };

  // ---- 0. 状态栏默认折叠，先展开 ----
  const expanded = await evalJs(`
    (() => {
      const head = document.getElementById('cw-status-head');
      if (!head) return 'no-head';
      const toggle = head.querySelector('[data-cw-toggle]');
      if (toggle && /collapsed/.test(head.innerHTML)) { toggle.click(); return 'clicked'; }
      return /collapsed/.test(head.innerHTML) ? 'still-collapsed' : 'already-open';
    })()
  `);
  await sleep(600);
  oks.push(`状态栏展开：${expanded}`);

  // ---- 1. 页签数量与名称 ----
  const tabsInfo = await evalJs(`
    (() => {
      const els = [...document.querySelectorAll('[data-cw-page]')];
      return els.map(e => ({ idx: e.getAttribute('data-cw-page'), text: (e.textContent || '').trim() }));
    })()
  `);
  const names = tabsInfo.map(t => t.text);
  if (names.length === 7) oks.push(`页签 7 个：${names.join(' / ')}`);
  else errs.push(`页签应为 7 个，实际 ${names.length}：${names.join(' / ')}`);

  // ---- 2. 逐页点击并抓内容 ----
  // 注意：点击后 mount.innerHTML 整体重绘，页签节点会被替换，
  // 因此每一轮都必须重新查询 [data-cw-page]，并读 .cw-page 而不是整个 head。
  const pageDump = await evalJs(`
    (() => {
      const out = [];
      const head = document.getElementById('cw-status-head');
      const count = head.querySelectorAll('[data-cw-page]').length;
      for (let i = 0; i < count; i++) {
        const tab = head.querySelectorAll('[data-cw-page]')[i];
        const name = (tab.textContent || '').trim();
        tab.click();
        const pageEl = document.querySelector('#cw-status-head .cw-page');
        const html = pageEl ? pageEl.innerHTML : '';
        out.push({ name, len: html.length, text: html.replace(/<[^>]+>/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 400) });
      }
      return out;
    })()
  `);
  for (const p of pageDump) {
    if (p.len > 100) oks.push(`页「${p.name}」有内容（${p.len} B）`);
    else errs.push(`页「${p.name}」几乎为空（${p.len} B）`);
  }
  // 各页内容必须互不相同（否则说明点击没切换）
  const texts = pageDump.map(p => p.text);
  const uniq = new Set(texts);
  if (uniq.size === texts.length) oks.push('七页内容互不相同（切换生效）');
  else errs.push(`页面切换未生效：${texts.length} 页里只有 ${uniq.size} 种内容`);

  // ---- 3. 关键数值必须出现在对应页 ----
  const fullText = await evalJs(`
    (() => {
      const head = document.getElementById('cw-status-head');
      const count = head.querySelectorAll('[data-cw-page]').length;
      let s = head.querySelector('.cw-summary') ? head.querySelector('.cw-summary').textContent : '';
      for (let i = 0; i < count; i++) {
        head.querySelectorAll('[data-cw-page]')[i].click();
        const pageEl = document.querySelector('#cw-status-head .cw-page');
        s += ' ' + (pageEl ? pageEl.textContent : '');
      }
      return s.replace(/\\s+/g, ' ');
    })()
  `);

  const expect = [
    ['哈利·波特', '主角姓名'],
    ['格兰芬多', '学院'],
    ['冬青木', '魔杖木材'],
    ['凤凰羽毛', '杖芯'],
    ['37', '学院分'],
    ['罗娜·韦斯莱', '关系人物'],
    ['混血王子的地窖', '宫殿名'],
    ['期中考试', '期限'],
  ];
  for (const [needle, label] of expect) {
    if (fullText.includes(needle)) oks.push(`数值出现：${label}（${needle}）`);
    else errs.push(`数值缺失：${label}（找不到「${needle}」）`);
  }

  // ---- 4. 不能出现 schema 里不存在的死路径痕迹 ----
  for (const bad of ['/时空/当前场景', '社群等级', 'undefined', 'NaN', '[object Object]']) {
    if (fullText.includes(bad)) errs.push(`页面出现异常内容：「${bad}」`);
  }
  if (!errs.some(e => e.includes('异常内容'))) oks.push('页面无 undefined / NaN / [object Object]');

  // ---- 5. 控制台不能有报错 ----
  const consoleErrs = client.events.filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error');
  const exceptions = client.events.filter(e => e.method === 'Runtime.exceptionThrown');
  if (consoleErrs.length === 0 && exceptions.length === 0) oks.push('无控制台报错');
  else {
    for (const e of exceptions.slice(0, 3)) errs.push('未捕获异常：' + (e.params.exceptionDetails?.text ?? '') + ' ' + (e.params.exceptionDetails?.exception?.description ?? '').slice(0, 200));
    for (const e of consoleErrs.slice(0, 3)) errs.push('console.error：' + (e.params.args?.map(a => a.value ?? a.description).join(' ') ?? '').slice(0, 200));
  }

} catch (e) {
  errs.push('检查过程异常：' + e.message);
} finally {
  try { client?.close(); } catch {}
  try { proc.kill(); } catch {}
}

console.log('\n=== 状态栏预览检查 ===');
for (const o of oks) console.log('  ✓', o);
for (const e of errs) console.log('  ✗', e);
console.log(errs.length ? `\n失败 ${errs.length} 项` : '\n全部通过');
process.exit(errs.length ? 1 : 0);
