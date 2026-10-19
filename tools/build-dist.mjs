// tools/build-dist.mjs
// 产出 dist/<version>/：
//   core.mjs       —— 运行时核心（把 src/core.mjs 及其依赖内联打包）
//   manifest.json  —— 版本、文件哈希、导出名单
//   latest.json    —— 指针
// 说明：不引入打包器，用简易内联器（只处理相对 import，按拓扑顺序拼接）。
//
// ⚠️ 关键：内联会剥掉所有 export 关键字，因此必须在末尾补一条 export，
//    否则 dist/core.mjs 的模块导出为空，loader 里的 `mod.install` 恒为 undefined。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const OUT = path.join(ROOT, 'dist', VERSION);

const seen = new Set();
const order = [];

function resolveRel(from, spec) {
  const p = path.resolve(path.dirname(from), spec);
  return p.endsWith('.mjs') || p.endsWith('.js') ? p : p + '.mjs';
}

/** 深度优先收集依赖（只处理相对路径） */
function collect(file) {
  const abs = path.resolve(file);
  if (seen.has(abs)) return;
  seen.add(abs);
  const src = fs.readFileSync(abs, 'utf8');
  const re = /^\s*import\s+(?:[\s\S]*?)\s+from\s+['"](\.[^'"]+)['"];?\s*$/gm;
  let m;
  while ((m = re.exec(src))) collect(resolveRel(abs, m[1]));
  order.push(abs);
}

collect(path.join(ROOT, 'src', 'core.mjs'));

/**
 * 从源码里收集导出信息。
 * declared  —— 本文件用 `export const/function/...` 真正声明的名字（重名即冲突）
 * reexported —— 本文件用 `export { … }` 转出的名字（可能是本地名，也可能是 import 进来的，
 *               转发到已声明名字属于正常情况，只做并集，不报错）
 */
function collectExports(src) {
  const declared = [];
  const reexported = [];

  const decl = /^\s*export\s+(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = decl.exec(src))) declared.push(m[1]);

  const list = /^\s*export\s*\{([\s\S]*?)\}\s*;?\s*$/gm;
  while ((m = list.exec(src))) {
    for (const part of m[1].split(',')) {
      const seg = part.trim();
      if (!seg) continue;
      const as = seg.split(/\s+as\s+/);
      reexported.push((as[1] ?? as[0]).trim());
    }
  }

  // export default（本项目未使用，显式报错避免静默丢失）
  if (/^\s*export\s+default\b/m.test(src)) {
    throw new Error('不支持 export default：内联器只认具名导出');
  }
  return { declared, reexported };
}

// 简易内联：去掉相对 import 与 export 关键字，保留外部 import（如有）
const chunks = [];
const exportNames = [];
const exportOrigin = new Map(); // name -> 文件，用于重名检测

for (const f of order) {
  let s = fs.readFileSync(f, 'utf8');
  const rel = path.relative(ROOT, f).replace(/\\/g, '/');

  const { declared, reexported } = collectExports(s);

  for (const name of declared) {
    if (exportOrigin.has(name)) {
      throw new Error(`导出名重复：「${name}」同时声明于 ${exportOrigin.get(name)} 与 ${rel}`);
    }
    exportOrigin.set(name, rel);
    exportNames.push(name);
  }
  for (const name of reexported) {
    if (!exportNames.includes(name)) exportNames.push(name);
  }

  s = s.replace(/^\s*import[\s\S]*?from\s+['"]\.[^'"]+['"];?\s*$/gm, '');
  s = s.replace(/^\s*export\s*\{[\s\S]*?\}\s*;?\s*$/gm, '');
  s = s.replace(/^(\s*)export\s+(const|let|var|function|class|async\s+function)/gm, '$1$2');
  chunks.push(`// ---- ${rel} ----\n${s.trim()}\n`);
}

// 末尾补导出：loader 依赖 install，外部可复用其余纯函数
const exportLine = exportNames.length
  ? `\nexport { ${[...new Set(exportNames)].join(', ')} };\n`
  : '\n// 警告：没有任何导出\n';

const bundle = `// HP-Reverb core ${VERSION} · 自动生成，勿手改\n` + chunks.join('\n') + exportLine;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'core.mjs'), bundle, 'utf8');

const sha = crypto.createHash('sha256').update(bundle).digest('hex');
const bytes = Buffer.byteLength(bundle);
const manifest = {
  version: VERSION,
  entry: 'core.mjs',
  files: [{ path: 'core.mjs', sha256: sha, bytes }],
  contract: '2026-11-a',
  schema: 1,
  exports: [...new Set(exportNames)],
};
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const latest = { schema: 1, channel: 'stable', version: VERSION, manifest_url: `https://cdn.jsdelivr.net/gh/makenwjz/hpgame@v${VERSION}/dist/${VERSION}/manifest.json`, manifest_sha256: sha };
fs.writeFileSync(path.join(ROOT, 'dist', 'latest.json'), JSON.stringify(latest, null, 2), 'utf8');

console.log(`[build-dist] ${VERSION} → dist/${VERSION}/core.mjs  ${bytes} B  sha256=${sha.slice(0, 12)}…`);
console.log(`[build-dist] 依赖顺序：${order.map(f => path.relative(ROOT, f)).join(' → ')}`);
console.log(`[build-dist] 导出 ${new Set(exportNames).size} 个：${[...new Set(exportNames)].join(', ')}`);
