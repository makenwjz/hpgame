// tools/verify-png.mjs —— 校验 card.png 内嵌的 JSON 与 card.json 完全一致，且 loader 在里面
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PNG = path.join(ROOT, 'dist', 'card.png');
const JSON_PATH = path.join(ROOT, 'dist', 'card.json');

const errs = [];
const oks = [];
const ok = (l, d = '') => oks.push(`${l}${d ? ' — ' + d : ''}`);
const bad = (l, d = '') => errs.push(`${l}${d ? ' — ' + d : ''}`);

function readChunks(buf) {
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks.push({ type, data });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

const png = fs.readFileSync(PNG);
const chunks = readChunks(png);

const getText = kw => {
  for (const c of chunks) {
    if (c.type !== 'tEXt') continue;
    const z = c.data.indexOf(0);
    if (c.data.toString('latin1', 0, z) === kw) return c.data.toString('latin1', z + 1);
  }
  return null;
};

for (const kw of ['chara', 'ccv3']) {
  const v = getText(kw);
  if (!v) { bad(`PNG 含 tEXt/${kw}`); continue; }
  let card;
  try { card = JSON.parse(Buffer.from(v, 'base64').toString('utf8')); }
  catch (e) { bad(`tEXt/${kw} 是合法 base64 JSON`, e.message); continue; }
  ok(`PNG 含 tEXt/${kw}`, `${v.length} B`);

  const src = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  if (JSON.stringify(card) === JSON.stringify(src)) ok(`tEXt/${kw} 与 card.json 语义一致`);
  else bad(`tEXt/${kw} 与 card.json 语义一致`);

  const scripts = card?.data?.extensions?.tavern_helper?.scripts ?? [];
  const boot = scripts.find(s => String(s.content || '').includes('HP_REVERB_LOADING'));
  if (boot) ok(`tEXt/${kw} 内含 loader`, `${String(boot.content).length} B`);
  else bad(`tEXt/${kw} 内含 loader`, '脚本列表里没有 HP_REVERB_LOADING');
}

console.log('\n=== PNG 验收 ===');
for (const o of oks) console.log('  ✓', o);
for (const e of errs) console.log('  ✗', e);
console.log(errs.length ? `\n失败 ${errs.length} 项` : '\n全部通过');
process.exit(errs.length ? 1 : 0);
