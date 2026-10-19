// tools/sync-sheet.mjs —— 把 src/ui/status-sheet.json 注入 src/ui/_ref-status.html
// 渲染器本身不动，只换 sheet。运行后 _ref-status.html 里的 cw-sheet 与 json 文件保持一致。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SHEET = path.join(ROOT, 'src', 'ui', 'status-sheet.json');
const HTML = path.join(ROOT, 'src', 'ui', '_ref-status.html');

const sheet = JSON.parse(fs.readFileSync(SHEET, 'utf8'));
const compact = JSON.stringify(sheet);

let html = fs.readFileSync(HTML, 'utf8');
const re = /(<script id="cw-sheet" type="application\/json">)([\s\S]*?)(<\/script>)/;
const m = html.match(re);
if (!m) { console.error('[sync-sheet] 没找到 <script id="cw-sheet">'); process.exit(1); }

html = html.replace(re, `$1${compact}$3`);
fs.writeFileSync(HTML, html, 'utf8');

// 校验：回读后能解析且页数正确
const back = fs.readFileSync(HTML, 'utf8').match(re)[2];
const parsed = JSON.parse(back);
const pages = parsed.statusHead.pages.map(p => p.name);
console.log(`[sync-sheet] 已注入 ${Buffer.byteLength(compact)} B，${pages.length} 页：${pages.join(' / ')}`);
if (pages.length !== 7) { console.error(`[sync-sheet] 期望 7 页，实际 ${pages.length}`); process.exit(1); }
