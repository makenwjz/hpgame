// tools/check-paths.mjs
// 一致性检查 ①：路径白名单
// 比对：schema 顶层容器 ↔ WHITELIST ↔ 渲染后的《路径清单》↔ initvar
import fs from 'node:fs';
import path from 'node:path';
import { Schema, ROOT_KEYS, WHITELIST, defaultStat, listPaths } from '../src/schema.mjs';

const ROOT = process.cwd();
const errs = [];
const warns = [];

// 1. 顶层 = 白名单 = 15
if (ROOT_KEYS.length !== 15) errs.push(`顶层容器应为 15，实际 ${ROOT_KEYS.length}`);
const wl = new Set(WHITELIST.map(w => w.slice(1)));
for (const k of ROOT_KEYS) if (!wl.has(k)) errs.push(`白名单缺少 /${k}`);
for (const k of wl) if (!ROOT_KEYS.includes(k)) errs.push(`白名单多出 /${k}`);

// 2. initvar 结构 = schema 默认值
const dflt = defaultStat();
const initPath = path.join(ROOT, 'dist', 'initvar.json');
if (fs.existsSync(initPath)) {
  const init = JSON.parse(fs.readFileSync(initPath, 'utf8'));
  const stat = init.stat_data || init;
  const keys = Object.keys(stat);
  for (const k of ROOT_KEYS) if (!(k in stat)) errs.push(`initvar 缺少容器 ${k}`);
  for (const k of keys) if (!ROOT_KEYS.includes(k)) errs.push(`initvar 多出容器 ${k}`);
  for (const k of ROOT_KEYS) {
    if (JSON.stringify(stat[k]) !== JSON.stringify(dflt[k])) warns.push(`initvar.${k} 与默认值不同构造`);
  }
}

// 3. 《路径清单》必须覆盖全部叶子路径
const entryPath = path.join(ROOT, 'src', 'entries', '04-路径清单.md');
const cardPath = path.join(ROOT, 'dist', 'card.json');
let rendered = '';
if (fs.existsSync(cardPath)) {
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const e = card.data.character_book.entries.find(x => x.comment === '路径清单');
  rendered = e ? e.content : '';
} else if (fs.existsSync(entryPath)) {
  rendered = fs.readFileSync(entryPath, 'utf8');
}
if (!rendered) {
  warns.push('未找到《路径清单》渲染结果（先跑 build-card）');
} else if (rendered.includes('{{PATHS}}')) {
  errs.push('《路径清单》未注入，仍是占位符');
} else {
  const missing = listPaths(Schema).filter(({ path: p }) => !rendered.includes(p)).map(x => x.path);
  if (missing.length) errs.push(`《路径清单》缺少 ${missing.length} 条路径：${missing.slice(0, 5).join(', ')}…`);
}

// 4. 设计文档里的容器数与 schema 是否一致
const design = path.join(ROOT, 'cards', 'HP-Reverb', '设计', '00-总纲与契约.md');
if (fs.existsSync(design)) {
  const t = fs.readFileSync(design, 'utf8');
  const m = t.match(/允许的前缀（([0-9]+) 个）/);
  if (m && Number(m[1]) !== 15) warns.push(`设计文档写「允许的前缀（${m[1]} 个）」，schema 是 15（旧口径，待修）`);
}

// 输出
const report = { ok: errs.length === 0, errors: errs, warnings: warns, containers: ROOT_KEYS.length, leaves: listPaths(Schema).length };
console.log(JSON.stringify(report, null, 2));
process.exit(errs.length ? 1 : 0);
