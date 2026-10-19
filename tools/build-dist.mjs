// tools/build-dist.mjs
// 产出 dist/<version>/：
//   core.mjs       —— 运行时核心（把 src/core.mjs 及其依赖内联打包）
//   manifest.json  —— 版本、文件哈希
//   latest.json    —— 指针
// 说明：不引入打包器，用简易内联器（只处理相对 import，按拓扑顺序拼接）。
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

// 简易内联：去掉相对 import 与 export 关键字，保留外部 import（如有）
const chunks = [];
for (const f of order) {
  let s = fs.readFileSync(f, 'utf8');
  s = s.replace(/^\s*import[\s\S]*?from\s+['"]\.[^'"]+['"];?\s*$/gm, '');
  s = s.replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '');
  s = s.replace(/^export\s+(const|let|function|class|async function)/gm, '$1');
  chunks.push(`// ---- ${path.relative(ROOT, f).replace(/\\/g, '/')} ----\n${s.trim()}\n`);
}
const bundle = `// HP-Reverb core ${VERSION} · 自动生成，勿手改\n` + chunks.join('\n');

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'core.mjs'), bundle, 'utf8');

const sha = crypto.createHash('sha256').update(bundle).digest('hex');
const bytes = Buffer.byteLength(bundle);
const manifest = { version: VERSION, entry: 'core.mjs', files: [{ path: 'core.mjs', sha256: sha, bytes }], contract: '2026-11-a', schema: 1 };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const latest = { schema: 1, channel: 'stable', version: VERSION, manifest_url: `https://cdn.jsdelivr.net/gh/makenwjz/hpgame@v${VERSION}/dist/${VERSION}/manifest.json`, manifest_sha256: sha };
fs.writeFileSync(path.join(ROOT, 'dist', 'latest.json'), JSON.stringify(latest, null, 2), 'utf8');

console.log(`[build-dist] ${VERSION} → dist/${VERSION}/core.mjs  ${bytes} B  sha256=${sha.slice(0, 12)}…`);
console.log(`[build-dist] 依赖顺序：${order.map(f => path.relative(ROOT, f)).join(' → ')}`);
