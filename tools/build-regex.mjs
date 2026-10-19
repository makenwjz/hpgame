// tools/build-regex.mjs —— 把渲染器 HTML 压成 SillyTavern 正则的 replaceString，写进 card.json
//
// 核心约束（踩过的坑）：
//  1. String.prototype.replace 的替换串里 `$` 是特殊字符（$1 $& $` $' $$）。
//     渲染器 HTML 里只有一个 $1 是「正文注入点」，其余 $ 必须转义成 $$，
//     否则会被当成捕获组引用而丢失。
//  2. 渲染器 HTML 本身裹着一层 Markdown 代码围栏（原卡就是这么存的），
//     作为 replaceString 时必须剥掉，否则会在正文里渲染出 ```html。
//  3. 单条正则体积不能太大：状态栏六页约 80KB 已接近上限，故拆成两条（前四页 / 后三页）。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const UI = path.join(ROOT, 'src', 'ui');
const OUT = path.join(ROOT, 'dist');

const errs = [];
const warn = [];

/** 固定 UUID：脚本/正则的 id 必须稳定，否则每次构建都被助手当成新条目 */
function stableId(name) {
  const h = crypto.createHash('sha1').update('hp-reverb:' + name).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '5' + h.slice(13, 16), ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join('-');
}

/** 剥掉 Markdown 代码围栏（原卡渲染器作为正则 payload 时就是这么包的） */
function unwrapFence(s) {
  return s.replace(/^\s*```[a-z]*\s*\r?\n/i, '').replace(/\r?\n```\s*$/, '');
}

/**
 * 把 HTML 变成安全的 replaceString：
 *  - 保留唯一的 $1（正文注入点）
 *  - 其余 $ 全部转义为 $$
 */
function toReplaceString(html) {
  const raw = unwrapFence(html);
  // 先保护 $1
  const PH = '\u0000CAPTURE1\u0000';
  let s = raw.replace(/\$1/g, PH);
  // 其余 $ 转义
  s = s.replace(/\$/g, '$$$$');
  // 还原 $1
  s = s.split(PH).join('$1');
  return s;
}

/** 极简压缩：去掉 HTML 注释与行首尾空白，但不动 <pre>/<script>/<style> 内部 */
function minify(html) {
  return html
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function build({ scriptName, htmlFile, findRegex, placement, markdownOnly = true, promptOnly = false, minifyIt = false }) {
  const p = path.join(UI, htmlFile);
  if (!fs.existsSync(p)) { errs.push(`缺少渲染器：${htmlFile}`); return null; }
  let html = fs.readFileSync(p, 'utf8');
  html = unwrapFence(html);
  if (minifyIt) html = minify(html);
  const replaceString = toReplaceString(html);
  return {
    id: stableId(scriptName),
    scriptName,
    findRegex,
    replaceString,
    trimStrings: [],
    placement,
    disabled: false,
    markdownOnly,
    promptOnly,
    runOnEdit: true,
    substituteRegex: 0,
    minDepth: null,
    maxDepth: null,
  };
}

// ---------- 4 条正则 ----------
// 顺序很重要：先剥变量块与自写 check，再做正文美化。
const list = [];

// 01 变量块隐藏：<UpdateVariable>…</UpdateVariable> 整块删掉（变量由 MVU 处理，不给玩家看）
//    MVU 官方要求的「去除变量更新」正则，作用域 AI 输出、仅格式显示。
list.push({
  id: stableId('01-变量块隐藏'),
  scriptName: '01-变量块隐藏',
  findRegex: '/<UpdateVariable>[\\s\\S]*?<\\/UpdateVariable>/gi',
  replaceString: '',
  trimStrings: [],
  placement: [2],
  disabled: false,
  markdownOnly: true,
  promptOnly: false,
  runOnEdit: true,
  substituteRegex: 0,
  minDepth: null,
  maxDepth: null,
});

// 01b 对 AI 隐藏状态栏占位符：MVU 官方要求，仅格式提示词（不让模型看见占位符本身）
list.push({
  id: stableId('01b-对AI隐藏状态栏占位符'),
  scriptName: '01b-对AI隐藏状态栏占位符',
  findRegex: '/<StatusPlaceHolderImpl\\/>/gi',
  replaceString: '',
  trimStrings: [],
  placement: [2],
  disabled: false,
  markdownOnly: false,
  promptOnly: true,
  runOnEdit: true,
  substituteRegex: 0,
  minDepth: null,
  maxDepth: null,
});

// 02 剥离模型自写的 <check>：只保留脚本产出的（脚本在写入正文时已生成，正则跑在渲染阶段，
//    因此这里改用「标记属性」区分：脚本产出带 data-src="hp"，模型写的没有）
//  —— 实际上更稳的做法是：正文美化时直接保留 <check>，由 core.mjs 在写入前剥离模型写的。
//     所以这一条只做兜底：把没有 data-src 的 check 变灰而不是删除，便于排查。
list.push({
  id: stableId('02-未结算check兜底'),
  scriptName: '02-未结算check兜底',
  findRegex: '/<check\\b(?![^>]*data-src)[^>]*>([\\s\\S]*?)<\\/check>/gi',
  replaceString: '<span class="hp-unsettled-check" title="这条检定未经脚本结算">［未结算］$1</span>',
  trimStrings: [],
  placement: [2],
  disabled: false,
  markdownOnly: true,
  promptOnly: false,
  runOnEdit: true,
  substituteRegex: 0,
  minDepth: null,
  maxDepth: null,
});

// 03 正文美化 + 状态栏
const status = build({
  scriptName: '03-正文美化与状态栏',
  htmlFile: '_ref-status.html',
  findRegex: '/<content[^>]*>([\\s\\S]*?)<\\/content>/is',
  placement: [2],
});
if (status) list.push(status);

// 04 创角页
const create = build({
  scriptName: '04-开局创角页',
  htmlFile: '_ref-create.html',
  findRegex: '/<start>([\\s\\S]*?)<\\/start>/gsi',
  placement: [1, 2],
});
if (create) list.push(create);

// ---------- 体积检查 ----------
const LIMIT = 120 * 1024; // 单条 replaceString 软上限
for (const r of list) {
  const n = Buffer.byteLength(r.replaceString);
  if (n > LIMIT) warn.push(`${r.scriptName} 体积 ${(n / 1024).toFixed(1)}KB，超过软上限 ${LIMIT / 1024}KB`);
}

// ---------- 写盘 ----------
fs.mkdirSync(path.join(OUT, 'regex'), { recursive: true });
for (const r of list) {
  fs.writeFileSync(path.join(OUT, 'regex', `${r.scriptName}.json`), JSON.stringify(r, null, 2), 'utf8');
}

const manifest = {
  count: list.length,
  items: list.map(r => ({
    scriptName: r.scriptName,
    id: r.id,
    findRegex: r.findRegex,
    bytes: Buffer.byteLength(r.replaceString),
    hasCapture: r.replaceString.includes('$1'),
  })),
};
fs.writeFileSync(path.join(OUT, 'regex', 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

// ---------- 输出 ----------
console.log('[build-regex] 生成正则：');
for (const it of manifest.items) {
  console.log(`  · ${it.scriptName.padEnd(22)} ${String(it.bytes).padStart(7)} B  捕获组=${it.hasCapture ? '有' : '无'}`);
}
for (const w of warn) console.log('  ⚠', w);
for (const e of errs) console.log('  ✗', e);
if (errs.length) process.exit(1);
