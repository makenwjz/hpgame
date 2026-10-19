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
    use_regex: true,
    extensions: {
      position: 0, exclude_recursion: true, display_index: i,
      probability: 100, useProbability: true, depth: 4, selectiveLogic: 0,
      outlet_name: '', group: '', group_override: false, group_weight: 100,
      prevent_recursion: true, delay_until_recursion: false,
      scan_depth: null, match_whole_words: null, use_group_scoring: null,
      case_sensitive: null, automation_id: '', role: 0, vectorized: false,
      sticky: null, cooldown: null, delay: null,
      match_persona_description: false, match_character_description: false,
      match_character_personality: false, match_character_depth_prompt: false,
      match_scenario: false, match_creator_notes: false,
      triggers: [], ignore_budget: false,
    },
  });
}

// ---------- [InitVar] 条目（MVU 靠这个名字识别初始值） ----------
// MVU 的初始值格式：[值, "更新条件说明"] 成对；嵌套对象表示变量层级。
// 这里直接从 schema 的默认值生成，保证与 15 容器永远一致。
function buildInitVarEntry(index) {
  const dflt = defaultStat();
  // 把每个叶子包成 [值, 说明]
  const NOTES = {
    '主角.姓名': '主角名，固定「哈利·波特」，不随剧情变',
    '主角.性别': '固定「男」——本卡主角是全校唯一的男学生',
    '主角.学院': '分院仪式后确定一次，之后不变',
    '主角.年级': '1–7，每学年 +1',
    '主角.血统': '纯血 / 混血 / 麻瓜出身，创角时定，不变',
    '主角.出身': '入学前的家庭与成长背景，创角时写一次',
    '主角.体力': '0–100，检定与战斗消耗，周结算与休息恢复',
    '主角.魔力': '0–100，施法与检定消耗，休息恢复',
    '主角.伤势': '0–100，≥50 时判定线 −5，周结算缓慢恢复',
    '主角.学院分': '−200~500，学院杯积分，学年内累加，第 43 周结算排名',
    '主角.零花钱': '按血统每 4 周发放，与周结算一起',
    '时空.学年': '1–7',
    '时空.周': '1–43，每周结算 +1',
    '时空.日期': '格式「1991年09月01日」，每周结算 +7 天',
    '时空.时段': '上午 / 下午 / 黄昏 / 夜晚',
    '日程.本周已用': '0–4，每个行动按代价扣，满 4 触发周结算',
    '日程.行动点上限': '固定 4',
    '五维.*.阶': '1–5 阶，开局 2 阶；每阶 6 点经验',
    '五维.*.经验': '0–5，满 6 升阶并归零',
    '五维.*.本年已得': '0–12，本学年该维已获得的经验；每学年每维上限 12（=2 阶）',
    '关系.*.Rank': '1–10，每 10 点社群点升一级；3/6/9 级要过五维门槛',
    '关系.*.社群点': '0–100',
    '宫殿.在宫殿': 'true 表示当前身处行间/宫殿',
    '宫殿.灯火': '0–300，探索消耗，安全屋恢复',
    '宫殿.警戒': '0–100，检定失败上升，≥60/80 会削判定线',
    '宫殿.碎片': '最多 3 块，集齐 3 块可开秘宝房',
    '宫殿.退路': '0–2，改心三条件之一',
    '秘密.发现度': '0–100，哈莉秘密的暴露程度',
  };
  const noteOf = pathStr => {
    if (NOTES[pathStr]) return NOTES[pathStr];
    const wild = pathStr.replace(/^([^.]+)\.[^.]+\./, '$1.*.');
    return NOTES[wild] ?? '';
  };
  const wrap = (obj, prefix) => {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const p = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = wrap(v, p);
      else out[k] = [v, noteOf(p)];
    }
    return out;
  };
  const initVar = wrap(dflt, '');

  return {
    id: 900 + index,
    keys: [],
    secondary_keys: [],
    comment: '[InitVar] 初始变量',
    content: JSON.stringify(initVar, null, 2),
    constant: false,        // MVU 会主动读取，不需要常驻注入
    selective: false,
    insertion_order: 1,
    enabled: true,
    position: 'before_char',
    depth: 4,
    use_regex: true,
    extensions: {
      position: 0, exclude_recursion: true, display_index: 900 + index,
      probability: 100, useProbability: true, depth: 4, selectiveLogic: 0,
      outlet_name: '', group: '', group_override: false, group_weight: 100,
      prevent_recursion: true, delay_until_recursion: false,
      scan_depth: null, match_whole_words: null, use_group_scoring: null,
      case_sensitive: null, automation_id: '', role: 0, vectorized: false,
      sticky: null, cooldown: null, delay: null,
      match_persona_description: false, match_character_description: false,
      match_character_personality: false, match_character_depth_prompt: false,
      match_scenario: false, match_creator_notes: false,
      triggers: [], ignore_budget: false,
    },
  };
}

