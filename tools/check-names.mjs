// tools/check-names.mjs
// 一致性检查 ③：人名变体
// 扫描设计文档里「名·姓」的出现，按姓聚类；同一姓氏下出现不同的名 → 报警。
// 排除：注释里的「原名X」对照、以及显式列在 ALLOW 里的官方别名。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'cards', 'HP-Reverb', '设计');
const errs = [];
const warns = [];

// 允许的正名/别名对（人名对照表里出现的不算错）
const ALLOW = new Set([
  '哈莉', '哈利',           // 平行世界两个波特
  '詹玛', '詹姆', '莉莉',   // 已故母亲
  '芙蕾达', '乔治娅',       // 双子
  '帕瓦蒂', '帕德玛',       // 双胞胎佩蒂尔
]);

function walk(dir, acc = []) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, acc);
    else if (f.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const files = fs.existsSync(DIR) ? walk(DIR) : [];
if (!files.length) {
  console.log(JSON.stringify({ ok: true, errors: [], warnings: ['设计目录不存在，跳过'], files: 0 }, null, 2));
  process.exit(0);
}

const bySurname = new Map();   // 姓 -> Map(名 -> Set(文件))
const RE = /([\u4e00-\u9fa5]{2,4})·([\u4e00-\u9fa5]{2,4})/g;

for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  let m;
  RE.lastIndex = 0;
  while ((m = RE.exec(t))) {
    const [, given, sur] = m;
    if (!bySurname.has(sur)) bySurname.set(sur, new Map());
    const g = bySurname.get(sur);
    if (!g.has(given)) g.set(given, new Set());
    g.get(given).add(path.basename(f));
  }
}

// 找到「同姓不同名」且两边都非别名的
for (const [sur, givens] of bySurname) {
  if (givens.size < 2) continue;
  const names = [...givens.keys()].filter(n => !ALLOW.has(n));
  if (names.length < 2) continue;
  const detail = [...givens.entries()].map(([n, fs_]) => `${n}(${fs_.size}处)`).join(' / ');
  // 已知的正式族（同姓多名是正常的：韦斯莱、马尔福、布莱克等）
  const FAMILY = ['韦斯莱', '马尔福', '布莱克', '邓布利多', '波特', '隆巴顿', '冈特', '克劳奇', '佩蒂尔', '莱斯特兰奇', '普林斯'];
  if (FAMILY.includes(sur)) {
    warns.push(`家族姓氏 ${sur}：${detail}（同一家族多成员，属正常）`);
  } else {
    errs.push(`疑似人名变体 ${sur}：${detail}`);
  }
}

// 塔罗表与宫殿主名单交叉核对
const tarot = files.find(f => path.basename(f).startsWith('08-'));
const palace = files.find(f => path.basename(f).startsWith('07-九宫殿'));
if (tarot && palace) {
  const t = fs.readFileSync(tarot, 'utf8');
  const p = fs.readFileSync(palace, 'utf8');
  const rulers = [...p.matchAll(/\|\s*(\d+)\s*\|\s*[^|]*\|\s*([^|\n]+?)\s*\|\s*(?:塔罗)?/g)];
  // 宫殿主名单里的名字必须出现在塔罗表
  const names = [...p.matchAll(/（([\u4e00-\u9fa5·]{3,12})｜/g)].map(x => x[1]);
  for (const n of new Set(names)) {
    if (!t.includes(n)) errs.push(`宫殿主「${n}」未出现在 08-二十二塔罗.md`);
  }
}

const report = {
  ok: errs.length === 0,
  errors: errs,
  warnings: warns.slice(0, 20),
  files: files.length,
  surnames: bySurname.size,
};
console.log(JSON.stringify(report, null, 2));
process.exit(errs.length ? 1 : 0);
