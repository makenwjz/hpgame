// tools/check-contract.mjs
// 一致性检查 ②：契约枚举
// 比对：contract.mjs（唯一源）↔ 卡片《请求契约》条目 ↔ 设计文档 10/03 的检定类型
import fs from 'node:fs';
import path from 'node:path';
import * as C from '../src/contract.mjs';

const ROOT = process.cwd();
const errs = [];
const warns = [];

function readEntry(comment) {
  const cardPath = path.join(ROOT, 'dist', 'card.json');
  if (!fs.existsSync(cardPath)) return '';
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const e = card.data.character_book.entries.find(x => x.comment === comment);
  return e ? e.content : '';
}

const contractText = readEntry('请求契约');
if (!contractText) {
  errs.push('卡片里没有《请求契约》条目（先跑 build-card）');
} else {
  const groups = {
    ACT_DO: C.ACT_DO, SLOT: C.SLOT, ROLL_TYPE: C.ROLL_TYPE, DC: C.DC,
    FOE: C.FOE, ROLL_ACTION: C.ROLL_ACTION, AFFINITY_KIND: C.AFFINITY_KIND,
    EVENT_KIND: C.EVENT_KIND, EVENT_STATE: C.EVENT_STATE,
  };
  for (const [name, values] of Object.entries(groups)) {
    const missing = values.filter(v => !contractText.includes(v));
    if (missing.length) errs.push(`《请求契约》缺少 ${name} 的取值：${missing.join(', ')}`);
  }
    // 反向：契约里出现的检定类型不得多于源
  const typeLine = contractText.match(/type：([^\n]+)/);
  if (typeLine) {
    const inText = typeLine[1].split('/').map(s => s.trim()).filter(Boolean);
    const extra = inText.filter(v => !C.ROLL_TYPE.includes(v));
    if (extra.length) errs.push(`《请求契约》出现未定义的检定类型：${extra.join(', ')}`);
    if (inText.length !== C.ROLL_TYPE.length) errs.push(`检定类型数量：契约 ${inText.length} ≠ 源 ${C.ROLL_TYPE.length}`);
  }
}

// 与战斗文档比对
const battle = path.join(ROOT, 'cards', 'HP-Reverb', '设计', '10-战斗-八方旅人.md');
if (fs.existsSync(battle)) {
  const t = fs.readFileSync(battle, 'utf8');
  const missing = C.ROLL_TYPE.filter(v => !t.includes(v));
  if (missing.length) warns.push(`10-战斗文档未提到：${missing.join(', ')}`);
}

// 语法示例必须自洽（属性名可从枚举推出）
for (const [k, tag] of Object.entries(C.GRAMMAR)) {
  if (!tag.startsWith('<')) errs.push(`GRAMMAR.${k} 不是标签`);
}

const report = { ok: errs.length === 0, errors: errs, warnings: warns, enums: Object.fromEntries(Object.entries(C).filter(([k, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length])) };
console.log(JSON.stringify(report, null, 2));
process.exit(errs.length ? 1 : 0);