entries.push(buildInitVarEntry(0));

// ---------- 卡内脚本（酒馆助手） ----------
// 形状照抄原卡 v10.1 实测结构；id 必须固定，否则每次构建都变，助手会当成新脚本。
// 顺序即执行顺序：MVU 必须先于业务核心，core 的 readStat 依赖 globalThis.Mvu。
const SCRIPT_DIR = path.join(ROOT, 'src', 'scripts');
const SCRIPT_MANIFEST = [
  { file: 'mvu.js', name: 'HP-Reverb · MVU 变量系统', id: 'a7c2e4d1-3b8f-4e62-9d15-6c0a8b7f2e31' },
  { file: 'loader.js', name: 'HP-Reverb · 引导', id: 'b3f1c0a2-5d4e-4a91-8c6b-1e7f2d9a4c05' },
];

function buildScripts() {
  const out = [];
  for (const m of SCRIPT_MANIFEST) {
    const p = path.join(SCRIPT_DIR, m.file);
    if (!fs.existsSync(p)) throw new Error(`脚本缺失：${m.file}`);
    const content = fs.readFileSync(p, 'utf8');
    out.push({
      type: 'script',
      enabled: true,
      name: m.name,
      content,
      id: m.id,
      info: '',
      button: { enabled: false, buttons: [] },
      data: {},
      export_with: { data: false, button: false },
    });
  }
  return out;
}

const scripts = buildScripts();
const bootScript = scripts.find(s => s.content.includes('HP_REVERB_LOADING'));
if (!bootScript) throw new Error('loader.js 里没有 HP_REVERB_LOADING 标记，引导脚本不会被识别');

// ---------- 卡内正则（由 build-regex 产出，build-card 负责装配） ----------
// 顺序：build 脚本里 regex 在 card 之后跑，所以这里读上一次的产物；
// 若不存在则留空数组，由 build-regex 在下一轮补上（npm run build 的顺序已保证最终一致）。
const REGEX_DIR = path.join(ROOT, 'dist', 'regex');
function loadRegexScripts() {
  if (!fs.existsSync(REGEX_DIR)) return [];
  const mf = path.join(REGEX_DIR, 'manifest.json');
  if (!fs.existsSync(mf)) return [];
  const manifest = JSON.parse(fs.readFileSync(mf, 'utf8'));
  const out = [];
  for (const item of manifest.items) {
    const f = path.join(REGEX_DIR, `${item.scriptName}.json`);
    if (fs.existsSync(f)) out.push(JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  return out;
}
const regexScripts = loadRegexScripts();

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
    // 不写构建时间：时间戳会让每次构建都产生 git diff，破坏可重复构建。
    hp_reverb: { contract: '2026-11-a', schema: 1 },
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
    extensions: {
      // 酒馆助手从 data.extensions.tavern_helper 读脚本（原卡同位置）
      tavern_helper: { scripts, variables: {} },
      // 正则放在 data.extensions.regex_scripts（原卡同位置）
      regex_scripts: regexScripts,
    },
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
  scripts: scripts.length,
  regex: regexScripts.length,
  // 不写 generatedAt：会让每次构建都产生 diff，破坏可重复构建
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
console.log('[build] 条目', report.entries, '常驻字数', report.constantChars, 'JSON 字节', report.cardJsonBytes);
console.log('[build] 顶层容器', report.topLevel, '叶子路径', report.paths, '卡内脚本', report.scripts, '正则', report.regex);
