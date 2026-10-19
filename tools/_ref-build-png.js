// 生成 PNG 角色卡：把 v10.1 JSON 以 tEXt/chara 块嵌入原图
// 同时删掉旧卡残留的 chara 块，避免出现两份 payload。
const fs = require('fs');
const zlib = require('zlib');

const SRC_PNG = 'C:/Users/19542/Downloads/哈莉·波特_v10.0.png';
const SRC_JSON = 'C:/bd/ds project/_card_parse/hp_v10.0/out/哈莉·波特_v10.1.json';
const OUT_PNG = 'C:/bd/ds project/_card_parse/hp_v10.0/out/哈莉·波特_v10.1.png';

// ---------- CRC32 ----------
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readChunks(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('不是 PNG');
  const chunks = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    const crc = buf.readUInt32BE(off + 8 + len);
    chunks.push({ type, data, crc, raw: buf.subarray(off, off + 12 + len) });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  return chunks;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function textChunk(keyword, value) {
  // tEXt: keyword \0 value（latin1）
  return makeChunk('tEXt', Buffer.concat([
    Buffer.from(keyword, 'latin1'),
    Buffer.from([0]),
    Buffer.from(value, 'latin1'),
  ]));
}

// ---------- 主流程 ----------
const png = fs.readFileSync(SRC_PNG);
const cardJson = fs.readFileSync(SRC_JSON, 'utf8');
const card = JSON.parse(cardJson);

const chunks = readChunks(png);
console.log('原 PNG chunk：' + chunks.map(c => c.type).join(' '));

// 统计旧卡 payload
const oldTexts = chunks.filter(c => c.type === 'tEXt' || c.type === 'iTXt' || c.type === 'zTXt')
  .map(c => {
    const nul = c.data.indexOf(0);
    const kw = c.data.toString('latin1', 0, nul);
    return kw;
  });
console.log('原 PNG 文本块：' + (oldTexts.join('/') || '无'));

// 保留除 chara / ccv3 之外的块
const kept = chunks.filter(c => {
  if (c.type === 'tEXt' || c.type === 'iTXt' || c.type === 'zTXt') {
    const nul = c.data.indexOf(0);
    const kw = c.data.toString('latin1', 0, nul);
    return kw !== 'chara' && kw !== 'ccv3';
  }
  return true;
});

// 新 payload：base64(JSON)，与酒馆写入格式一致
const payload = Buffer.from(cardJson, 'utf8').toString('base64');
const charaChunk = textChunk('chara', payload);

// 插到 IEND 之前
const iendIdx = kept.findIndex(c => c.type === 'IEND');
const outChunks = [
  ...kept.slice(0, iendIdx).map(c => c.raw),
  charaChunk,
  kept[iendIdx].raw,
];
const out = Buffer.concat([SIGNATURE, ...outChunks]);

fs.mkdirSync('C:/bd/ds project/_card_parse/hp_v10.0/out', { recursive: true });
fs.writeFileSync(OUT_PNG, out);

console.log('\n输出：' + OUT_PNG);
console.log('字节：' + out.length + '（原图 ' + png.length + '）');

// ---------- 回读校验 ----------
const back = readChunks(fs.readFileSync(OUT_PNG));
const chara = back.find(c => {
  if (c.type !== 'tEXt') return false;
  const nul = c.data.indexOf(0);
  return c.data.toString('latin1', 0, nul) === 'chara';
});
if (!chara) { console.error('回读失败：找不到 chara 块'); process.exit(1); }
const nul = chara.data.indexOf(0);
const b64 = chara.data.toString('latin1', nul + 1);
const decoded = Buffer.from(b64, 'base64').toString('utf8');
const backCard = JSON.parse(decoded);

console.log('\n=== 回读校验 ===');
console.log('payload 字节：' + decoded.length + '（源 JSON ' + cardJson.length + '）');
console.log('语义一致：' + (JSON.stringify(backCard) === JSON.stringify(card)));
console.log('版本：' + backCard.data.character_version);
console.log('世界书条目：' + backCard.data.character_book.entries.length);
console.log('正则：' + backCard.data.extensions.regex_scripts.length);
console.log('脚本：' + backCard.data.extensions.tavern_helper.scripts.map(s => s.name).join('/'));
console.log('chara 块数：' + back.filter(c => {
  if (c.type !== 'tEXt') return false;
  const n = c.data.indexOf(0);
  return c.data.toString('latin1', 0, n) === 'chara';
}).length);
