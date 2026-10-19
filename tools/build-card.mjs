// tools/build-card.mjs
// 把 src/entries/*.md + schema + contract 打成一张 chara_card_v2 JSON。
// 输出：dist/card.json、dist/initvar.json、dist/report.json
import fs from 'node:fs';
import path from 'node:path';
import { Schema, defaultStat, listPaths, ROOT_KEYS } from '../src/schema.mjs';
import { renderContract } from '../src/contract.mjs';

const ROOT = process.cwd();
const ENTRY_DIR = path.join(ROOT, 'src', 'entries');
const OUT = path.join(ROOT, 'dist');
fs.mkdirSync(OUT, { recursive: true });

// ---------- 解析 frontmatter ----------
function parseEntry(file) {
  const raw = fs.readFileSync(path.join(ENTRY_DIR, file), 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`frontmatter 缺失：${file}`);
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([\w\u4e00-\u9fa5]+):\s*(.*)$/);
    if (!mm) continue;
    let v = mm[2].trim();
    if (v === '[]') v = [];
    else if (v === 'true') v = true;
    else if (v === 'false') v = false;
    else if (/^\d+$/.test(v)) v = Number(v);
    meta[mm[1]] = v;
  }
  return { meta, body: m[2].trim() };
}

// ---------- 生成路径清单文本 ----------
function renderPaths() {
  const lines = ['<路径清单>', '只允许写下面这些路径。中文键名原样，不转义；{键} 换成人物规范名。', ''];
  let lastRoot = '';
  for (const { path: p, kind, dflt } of listPaths(Schema)) {
    const root = p.split('/')[1];
    if (root !== lastRoot) { lines.push(''); lastRoot = root; }
    const d = typeof dflt === 'string' ? (dflt === '' ? '空' : dflt) : dflt;
    lines.push(`- ${p}（${kind}，默认 ${d}）`);
  }
  lines.push('', '【15 个顶层容器】' + ROOT_KEYS.map(k => '/' + k).join(' '), '</路径清单>');
  return lines.join('\n');
}

const CONTRACT = renderContract();
const PATHS = renderPaths();

// ---------- 组装条目 ----------
const files = fs.readdirSync(ENTRY_DIR).filter(f => f.endsWith('.md')).sort();
const entries = [];
let constantChars = 0;
for (const [i, file] of files.entries()) {
  const { meta, body } = parseEntry(file);
  let content = body
    .replace('{{CONTRACT}}', CONTRACT)
    .replace('{{PATHS}}', PATHS);
  content = content.trim();
  constantChars += content.length;
  entries.push({
    id: meta.id ?? i,
    keys: [],
    secondary_keys: [],
    comment: meta.comment,
    content,
    constant: meta.constant ?? true,
    selective: false,
    insertion_order: meta.order ?? (i + 1) * 10,
    enabled: true,
    position: meta.position ?? 'before_char',
    depth: 4,
    extensions: { hp_reverb: { version: 1, generated: true } },
  });
}

// ---------- 卡面 ----------
const description = `1991 年 09 月 01 日，国王十字车站，九又四分之三站台。

这是一处全员女性化的巫师界：登场角色一律女性，巫师家庭以女女生育为主流，所以每个孩子都有两位母亲。你是全校唯一的男学生——哈利·波特，十八岁，混血，女贞路长大。

白天：一周四个行动点，排日程、上课、打工、陪人。五维决定你能不能走进一个人的心里；社群 Rank 1–10，每一级都给你一样东西。
夜里：走进「行间」。九座宫殿，九位宫殿主，像素探索 + 八方式回合战斗。拿到秘宝、看见三块真相、打开退路——她就会变。

一年 43 周、172 个行动点、3 次涨潮。你救不了所有人。

路径白名单 15 个容器；请求契约在卡内，五类标签，脚本裁决。`;

const first_mes = `<start>
致一九九一年入学的新生：

1991 年 09 月 01 日，上午，伦敦国王十字车站。第九站台与第十站台之间有一道墙，穿过去就是九又四分之三站台——霍格沃茨特快在那里等着。

随信夹着一张入学名册。把三个空填上就好：你想先长成什么样的人、你要哪一根魔杖、你猜自己会被分到哪儿。

名册一交，列车就开动。第一幕从站台上写起，写到分院那顶帽子在你头上停住为止。
</start>`;

const creator_notes = `【安装】需要 SillyTavern + 酒馆助手（Tavern Helper）+ MVU。卡内 15 条常驻、9 个脚本、4 条正则；宫殿前端由酒馆助手加载。
【开局】主角固定为男版哈利。创角只有三栏：五维倾向 / 魔杖 / 学院。
【版本】卡 0.1.0 · 契约 2026-11-a · schema 1
【说明】所有数值由脚本裁决；模型只发请求、只写叙事。状态栏由正则渲染，模型不输出。
【更新】业务脚本与数据表放在 GitHub，通过酒馆助手脚本库更新；断网时使用卡内快照。`;

const card = {
  spec: 'chara_card_v2',
  spec_version: '2.0',
  name: '哈莉·波特·行间',
  description,
  personality: '',
  scenario: '',
  first_mes,
  mes_example: '',
  creator: 'makenwjz',
  creator_notes,
  character_version: '0.1.0',
  tags: ['哈利·波特', '娘化', 'AU', '魔法学院', 'MVU', '长线剧情', '社群攻略', '像素宫殿', '回合制'],
  alternate_greetings: [],
  group_only_greetings: [],
  extensions: {
    world: '哈莉·波特·行间',
    depth_prompt: { depth: 4, prompt: '', role: 'system' },
    hp_reverb: { contract: '2026-11-a', schema: 1, build: new Date().toISOString() },
  },
  data: {
    name: '哈莉·波特·行间',
    description,
    personality: '',
    scenario: '',
    first_mes,
    mes_example: '',
    creator_notes,
    system_prompt: '',
    post_history_instructions: '',
    alternate_greetings: [],
    character_book: { name: '哈莉·波特·行间', entries },
    tags: ['哈利·波特', '娘化', 'AU', '魔法学院', 'MVU', '长线剧情', '社群攻略', '像素宫殿', '回合制'],
    creator: 'makenwjz',
    character_version: '0.1.0',
    extensions: {},
  },
};

// ---------- 写盘 ----------
fs.writeFileSync(path.join(OUT, 'card.json'), JSON.stringify(card, null, 2), 'utf8');
fs.writeFileSync(path.join(OUT, 'initvar.json'), JSON.stringify({ stat_data: defaultStat() }, null, 2), 'utf8');

const report = {
  entries: entries.length,
  constantChars,
  cardJsonBytes: Buffer.byteLength(JSON.stringify(card)),
  topLevel: ROOT_KEYS.length,
  paths: listPaths(Schema).length,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('[build] 条目', report.entries, '常驻字数', report.constantChars, 'JSON 字节', report.cardJsonBytes);
console.log('[build] 顶层容器', report.topLevel, '叶子路径', report.paths);
