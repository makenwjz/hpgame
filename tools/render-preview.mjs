// tools/render-preview.mjs —— 离线渲染状态栏 / 创角页，不需要真机
//
// 用法：
//   node tools/render-preview.mjs               → dist/preview/status.html + create.html
//   node tools/render-preview.mjs --open        → 渲染后打印路径
//
// 原理：把渲染器 HTML 里的 sheet 换成 src/ui/*.json，再注入一个同步的假 Mvu 对象，
// 让 readData() 直接拿到假 stat_data。渲染器本身一行不改。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const UI = path.join(ROOT, 'src', 'ui');
const OUT = path.join(ROOT, 'dist', 'preview');
fs.mkdirSync(OUT, { recursive: true });

const { defaultStat } = await import('../src/schema.mjs');

/** 预览用示例正文：覆盖 <story> <time> <scene> <now_plot> <check> <inner> 等模块
 *  注意 <inner> 必须写在 <now_plot> 外面：渲染器的 renderBody 只扫一层，
 *  嵌在 <now_plot> 里的标签会被外层整段吞掉（原卡渲染器即如此）。 */
const SAMPLE_BODY = `<story year="01">第01学年·魔法石与第一夜</story>
<time period="黄昏" layer="主线" basis="原文明示">1991年09月15日</time>
<scene location="霍格沃茨·地下·魔药课教室" period="黄昏">石墙上结着一层薄霜。</scene>
<now_plot>斯内普把坩埚盖子掀开一条缝，蒸汽里浮起一圈银白。

{罗娜·韦斯莱}「你确定要现在动手？」

{#}「再等三秒。」
</now_plot>
<inner voice="阿利安娜">尾巴扫过他的脚踝。</inner>
<check type="魔药成败" dc="困难">成功｜1d100=31 判定线 38（学派+6 熟练+4 同行+3）｜魔力-3</check>`;

/** 造一份「看起来像真玩过」的假数据，方便肉眼验收 */
function fakeStat() {
  const s = defaultStat();
  s.主角.姓名 = '哈利·波特';
  s.主角.性别 = '男';
  s.主角.学院 = '格兰芬多';
  s.主角.年级 = 1;
  s.主角.血统 = '混血';
  s.主角.出身 = '女贞路长大，父母双亡';
  s.主角.魔杖.木材 = '冬青木';
  s.主角.魔杖.杖芯 = '凤凰羽毛';
  s.主角.体力 = 78; s.主角.魔力 = 64; s.主角.伤势 = 12;
  s.主角.学院分 = 37;
  s.物品与金钱.钱.加隆 = 12; s.物品与金钱.钱.西可 = 9;
  s.时空.学年 = 1; s.时空.周 = 3; s.时空.日期 = '1991年09月15日'; s.时空.时段 = '黄昏';
  s.日程.本周已用 = 2; s.日程.行动点上限 = 4; s.日程.本周安排 = ['陪人·罗娜', '自习·学业'];
  s.五维.学业.阶 = 3; s.五维.学业.经验 = 2; s.五维.学业.本年已得 = 8;
  s.五维.胆识.阶 = 2; s.五维.胆识.经验 = 4; s.五维.胆识.本年已得 = 4;
  s.五维.魅力.阶 = 2; s.五维.魅力.经验 = 1;
  s.五维.共情.阶 = 3; s.五维.共情.经验 = 0; s.五维.共情.本年已得 = 6;
  s.五维.心志.阶 = 2; s.五维.心志.经验 = 3;
  s.关系['罗娜·韦斯莱'] = {
    Rank: 4, 社群点: 42, 已建立: true, 已登场: true, 支线状态: '进行中',
    年龄: 18, 身份: '同届·格兰芬多', 印象: '笑得很大声，怕蜘蛛', 服饰: '旧袍子改过三次',
    身高: 168, 体重: 54, 三围: '—', 体型: '瘦', 名器评级: '', 名器: '', 当前任务: '魁地奇选拔',
  };
  s.关系['赫敏·格兰杰'] = {
    Rank: 3, 社群点: 28, 已建立: true, 已登场: true, 支线状态: '未开始',
    年龄: 18, 身份: '同届·格兰芬多', 印象: '把课本翻烂了', 身高: 165, 体重: 51, 体型: '匀称',
  };
  s.关系['德拉科娅·马尔福'] = {
    Rank: 2, 社群点: 14, 已建立: true, 已登场: true, 支线状态: '未开始',
    年龄: 18, 身份: '同届·斯莱特林', 印象: '看你像看一件标本',
  };
  s.网['罗娜·韦斯莱▸赫敏·格兰杰'] = { 状态: '如常', 强度: 3 };
  s.网['德拉科娅·马尔福▸罗娜·韦斯莱'] = { 状态: '紧张', 强度: 2 };
  s.秘密.发现度 = 15; s.秘密.哈莉已登场 = true; s.秘密.哈莉所在 = '宿舍';
  s.宫殿.在宫殿 = true; s.宫殿.当前 = '混血王子的地窖'; s.宫殿.层 = 2;
  s.宫殿.位置.x = 7; s.宫殿.位置.y = 11;
  s.宫殿.灯火 = 168; s.宫殿.钥匙 = 2; s.宫殿.意志 = 3; s.宫殿.警戒 = 46;
  s.宫殿.碎片 = ['药柜里的信', '第一堂课的录音'];
  s.宫殿.本局战利品 = ['旧坩埚', '记忆瓶'];
  s.宫殿.退路 = 1;
  s.事件线索.当前事件 = '混血王子的地窖';
  s.事件线索.进行中支线 = ['魁地奇选拔', '魔药课补考'];
  s.事件线索.主线节点进度['入学与分院'] = '已完成';
  s.事件线索.主线节点进度['第一夜'] = '进行中';
  s.期限['期中考试'] = { 截止周: 8, 状态: '进行中', 后果等级: '中' };
  s.期限['万圣夜涨潮'] = { 截止周: 9, 状态: '未启动', 后果等级: '高' };
  return s;
}

