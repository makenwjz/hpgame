// tools/pack-png.mjs —— 移植自 v10.0/build-png.js
// 改动：路径参数化、支持 chara + ccv3 双 payload、回读校验失败即退出 1。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC_PNG = process.argv[2] || path.join(ROOT, 'art', 'cover.png');
const SRC_JSON = process.argv[3] || path.join(ROOT, 'dist', 'card.json');
const OUT_PNG = process.argv[4] || path.join(ROOT, 'dist', 'card.png');

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error('不是 PNG');
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks.push({ type, data, raw: buf.subarray(off, off + 12 + len) });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}
const makeChunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
};
const textChunk = (kw, val) => makeChunk('tEXt', Buffer.concat([
  Buffer.from(kw, 'latin1'), Buffer.from([0]), Buffer.from(val, 'latin1'),
]));

if (!fs.existsSync(SRC_PNG)) { console.error(`底图不存在：${SRC_PNG}\n先放一张 art/cover.png（任意尺寸）`); process.exit(1); }
const png = fs.readFileSync(SRC_PNG);
const cardJson = fs.readFileSync(SRC_JSON, 'utf8');
const card = JSON.parse(cardJson);

const chunks = readChunks(png);
const kept = chunks.filter(c => {
  if (['tEXt', 'iTXt', 'zTXt'].includes(c.type)) {
    const nul = c.data.indexOf(0);
    const kw = c.data.toString('latin1', 0, nul);
    return kw !== 'chara' && kw !== 'ccv3';
  }
  return true;
});

const payload = Buffer.from(cardJson, 'utf8').toString('base64');
const iend = kept.findIndex(c => c.type === 'IEND');
const out = Buffer.concat([
  SIG,
  ...kept.slice(0, iend).map(c => c.raw),
  textChunk('chara', payload),
  textChunk('ccv3', payload),
  kept[iend].raw,
]);
fs.mkdirSync(path.dirname(OUT_PNG), { recursive: true });
fs.writeFileSync(OUT_PNG, out);

// 回读校验
const back = readChunks(fs.readFileSync(OUT_PNG));
const get = kw => {
  const c = back.find(x => x.type === 'tEXt' && x.data.toString('latin1', 0, x.data.indexOf(0)) === kw);
  return c ? c.data.toString('latin1', c.data.indexOf(0) + 1) : null;
};
const decoded = Buffer.from(get('chara') || '', 'base64').toString('utf8');
const ok = decoded && JSON.stringify(JSON.parse(decoded)) === JSON.stringify(card);
console.log(`[pack-png] ${OUT_PNG}  ${out.length} B（原图 ${png.length}）`);
console.log(`[pack-png] chara=${(get('chara') || '').length} ccv3=${(get('ccv3') || '').length} 语义一致=${ok}`);
if (!ok) { console.error('[pack-png] 回读校验失败'); process.exit(1); }
