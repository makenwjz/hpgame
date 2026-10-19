// tools/verify-dist.mjs —— 产物验收：bundle 能否被 import、导出是否齐全、loader 能否找到 core
// 用法：node tools/verify-dist.mjs
// 这是「第 1 步 通运行链路」的自动化验收，任何一项失败即退出 1。
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const errs = [];
const oks = [];

const ok = (label, detail = '') => oks.push(`${label}${detail ? ' — ' + detail : ''}`);
const bad = (label, detail = '') => errs.push(`${label}${detail ? ' — ' + detail : ''}`);

// ---------- 1. bundle 存在且语法可加载 ----------
const bundlePath = path.join(ROOT, 'dist', VERSION, 'core.mjs');
let mod = null;
if (!fs.existsSync(bundlePath)) {
  bad('dist/core.mjs 存在', bundlePath);
} else {
  ok('dist/core.mjs 存在', `${fs.statSync(bundlePath).size} B`);
  try {
    mod = await import(pathToFileURL(bundlePath).href + `?t=${Date.now()}`);
    ok('bundle 可被 import');
  } catch (e) {
    bad('bundle 可被 import', e.message);
  }
}

// ---------- 2. 导出齐全 ----------
if (mod) {
  const keys = Object.keys(mod);
  if (keys.length === 0) bad('模块有导出', '导出为空 —— loader 永远等不到 install');
  else ok('模块有导出', `${keys.length} 个`);

  const must = ['install', 'handleMessage', 'resolve', 'weekTick', 'settleAffinity', 'sanitizePatch'];
  for (const name of must) {
    if (typeof mod[name] !== 'function') bad(`导出 ${name} 是函数`, `实际 ${typeof mod[name]}`);
  }
  if (!errs.some(e => e.startsWith('导出 '))) ok('关键导出齐全', must.join(', '));

  // 版本标记：loader 依赖 install 存在
  ok('loader 判断通过', `typeof mod.install === 'function' → ${typeof mod.install === 'function'}`);
}

// ---------- 3. manifest 的 exports 名单与实际一致 ----------
const mfPath = path.join(ROOT, 'dist', VERSION, 'manifest.json');
if (fs.existsSync(mfPath)) {
  const mf = JSON.parse(fs.readFileSync(mfPath, 'utf8'));
  const declared = new Set(mf.exports ?? []);
  const actual = new Set(Object.keys(mod ?? {}));
  const missing = [...declared].filter(n => !actual.has(n));
  const extra = [...actual].filter(n => !declared.has(n));
  if (missing.length) bad('manifest.exports 与实际一致', `清单多出：${missing.join(', ')}`);
  else if (extra.length) bad('manifest.exports 与实际一致', `清单缺少：${extra.join(', ')}`);
  else ok('manifest.exports 与实际一致', `${actual.size} 个`);
}

// ---------- 4. loader 里的 URL 必须指向真实存在的产物 ----------
const loaderPath = path.join(ROOT, 'src', 'scripts', 'loader.js');
if (fs.existsSync(loaderPath)) {
  const src = fs.readFileSync(loaderPath, 'utf8');
  // 抓出模板字符串里的路径片段
  const urls = [...src.matchAll(/https:\/\/[^'"`\s]+\$\{[^}]*\}[^'"`\s]*/g)].map(m => m[0]);
  const joined = urls.join('\n') + src;
  // 允许的形态：dist/${VERSION}/core.mjs
  const hasVersioned = /dist\/\$\{VERSION\}\/core\.mjs/.test(src);
  const hasBareDist = /dist\/core\.mjs/.test(src);
  if (hasBareDist && !hasVersioned) {
    bad('loader URL 指向真实产物', '写的是 dist/core.mjs，实际产物在 dist/<version>/core.mjs（会 404）');
  } else if (hasVersioned) {
    ok('loader URL 指向真实产物', 'dist/${VERSION}/core.mjs');
  } else {
    bad('loader URL 指向真实产物', '未识别到 dist/... core.mjs 路径');
  }

  // loader 里的 VERSION 必须与 package.json 一致
  const vm = src.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
  if (vm && vm[1] !== VERSION) bad('loader VERSION 与 package.json 一致', `loader=${vm[1]} pkg=${VERSION}`);
  else if (vm) ok('loader VERSION 与 package.json 一致', vm[1]);
}

// ---------- 5. loader 必须被装进卡 ----------
const cardPath = path.join(ROOT, 'dist', 'card.json');
if (fs.existsSync(cardPath)) {
  const card = JSON.parse(fs.readFileSync(cardPath, 'utf8'));
  const ext = card?.data?.extensions ?? {};
  const th = ext.tavern_helper;
  const scripts = Array.isArray(th) ? th : th?.scripts;
  if (!Array.isArray(scripts) || scripts.length === 0) {
    bad('card.json 内嵌 loader', 'data.extensions.tavern_helper.scripts 为空 —— 卡里没有可执行代码');
  } else {
    const boot = scripts.find(s => String(s.content || '').includes('HP_REVERB_LOADING'));
    if (!boot) bad('card.json 内嵌 loader', '脚本里找不到 loader.js 的内容（HP_REVERB_LOADING 标记）');
    else ok('card.json 内嵌 loader', `${scripts.length} 个脚本，loader 命中`);
  }
} else {
  bad('dist/card.json 存在');
}

// ---------- 输出 ----------
console.log('\n=== 产物验收 ===');
for (const o of oks) console.log('  ✓', o);
for (const e of errs) console.log('  ✗', e);
console.log(errs.length ? `\n失败 ${errs.length} 项` : '\n全部通过');
process.exit(errs.length ? 1 : 0);
