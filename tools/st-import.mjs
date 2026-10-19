// tools/st-import.mjs —— 把 dist/card.png 导入本机 SillyTavern，并做基础冒烟验证
// 依赖：ST 已在 127.0.0.1:8000 运行（st/server.js）
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8000';
const ROOT = process.cwd();
const PNG = path.join(ROOT, 'dist', 'card.png');

let token = '';
const cookies = new Map();

async function getCsrf() {
  const r = await fetch(`${BASE}/csrf-token`);
  const j = await r.json();
  token = j.token;
  for (const c of r.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';');
    const i = kv.indexOf('=');
    cookies.set(kv.slice(0, i), kv.slice(i + 1));
  }
  return token;
}

function cookieHeader() {
  return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function api(pathname, { method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'X-CSRF-Token': token,
      Cookie: cookieHeader(),
      ...headers,
    },
    body,
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, ok: r.ok, json, text };
}

await getCsrf();
console.log('[st] csrf ok');

// ---- 1. 导入 PNG ----
const form = new FormData();
const buf = fs.readFileSync(PNG);
form.append('avatar', new Blob([buf], { type: 'image/png' }), 'card.png');
form.append('file_type', 'png');
form.append('preserve_name', 'false');

const imp = await api('/api/characters/import', { method: 'POST', body: form });
console.log('[st] import:', imp.status, imp.text.slice(0, 300));

// ---- 2. 列出角色，找到我们的卡 ----
const list = await api('/api/characters/all', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
if (!Array.isArray(list.json)) {
  console.log('[st] 角色列表异常:', list.status, list.text.slice(0, 300));
  process.exit(1);
}
const names = list.json.map(c => c.name);
console.log('[st] 现有角色:', names.join(' / '));

const ours = list.json.find(c => c.name === '哈莉·波特·行间');
if (!ours) {
  console.log('[st] ✗ 没找到我们的卡');
  process.exit(1);
}
console.log('[st] ✓ 找到卡:', ours.name, '| avatar:', ours.avatar);

// ---- 3. 读回卡的完整 JSON，核对脚本与正则 ----
const full = await api('/api/characters/get', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ avatar_url: ours.avatar }),
});
if (!full.ok) { console.log('[st] 取卡失败', full.status, full.text.slice(0, 300)); process.exit(1); }

const c = full.json;
const ext = c.data?.extensions ?? {};
const scripts = ext.tavern_helper?.scripts ?? [];
const regexes = ext.regex_scripts ?? [];
const entries = c.data?.character_book?.entries ?? [];

const errs = [];
const oks = [];
const check = (cond, label, detail = '') => cond ? oks.push(`${label}${detail ? ' — ' + detail : ''}`) : errs.push(`${label}${detail ? ' — ' + detail : ''}`);

check(c.name === '哈莉·波特·行间', '卡名', c.name);
check(entries.length === 16, '世界书条目', `${entries.length} 条`);
check(entries.some(e => (e.comment || '').includes('[InitVar]')), 'InitVar 条目存在');
check(scripts.length === 2, '卡内脚本', `${scripts.length} 个`);
check(scripts.some(s => String(s.content).includes('MagVarUpdate')), 'MVU 脚本已嵌入');
check(scripts.some(s => String(s.content).includes('HP_REVERB_LOADING')), 'loader 脚本已嵌入');
check(regexes.length === 5, '正则', `${regexes.length} 条`);
check(regexes.some(r => r.scriptName === '03-正文美化与状态栏'), '正文美化正则存在');
check(regexes.some(r => r.scriptName === '04-开局创角页'), '创角页正则存在');
check(regexes.some(r => r.scriptName === '01-变量块隐藏'), '变量块隐藏正则存在');

console.log('\n=== 真机（ST API）核对 ===');
for (const o of oks) console.log('  ✓', o);
for (const e of errs) console.log('  ✗', e);
console.log(errs.length ? `\n失败 ${errs.length} 项` : '\n全部通过');
process.exit(errs.length ? 1 : 0);
