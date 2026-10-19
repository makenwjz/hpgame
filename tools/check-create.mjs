// tools/check-create.mjs —— 创角页验收：三栏字段、提交后的写入路径全部合法、模板占位符齐全
import fs from 'node:fs';
import path from 'node:path';
import { isAllowedPath, ROOT_KEYS } from '../src/schema.mjs';
import * as C from '../src/contract.mjs';

const ROOT = process.cwd();
const sheet = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'ui', 'create-sheet.json'), 'utf8'));
const errs = [];
const oks = [];

// ---- 1. 步骤数应为 3 ----
if (sheet.steps.length === 3) oks.push(`步骤 3 栏：${sheet.steps.map(s => s.name).join(' / ')}`);
else errs.push(`步骤应为 3 栏，实际 ${sheet.steps.length}`);

// ---- 2. 不应再有「开局 / 姓名 / 性别」三步 ----
const allKeys = sheet.steps.flatMap(s => s.fields.map(f => f.key));
for (const banned of ['开局', '姓名', '性别']) {
  if (allKeys.includes(banned)) errs.push(`不应再有「${banned}」字段（主角固定男版哈利）`);
}
if (!errs.some(e => e.includes('不应再有'))) oks.push('已删除 开局 / 姓名 / 性别 三步');

// ---- 3. 必须保留的字段 ----
for (const need of ['血统', '出身', '魔杖木材', '魔杖杖芯', '性情倾向']) {
  if (allKeys.includes(need)) oks.push(`保留字段：${need}`);
  else errs.push(`缺少字段：${need}`);
}

// ---- 4. 性情倾向：选项必须与 contract.AXES 一致，且给 +2 经验 ----
const trait = sheet.steps.flatMap(s => s.fields).find(f => f.key === '性情倾向');
if (!trait) errs.push('没有「性情倾向」字段');
else {
  const same = JSON.stringify(trait.options) === JSON.stringify(C.AXES);
  if (same) oks.push(`性情倾向选项 = 五维枚举（${C.AXES.join('/')}）`);
  else errs.push(`性情倾向选项与 contract.AXES 不一致：${trait.options.join('/')} vs ${C.AXES.join('/')}`);
  if (trait.max === 2) oks.push('性情倾向最多选 2 项');
  else errs.push(`性情倾向 max 应为 2，实际 ${trait.max}`);
  if (String(trait.hint || '').includes('+2')) oks.push('性情倾向说明写的是 +2 经验');
  else errs.push('性情倾向说明里没有 +2 经验');
}

// ---- 5. 所有 write 路径必须在白名单内 ----
const writes = sheet.steps.flatMap(s => s.fields).map(f => f.write).filter(Boolean);
for (const w of writes) {
  const concrete = w.replace(/\{[^}]+\}/g, '学业');
  if (isAllowedPath(concrete)) oks.push(`写入路径合法：${w}`);
  else errs.push(`写入路径不在白名单：${w}`);
}

// ---- 6. 模板里的占位符必须都能被字段填上 ----
const tpl = sheet.writes?.entry?.template ?? '';
const opening = sheet.writes?.opening ?? '';
const holes = new Set([...tpl.matchAll(/\{([^}]+)\}/g)].map(m => m[1]).concat([...opening.matchAll(/\{([^}]+)\}/g)].map(m => m[1])));
for (const h of holes) {
  if (allKeys.includes(h)) oks.push(`模板占位符可填：{${h}}`);
  else errs.push(`模板占位符无对应字段：{${h}}`);
}

// ---- 7. 不应再出现 /世界线（已删的容器） ----
const raw = JSON.stringify(sheet);
if (raw.includes('/世界线')) errs.push('仍引用已删除的 /世界线 容器');
else oks.push('未引用已删除的 /世界线');

// ---- 8. 开场白必须固定为男版哈利 ----
if (opening.includes('哈利·波特') && !opening.includes('哈莉·波特')) oks.push('开场白固定为男版哈利');
else errs.push('开场白没有固定为男版哈利');

console.log('\n=== 创角页验收 ===');
for (const o of oks) console.log('  ✓', o);
for (const e of errs) console.log('  ✗', e);
console.log(errs.length ? `\n失败 ${errs.length} 项` : '\n全部通过');
process.exit(errs.length ? 1 : 0);