/** 把 sheet 注入渲染器 HTML，并挂上假 Mvu */
function buildPreview(htmlFile, sheetFile, statData, outFile, title) {
  let html = fs.readFileSync(path.join(UI, htmlFile), 'utf8');
  const sheet = JSON.parse(fs.readFileSync(path.join(UI, sheetFile), 'utf8'));
  const compact = JSON.stringify(sheet);

  // 原卡渲染器是作为正则 replaceString 保存的，外面裹着一层 Markdown 代码围栏。
  // 直接当 HTML 打开会多出一行 ```html 和末尾的 ```，预览时剥掉。
  html = html.replace(/^\s*```[a-z]*\s*\r?\n/i, '').replace(/\r?\n```\s*$/, '');

  const re = /(<script id="cw-sheet" type="application\/json">)([\s\S]*?)(<\/script>)/;
  if (!re.test(html)) throw new Error(`${htmlFile} 里没有 cw-sheet`);
  let out = html.replace(re, `$1${compact}$3`);

  // 假 Mvu：readData() 是同步调用，所以只要对象存在且方法同步返回即可
  const stub = `<script>
(function () {
  const STAT = ${JSON.stringify(statData)};
  window.Mvu = {
    getMvuData: function () { return { stat_data: STAT }; },
    replaceMvuData: function () { return Promise.resolve(); },
    events: {},
  };
  window.__HP_PREVIEW__ = true;
})();
</script>`;
  out = out.replace('<body>', '<body>\n' + stub);

  // $1 是正则捕获组占位符（真机里由 SillyTavern 替换成正文）。
  // 预览时填一段示例正文，顺便验证 renderBody 的模块解析。
  const sample = SAMPLE_BODY.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  out = out.replace('<textarea id="cw-source" hidden>$1</textarea>',
    `<textarea id="cw-source" hidden>${sample}</textarea>`);

  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`);

  const p = path.join(OUT, outFile);
  fs.writeFileSync(p, out, 'utf8');
  return { path: p, bytes: Buffer.byteLength(out), pages: sheet.statusHead?.pages?.map(x => x.name) ?? [] };
}

const stat = fakeStat();
const status = buildPreview('_ref-status.html', 'status-sheet.json', stat, 'status.html', 'HP-Reverb · 状态栏预览');
const create = buildPreview('_ref-create.html', 'create-sheet.json', stat, 'create.html', 'HP-Reverb · 创角页预览');

console.log(`[preview] 状态栏 → ${path.relative(ROOT, status.path)}  ${status.bytes} B`);
console.log(`[preview]          ${status.pages.length} 页：${status.pages.join(' / ')}`);
console.log(`[preview] 创角页 → ${path.relative(ROOT, create.path)}  ${create.bytes} B`);
console.log(`[preview] 浏览器直接打开即可：file:///${status.path.replace(/\\/g, '/')}`);
