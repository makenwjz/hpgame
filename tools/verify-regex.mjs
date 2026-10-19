// tools/verify-regex.mjs —— 验收：把 4 条正则实际应用到样本正文，检查输出
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.join(ROOT, 'dist', 'regex');
const errs = [];
const oks = [];

if (!fs.existsSync(DIR)) { console.log('✗ dist/regex 不存在，先跑 npm run regex'); process.exit(1); }
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

/** 把 "/pattern/flags" 解析成 RegExp */
function parseRegex(s) {
  const m = String(s).match(/^\/([\s\S]*)\/([gimsuy]*)$/);
  if (!m) throw new Error('findRegex 不是 /pattern/flags 形式：' + s);
  return new RegExp(m[1], m[2]);
}

const SAMPLE = `<content>
<story year="01">第01学年·魔法石与第一夜</story>
<time period="黄昏" layer="主线" basis="原文明示">1991年09月15日</time>
<now_plot>斯内普把坩埚盖子掀开一条缝。

{罗娜·韦斯莱}「你确定要现在动手？」

{#}「再等三秒。」
</now_plot>
<check type="魔药成败" dc="困难">成功｜1d100=31｜魔力-3</check>
<UpdateVariable>
<JSONPatch>[{"op":"replace","path":"/时空/周","value":2}]</JSONPatch>
</UpdateVariable>
</content>`;

// ---------- 1. 结构检查 ----------
for (const it of manifest.items) {
  const file = path.join(DIR, `${it.scriptName}.json`);
  if (!fs.existsSync(file)) { errs.push(`缺少文件：${it.scriptName}.json`); continue; }
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const need = ['id', 'scriptName', 'findRegex', 'replaceString', 'trimStrings', 'placement', 'disabled', 'markdownOnly', 'promptOnly', 'runOnEdit', 'substituteRegex', 'minDepth', 'maxDepth'];
  const missing = need.filter(k => !(k in r));
  if (missing.length) errs.push(`${it.scriptName} 缺字段：${missing.join(', ')}`);
  else oks.push(`${it.scriptName} 字段齐全（${need.length} 项）`);

  // findRegex 必须能编译
  try { parseRegex(r.findRegex); } catch (e) { errs.push(`${it.scriptName} findRegex 无法编译：${e.message}`); }

  // id 必须是稳定 UUID（同一 scriptName 两次构建应一致）
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(r.id)) {
    errs.push(`${it.scriptName} 的 id 不是稳定 UUID：${r.id}`);
  }
}

// ---------- 2. 实跑：变量块必须消失 ----------
{
  const r = JSON.parse(fs.readFileSync(path.join(DIR, '01-变量块隐藏.json'), 'utf8'));
  const out = SAMPLE.replace(parseRegex(r.findRegex), r.replaceString);
  if (!out.includes('<UpdateVariable>')) oks.push('01 变量块被完整移除');
  else errs.push('01 变量块仍然存在');
  if (out.includes('<content>')) oks.push('01 不影响正文其余部分');
}

// ---------- 3. 实跑：正文美化必须注入渲染器且保留正文 ----------
{
  const r = JSON.parse(fs.readFileSync(path.join(DIR, '03-正文美化与状态栏.json'), 'utf8'));
  const out = SAMPLE.replace(parseRegex(r.findRegex), r.replaceString);

  if (out.includes('Cardwright')) oks.push('03 注入渲染器骨架');
  else errs.push('03 没有注入渲染器');

  const sourceMatch = out.match(/<textarea id="cw-source" hidden>([\s\S]*?)<\/textarea>/);
  if (sourceMatch) {
    if (sourceMatch[1].includes('斯内普把坩埚盖子')) oks.push('03 正文被放进 cw-source');
    else errs.push('03 cw-source 里没有正文');
  } else {
    errs.push('03 找不到 cw-source 注入点');
  }

  // 关键：$ 转义必须正确 —— 正文必须完整落进 cw-source
  // 注意：渲染器 JS 源码里本来就有 `=== undefined` 这种正常关键字，不能拿 undefined 当判据。
  if (sourceMatch && sourceMatch[1].includes('斯内普把坩埚盖子')) oks.push('03 $ 转义正确（正文完整进入注入点）');
  else errs.push('03 正文没有完整进入 cw-source，$ 转义可能有问题');

  // 不能残留 markdown 围栏
  if (!/^\s*```/.test(out)) oks.push('03 无 Markdown 围栏残留');
  else errs.push('03 残留 Markdown 围栏');

  // 渲染器里的 $1 必须已还原（不是 $$$$1）
  if (!out.includes('$$')) oks.push('03 无 $$ 残留');
  else errs.push('03 残留 $$');

  // 状态栏 sheet 必须在里面
  if (out.includes('cw-sheet')) oks.push('03 内含 cw-sheet');
  if (out.includes('宫殿')) oks.push('03 内含宫殿页');
}

// ---------- 4. 实跑：创角页 ----------
{
  const r = JSON.parse(fs.readFileSync(path.join(DIR, '04-开局创角页.json'), 'utf8'));
  const src = '<start>致一九九一年入学的新生：</start>';
  const out = src.replace(parseRegex(r.findRegex), r.replaceString);
  if (out.includes('cw-start') || out.includes('入学名册')) oks.push('04 注入创角页');
  else errs.push('04 没有注入创角页');
  // 渲染器 JS 里本来就有 undefined 关键字，改用「源码被截断」判断转义是否出错
  if (out.includes('CardwrightHost.boot()')) oks.push('04 源码完整（未被 $ 转义截断）');
  else errs.push('04 源码被截断，$ 转义有问题');
}

// ---------- 5. id 稳定性：同一名称必须得到同一 id ----------
{
  const a = JSON.parse(fs.readFileSync(path.join(DIR, '03-正文美化与状态栏.json'), 'utf8')).id;
  const crypto = await import('node:crypto');
  const h = crypto.createHash('sha1').update('hp-reverb:03-正文美化与状态栏').digest('hex');
  const expect = [h.slice(0, 8), h.slice(8, 12), '5' + h.slice(13, 16), ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join('-');
  if (a === expect) oks.push('id 由名称确定性生成（重建不变）');
  else errs.push(`id 不稳定：${a} vs ${expect}`);
}

console.log('\n=== 正则验收 ===');
for (const o of oks) console.log('  ✓', o);
for (const e of errs) console.log('  ✗', e);
console.log(errs.length ? `\n失败 ${errs.length} 项` : '\n全部通过');
process.exit(errs.length ? 1 : 0);
