// HP-Reverb core 0.1.0 · 自动生成，勿手改
// ---- src/schema.mjs ----
// src/schema.mjs
// 15 容器 schema：无依赖的迷你实现（可被 ZOD 适配层包一层）。
// 每个字段：默认值 → 夹取范围 → 枚举回退。脏输入不崩，只被夹回去。

const clampNum = (v, min, max, dflt) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(n, min), max);
};

const num = (dflt, min, max) => ({
  kind: 'num', dflt, min, max,
  norm: v => clampNum(v, min, max, dflt),
});
const numOpen = (dflt, min) => ({
  kind: 'num', dflt, min, max: Infinity,
  norm: v => { const n = Number(v); return Number.isFinite(n) ? Math.max(n, min) : dflt; },
});
const text = (dflt = '') => ({
  kind: 'text', dflt,
  norm: v => (v == null ? dflt : String(v).trim() === '' ? dflt : String(v)),
});
const pick = (values, dflt) => ({
  kind: 'enum', dflt, values,
  norm: v => (values.includes(v) ? v : dflt),
});
const flag = (dflt = false) => ({
  kind: 'bool', dflt,
  norm: v => (typeof v === 'string' ? /^(true|1|是|有|开|yes)$/i.test(v.trim()) : v == null ? dflt : Boolean(v)),
});
const obj = shape => ({ kind: 'obj', shape, dflt: () => defaults(shape),
  norm: v => normalize(v && typeof v === 'object' && !Array.isArray(v) ? v : {}, shape) });
const list = (item, limit) => ({
  kind: 'list', dflt: [], limit,
  norm: v => {
    const arr = Array.isArray(v) ? v : [];
    const out = arr.map(x => (item.norm ? item.norm(x) : x));
    return limit ? out.slice(-limit) : out;
  },
});
const record = (item, limit) => ({
  kind: 'record', dflt: {}, limit,
  norm: v => {
    const src = v && typeof v === 'object' && !Array.isArray(v) ? v : {};
    const keys = Object.keys(src).slice(limit ? -limit : 0);
    const out = {};
    for (const k of keys) out[k] = item.norm ? item.norm(src[k]) : src[k];
    return out;
  },
});

function defaults(shape) {
  const out = {};
  for (const [k, s] of Object.entries(shape)) out[k] = typeof s.dflt === 'function' ? s.dflt() : s.dflt;
  return out;
}
function normalize(input, shape) {
  const out = {};
  for (const [k, s] of Object.entries(shape)) out[k] = s.norm(input[k]);
  // 保留 schema 不认识的字段（宽松对象），避免旧存档丢数据
  for (const k of Object.keys(input)) if (!(k in out)) out[k] = input[k];
  return out;
}

// ---------------- 15 容器 ----------------
const Schema = {
  主角: obj({
    姓名: text(''), 性别: pick(['女', '男'], '女'), 血统: pick(['纯血', '混血', '麻瓜出身', '未知'], '未知'),
    出身: text(''), 学院: pick(['格兰芬多', '斯莱特林', '拉文克劳', '赫奇帕奇', '未分院'], '未分院'),
    年级: num(1, 1, 7), 魔杖: obj({ 木材: text(''), 杖芯: text('') }),
    体力: num(100, 0, 100), 魔力: num(100, 0, 100), 伤势: num(0, 0, 100),
    声望: num(0, -3, 5), 零花钱: numOpen(0, 0),
  }),
  时空: obj({
    学年: num(1, 1, 7), 周: num(1, 1, 43), 日期: text('1991年09月01日'),
    时段: pick(['上午', '下午', '黄昏', '夜晚'], '上午'),
  }),
  日程: obj({ 本周已用: num(0, 0, 4), 行动点上限: num(4, 0, 4), 本周安排: list(text(''), 4) }),
  五维: obj(Object.fromEntries(['学业', '胆识', '魅力', '共情', '心志'].map(k =>
    [k, obj({ 阶: num(2, 1, 5), 经验: num(0, 0, 5) })]))),
  关系: record(obj({
    Rank: num(1, 1, 10), 社群点: num(0, 0, 100), 已建立: flag(false), 已登场: flag(false),
    支线状态: pick(['未开始', '进行中', '已完成', '失败'], '未开始'),
    年龄: num(18, 0, 999), 身份: text(''), 出身: text(''), 服饰: text(''), 印象: text(''),
    身高: num(170, 0, 260), 体重: num(55, 0, 200), 三围: text(''), 体型: text(''), 身体: text(''),
    名器评级: text(''), 名器: text(''), 当前任务: text(''),
    服装: obj({ 常服: text(''), 校服: text(''), 礼服: text(''), 内衣: text(''), 鞋袜: text(''), 饰品: text('') }),
  }), 128),
  网: record(obj({ 状态: pick(['如常', '紧张', '破裂', '结盟'], '如常'), 强度: num(1, 1, 5) }), 60),
  秘密: obj({
    发现度: num(0, 0, 100), 哈莉已登场: flag(false),
    哈莉所在: pick(['', '宿舍', '行间', '失踪', '被带走'], ''), 共谋者: list(text(''), 5),
  }),
  宫殿: obj({
    在宫殿: flag(false), 当前: text(''), 层: num(0, 0, 5), 位置: obj({ x: num(0, 0, 23), y: num(0, 0, 17) }),
    灯火: num(220, 0, 300), 钥匙: num(0, 0, 9), 意志: num(0, 0, 9), 警戒: num(0, 0, 100),
    已探索: list(text(''), 64), 机关: obj({}), 碎片: list(text(''), 3), 退路: num(0, 0, 2),
    本局战利品: list(text(''), 7),
  }),
  队伍: record(obj({
    等级: num(1, 1, 20), HP: num(100, 0, 999), MP: num(50, 0, 999),
    BP: num(1, 0, 5), 装备: list(text(''), 3),
  }), 4),
  能力: obj({ 咒语掌握: record(num(0, 0, 20), 20) }),
  物品与金钱: obj({
    钱: obj({ 加隆: numOpen(0, 0), 西可: numOpen(0, 0), 纳特: numOpen(0, 0) }),
    背包: list(obj({ 名称: text(''), 数量: numOpen(1, 0), 类型: text('道具') }), 20),
    关键道具: list(text(''), 12),
  }),
  守护神: obj({ 形态: text(''), 已掌握: flag(false) }),
  主角状态: obj({ 死亡: flag(false), 重伤: flag(false), 被开除: flag(false), 退学: flag(false), 回退次数: num(0, 0, 9) }),
  事件线索: obj({
    当前事件: text('无'), 进行中支线: list(text(''), 12),
    主线节点进度: record(pick(['未触发', '进行中', '已完成', '已改写'], '未触发'), 20),
  }),
  期限: record(obj({
    截止周: num(1, 1, 43), 状态: pick(['未启动', '进行中', '已完成', '逾期'], '未启动'),
    后果等级: pick(['低', '中', '高'], '中'),
  }), 24),
};

const ROOT_KEYS = Object.keys(Schema);

function normalizeStat(input = {}) { return normalize(input, Schema); }
function defaultStat() { return defaults(Schema); }

// ---------------- 路径白名单 ----------------
const WHITELIST = ROOT_KEYS.map(k => `/${k}`);

function isAllowedPath(p) {
  if (typeof p !== 'string' || !p.startsWith('/')) return false;
  if (!WHITELIST.some(w => p === w || p.startsWith(w + '/'))) return false;
  return isLegalKeyedPath(p);
}

// 记录类容器的键必须是「规范名」，不是带空格/中文 rank 的伪键（v10.1 幽灵键的根因）
function isLegalPersonKey(k) {
  if (!k) return false;
  if (/\\s/.test(k)) return false;
  if (/rank/i.test(k)) return false;
  return k.length <= 12;
}
function isLegalKeyedPath(p) {
  const seg = p.split('/').filter(Boolean);
  if (seg[0] === '关系' && seg[1]) return isLegalPersonKey(seg[1]);
  if (seg[0] === '网' && seg[1]) return /^[^\\s]+▸[^\\s]+$/.test(seg[1]);
  return true;
}

/** 过滤一段 JSONPatch：丢弃非法路径，返回 {patch, dropped} */
function sanitizePatch(patch) {
  const arr = Array.isArray(patch) ? patch : [];
  const kept = [];
  const dropped = [];
  for (const op of arr) {
    if (op && typeof op.path === 'string' && isAllowedPath(op.path)) kept.push(op);
    else dropped.push(op);
  }
  return { patch: kept, dropped };
}

/** 列出全部叶子路径（给 check-paths 用） */
function listPaths(schema = Schema, prefix = '', out = []) {
  for (const [k, s] of Object.entries(schema)) {
    const p = `${prefix}/${k}`;
    if (s.kind === 'obj') listPaths(s.shape, p, out);
    else out.push({ path: p, kind: s.kind, dflt: s.dflt });
  }
  return out;
}

// ---- src/rules/affinity.mjs ----
// src/rules/affinity.mjs —— 社群结算纯函数（不碰 DOM / MVU）
// 口径：02-社群与网、08-社群口径

const KIND_CAP = { 对话: 2, 帮助: 8, 送礼: 8, 共患难: 10, 检定: 5, 任务: 10 };
const KIND_MIN = { 送礼: -3 };
const SINGLE_CAP = 10;
const RANK_GATES = { 3: 3, 6: 4, 9: 5 };
const RANK10_MIN_AXES = 3;
const RANK10_MIN_TIER = 4;

function clampAff(v, a, b) { return Math.min(Math.max(v, a), b); }

/** 单次增减幅度：按 kind 夹取，再夹 ±10 */
function clampDelta(kind, delta) {
  const cap = Math.min(KIND_CAP[kind] ?? 5, SINGLE_CAP);
  const d = Number.isFinite(Number(delta)) ? Number(delta) : cap;
  return clampAff(d, -cap, cap);
}

/** 周内第二次 ×0.5；同 kind 连刷三次起 ×0.7 */
function decay(delta, { weeklySame = 0, sameKindStreak = 0 } = {}) {
  let d = delta;
  if (weeklySame >= 1) d *= 0.5;
  if (sameKindStreak >= 2) d *= 0.7;
  return Math.round(d);
}

/** 门槛：她最看重的一维达到 3/4/5 阶 */
function gateOk(rank, axisTier) {
  const need = RANK_GATES[rank];
  if (!need) return true;
  return Number(axisTier) >= need;
}

/** Rank 10 额外条件：任意三维 ≥4 阶 */
function rank10Ok(axes = []) {
  return axes.filter(t => Number(t) >= RANK10_MIN_TIER).length >= RANK10_MIN_AXES;
}

/**
 * 结算一次好感。
 * @param {{rank:number, points:number}} rel
 * @param {{kind:string, delta:number}} req
 * @param {{axisTier:number, axes:number[], weeklySame?:number, sameKindStreak?:number}} ctx
 */
function settleAffinity(rel, req, ctx = {}) {
  const before = { rank: rel.rank ?? 1, points: rel.points ?? 0 };
  const raw = clampDelta(req.kind, req.delta);
  const delta = decay(raw, ctx);
  const points = clampAff(before.points + delta, 0, 100);
  let rank = before.rank;

  const want = Math.min(10, 1 + Math.floor(points / 10));
  let blocked = null;
  if (want > rank) {
    if (!gateOk(want, ctx.axisTier)) blocked = { at: want, reason: `差 ${ctx.axis ?? '那一维'} ${RANK_GATES[want] ?? '?'} 阶` };
    else if (want === 10 && !rank10Ok(ctx.axes)) blocked = { at: 10, reason: '任意三维 ≥4 阶' };
    else rank = want;
  }

  return {
    ok: true,
    delta,
    points,
    rank,
    rankChanged: rank !== before.rank,
    blocked,
    receipt: `${delta >= 0 ? '+' : ''}${delta} → ${points}/100 · Rank ${rank}` +
      (blocked ? `（卡在 ${blocked.reason}）` : ''),
  };
}

/** 欺骗惩罚：同一周同时答应两人 */
function betrayalPenalty() { return -15; }

// ---- src/rules/roll.mjs ----
// src/rules/roll.mjs —— 对峙结算纯函数（十类检定 / 1d100 低掷）
// 口径：10-战斗-八方旅人、11-对峙与回声、03-行间对峙回声 §8

const DIFFICULTY = {
  简单: { line: 65, scale: 0.6 },
  普通: { line: 50, scale: 1.0 },
  困难: { line: 35, scale: 1.4 },
  极难: { line: 20, scale: 1.8 },
};
const FOE_MOD = { 普通: 0, 精英: 5, 首领: 10, 灾厄: 15 };
const PARTIAL_WINDOW = 15;

const CHECK_TYPES = {
  咒语命中: { attr: '魔力', settle: { 成功: { 魔力: -3 }, 部分成功: { 魔力: -6, 伤势: 3 }, 失败: { 魔力: -10, 伤势: 5 } } },
  魔药成败: { attr: '魔力', settle: { 成功: { 魔力: -2 }, 部分成功: { 魔力: -4, 伤势: 3 }, 失败: { 体力: -8, 伤势: 5 } } },
  决斗: { attr: '体力', settle: { 成功: { 体力: -5 }, 部分成功: { 体力: -10, 伤势: 5 }, 失败: { 体力: -15, 伤势: 10 } } },
  疑点调查: { attr: '魔力', settle: { 成功: { 体力: -2 }, 部分成功: { 体力: -5 }, 失败: { 体力: -5, 伤势: 5 } } },
  说服: { attr: '声望', settle: { 成功: {}, 部分成功: { 社群: -2 }, 失败: { 社群: -5 } } },
  潜行: { attr: '体力', settle: { 成功: { 体力: -3 }, 部分成功: { 体力: -5, 伤势: 2 }, 失败: { 体力: -8, 伤势: 5 } } },
  照料生灵: { attr: '魔力', settle: { 成功: { 魔力: -2 }, 部分成功: { 魔力: -4 }, 失败: { 魔力: -6, 伤势: 3 } } },
  变形操作: { attr: '魔力', settle: { 成功: { 魔力: -3 }, 部分成功: { 魔力: -6, 伤势: 3 }, 失败: { 魔力: -10, 伤势: 6 } } },
  炼金配比: { attr: '魔力', settle: { 成功: { 魔力: -2 }, 部分成功: { 魔力: -4, 伤势: 2 }, 失败: { 魔力: -8, 伤势: 6 } } },
  飞行机动: { attr: '体力', settle: { 成功: { 体力: -4 }, 部分成功: { 体力: -8, 伤势: 4 }, 失败: { 体力: -12, 伤势: 8 } } },
};

const DELTA_CAP = { 体力: 40, 魔力: 40, 伤势: 30, 声望: 15, 社群: 10 };
const clampRoll = (v, a, b) => Math.min(Math.max(v, a), b);

/** 判定线 */
function computeLine(opts = {}) {
  const {
    type = '咒语命中', dc = '普通', foe = '普通',
    studyTier = 2, spellSkill = 0, companions = 0, support = 0,
    relics = 0, axisTier = 2, echo = 0, injury = 0,
  } = opts;
  const parts = [];
  const add = (label, v) => { if (v) parts.push([label, v]); return v; };

  let line = 50;
  add('基础', 50);
  const school = clampRoll(Number(studyTier) * 2, 0, 10); line += add('学派', school);
  const skill = clampRoll(Math.floor(Number(spellSkill) / 2), 0, 10); line += add('熟练', skill);
  const comp = clampRoll(Number(companions) * 3 + Number(support), 0, 20); line += add('同行', comp);
  const rel = clampRoll(Number(relics), 0, 12); line += add('残留', rel);
  const axis = clampRoll((Number(axisTier) - 2) * 2, -6, 6); line += add('五维', axis);
  const foeMod = -(FOE_MOD[foe] ?? 0); line += add('敌人', foeMod);
  const echoMod = Number(echo) >= 80 ? -10 : Number(echo) >= 60 ? -5 : 0; line += add('回声', echoMod);
  const inj = Number(injury) >= 50 ? -5 : 0; line += add('伤势', inj);

  return { line: clampRoll(Math.round(line), 5, 95), parts, type, dc, foe };
}

/** 判定 */
function judge(roll, line) {
  if (roll <= 3) return { result: '极值成功', note: '骰面 ≤3', critical: true };
  if (roll <= line) return { result: '成功', note: '', critical: false };
  if (roll <= line + PARTIAL_WINDOW) return { result: '部分成功', note: '', critical: false };
  if (roll >= 98) return { result: '极值失败', note: '骰面 ≥98', critical: true };
  return { result: '失败', note: '', critical: false };
}

/** 结算：结果 × 难度系数 → 各字段变化 */
function settle(type, result, scale = 1, critical = false) {
  const t = CHECK_TYPES[type] ?? CHECK_TYPES.咒语命中;
  const base = t.settle[result] ?? {};
  const mult = scale * (critical && result === '极值失败' ? 1.5 : 1);
  const out = {};
  for (const [k, v] of Object.entries(base)) {
    let d = v < 0 ? Math.round(v * mult) : Math.round(v * mult);
    if (d !== 0 && Math.abs(d) < 1) d = Math.sign(v);
    out[k] = clampRoll(d, -DELTA_CAP[k], DELTA_CAP[k]);
  }
  return out;
}

/** 一次完整检定 */
function resolve(req, ctx = {}, rng = () => 1 + Math.floor(Math.random() * 100)) {
  const type = CHECK_TYPES[req.type] ? req.type : '咒语命中';
  const dc = DIFFICULTY[req.dc] ? req.dc : '普通';
  const { line, parts } = computeLine({ ...ctx, type, dc, foe: req.foe });
  const roll = rng();
  const { result, note, critical } = judge(roll, line);
  const deltas = settle(type, result, DIFFICULTY[dc].scale, critical);
  const echoGain = result === '成功' ? 3 : result === '部分成功' ? 8 : result === '极值成功' ? 1 : 15;
  return { type, dc, roll, line, result, note, critical, parts, deltas, echoGain };
}

/** 生成 <check> 文本（只有这里能产出） */
function renderCheck(r) {
  const d = Object.entries(r.deltas).map(([k, v]) => `${k}${v >= 0 ? '+' : ''}${v}`).join(' ') || '无消耗';
  const mods = r.parts.filter(([l]) => l !== '基础').map(([l, v]) => `${l}${v >= 0 ? '+' : ''}${v}`).join(' ');
  return `<check type="${r.type}" dc="${r.dc}">${r.result}｜1d100=${r.roll} 判定线 ${r.line}（${mods}）｜${d}</check>`;
}

// ---- src/rules/schedule.mjs ----
// src/rules/schedule.mjs —— 日程 / 周结算 / 五维经验 / 考试（纯函数）
const POINTS_PER_WEEK = 4;
const COST = { 陪人: 1, 自习: 1, 打工: 1, 采买: 1, 短行动: 0, 休息: 1, 潜入: 2 };
const STAGE_STEP = 6;         // 每阶 6 经验
const STAGE_MAX = 5;
const STAGE_PER_YEAR = 2;     // 每学年每维最多 2 阶

const clampSched = (v, a, b) => Math.min(Math.max(v, a), b);

function canDo(used, doWhat) {
  const cost = COST[doWhat] ?? 1;
  if (used + cost > POINTS_PER_WEEK) return { ok: false, cost, reason: '这周的安排满了' };
  return { ok: true, cost };
}

function spend(stat, doWhat) {
  const r = canDo(stat.日程?.本周已用 ?? 0, doWhat);
  if (!r.ok) return r;
  stat.日程.本周已用 += r.cost;
  return r;
}

/** 五维加经验，返回是否升阶 */
function addExp(stat, axis, n = 1) {
  const cur = stat.五维[axis];
  if (!cur) return { ok: false };
  const yearly = stat.五维[axis].本年已得 ?? 0;
  const allowed = Math.max(0, STAGE_PER_YEAR * STAGE_STEP - yearly);
  const gain = Math.min(n, allowed);
  if (gain <= 0) return { ok: false, reason: '本学年该维已到上限' };
  cur.本年已得 = yearly + gain;
  cur.经验 += gain;
  let up = 0;
  while (cur.经验 >= STAGE_STEP && cur.阶 < STAGE_MAX) {
    cur.经验 -= STAGE_STEP; cur.阶 += 1; up += 1;
  }
  return { ok: true, gain, up, stage: cur.阶, exp: cur.经验 };
}

/** 周结算 */
function weekTick(stat) {
  const s = stat;
  s.日程.本周已用 = 0;
  s.日程.本周安排 = [];
  s.时空.周 = clampSched((s.时空.周 ?? 1) + 1, 1, 43);
  // 日期 = 1991-09-01 + (周-1)*7
  const base = new Date(Date.UTC(1991, 8, 1));
  base.setUTCDate(base.getUTCDate() + (s.时空.周 - 1) * 7);
  const p = n => String(n).padStart(2, '0');
  s.时空.日期 = `${base.getUTCFullYear()}年${p(base.getUTCMonth() + 1)}月${p(base.getUTCDate())}日`;
  s.时空.时段 = '上午';
  const rest = (s.主角.伤势 ?? 0) >= 50 ? 5 : 10;
  s.主角.体力 = clampSched((s.主角.体力 ?? 100) + rest, 0, 100);
  s.主角.魔力 = clampSched((s.主角.魔力 ?? 100) + rest, 0, 100);
  if (!s.宫殿?.在宫殿) s.主角.伤势 = clampSched((s.主角.伤势 ?? 0) - 5, 0, 100);
  return { week: s.时空.周, date: s.时空.日期 };
}

/** 期末考试分 */
function examScore(stat, { selfStudy = 0, review = 0, midBonus = 0 } = {}) {
  const study = stat.五维?.学业?.阶 ?? 2;
  return study * 4 + Math.min(selfStudy, 6) + review * 3 + midBonus;
}

function examGrade(score) {
  if (score >= 30) return 'O';
  if (score >= 24) return 'E';
  if (score >= 16) return 'A';
  if (score >= 10) return 'P';
  return 'D';
}

/** 学年切换：清子上限 */
function yearTick(stat) {
  stat.时空.学年 = clampSched((stat.时空.学年 ?? 1) + 1, 1, 7);
  stat.时空.周 = 1;
  for (const k of Object.keys(stat.五维)) if (stat.五维[k]) stat.五维[k].本年已得 = 0;
  return stat.时空.学年;
}

// ---- src/contract.mjs ----
// src/contract.mjs
// 全卡唯一契约源：脚本常量、提示词条目都由这里生成。
// 任何枚举只在这里改一次——v10.1 就是因为「13 类检定分三处写」而烂掉的。

const ACT_DO = ['陪人', '自习', '打工', '采买', '短行动', '休息', '潜入'];
const SLOT = ['周三', '周五', '周六', '周日'];
const ROLL_TYPE = [
  '咒语命中', '魔药成败', '决斗', '疑点调查', '说服',
  '潜行', '照料生灵', '变形操作', '炼金配比', '飞行机动',
];
const DC = ['简单', '普通', '困难', '极难'];
const FOE = ['普通', '精英', '首领', '灾厄'];
const ROLL_ACTION = ['撤退', '投降'];
const AFFINITY_KIND = ['对话', '帮助', '送礼', '共患难', '检定', '任务'];
const AFFINITY_LINE = ['未开始', '进行中', '已完成', '失败'];
const EVENT_KIND = ['主线节点', '支线', '社群'];
const EVENT_STATE = ['未触发', '进行中', '已完成', '已改写'];
const TIER = ['T1', 'T2', 'T3', '敌对'];

/** 请求语法（供《请求契约》条目直接引用） */
const GRAMMAR = {
  act: '<act do="陪人" target="罗娜·韦斯莱" slot="周三"/>',
  roll: '<roll type="咒语命中" dc="普通" attr="魔力" spell="火焰熊熊" axis="胆识" foe="普通" action="撤退" retry="false"/>',
  affinity: '<affinity name="罗娜·韦斯莱" kind="帮助" delta="+8" reason="替她挡了扣分"/>',
  event: '<event kind="主线节点" name="入学与分院" state="已完成" date="1991年09月01日"/>',
  ability: '<ability kind="咒语" name="荧光闪烁 0→2" cost="魔力 3">杖尖稳住了一点。</ability>',
};

/** 生成《请求契约》条目正文 */
function renderContract() {
  return `<请求契约>
全卡只有这一处定义请求语法。正文里只允许出现下面五类自闭合或成对标签，别的标签一律不写。

【一、行动】${GRAMMAR.act}
· do：${ACT_DO.join(' / ')}
· slot：${SLOT.join(' / ')}
· 一次行动一个标签，写在正文第一行之前；不写就视为纯叙事，不扣行动点。

【二、检定】${GRAMMAR.roll}
· type：${ROLL_TYPE.join(' / ')}
· dc：${DC.join(' / ')}（判定线 65 / 50 / 35 / 20）
· foe：${FOE.join(' / ')}（0 / −5 / −10 / −15）
· action：${ROLL_ACTION.join(' / ')}（撤退要掷；投降不掷）
· attr 只写 魔力 / 体力 / 声望；spell 只在练过该咒语时写
· 骰子由脚本掷，模型不得声明结果，也不得自己写 <check>。

【三、好感】${GRAMMAR.affinity}
· kind：${AFFINITY_KIND.join(' / ')}（单次上限 10）
· delta 写带符号整数，如 +8、-5
· 只在本楼真的发生了一次互动时写；寒暄不写。

【四、事件】${GRAMMAR.event}
· kind：${EVENT_KIND.join(' / ')}
· state：${EVENT_STATE.join(' / ')}（主线节点才需要）
· 社群事件只写 name（人物规范名），不要写 rank；rank 由脚本按点数算。

【五、能力】${GRAMMAR.ability}
· 只记录本楼真的变化了的咒语熟练度，没有变化就整块省略。

【三条硬规矩】
1. <check> 只能由脚本产出；模型直接写会被剥离。
2. 没有请求就不推进任何数值。
3. 解析不了的请求降级处理，不许原样留在正文里。

【路径白名单】只允许写这 15 个容器：
/主角 /时空 /日程 /五维 /关系 /网 /秘密 /宫殿 /队伍 /能力 /物品与金钱 /守护神 /主角状态 /事件线索 /期限
</请求契约>`;
}

// ---- src/core.mjs ----
// src/core.mjs —— 运行时核心（由卡片里的 loader 从 GitHub 动态加载）
// 职责：解析正文里的请求标签 → 调用纯函数规则 → 写回变量与正文 → 弹回执。
// 边界：不写叙事；所有数值只在这里落地。
// 注意：Tavern Helper / MVU 的具体 API 以目标运行时为准，本文件全部做了能力探测。





const LOG = '[HP-Reverb]';
const TAG = {
  act: /<act\b([^>]*?)\/?>/gi,
  roll: /<roll\b[^>]*?(?:\/>|>\s*<\/roll\s*>)/gi,
  affinity: /<affinity\b[^>]*?(?:\/>|>\s*<\/affinity\s*>)/gi,
  event: /<event\b[^>]*?(?:\/>|>\s*<\/event\s*>)/gi,
  check: /<check\b[^>]*?>[\s\S]*?<\/check>/gi,
};

function attrs(s) {
  const out = {};
  const re = /([A-Za-z\u4e00-\u9fa5_-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = m[2];
  return out;
}

function api(name) {
  const f = globalThis[name];
  return typeof f === 'function' ? f : null;
}

async function getMvu(timeout = 12000) {
  if (globalThis.Mvu) return globalThis.Mvu;
  if (typeof waitGlobalInitialized === 'function') {
    await Promise.race([waitGlobalInitialized('Mvu'), new Promise(r => setTimeout(r, timeout))]);
  }
  return globalThis.Mvu ?? null;
}

async function readStat(mid) {
  const mvu = await getMvu();
  if (!mvu?.getMvuData) return null;
  const d = await Promise.resolve(mvu.getMvuData({ type: 'message', message_id: mid }));
  return d?.stat_data ?? null;
}

async function writeStat(mid, stat) {
  const mvu = await getMvu();
  if (!mvu?.replaceMvuData) return false;
  const d = (await Promise.resolve(mvu.getMvuData({ type: 'message', message_id: mid }))) || {};
  d.stat_data = normalizeStat(stat);
  await Promise.resolve(mvu.replaceMvuData(d, { type: 'message', message_id: mid }));
  return true;
}

async function readText(mid) {
  const get = api('getChatMessages');
  if (!get) return null;
  const got = await Promise.resolve(get(mid));
  const first = Array.isArray(got) ? got[0] : got;
  return first?.message ?? null;
}

async function writeText(mid, text) {
  const set = api('setChatMessages');
  if (!set) return false;
  await Promise.resolve(set([{ message_id: mid, message: text }], { refresh: 'affected' }));
  return true;
}

function toast(text, bad = false) {
  try {
    const id = '__hp_toast';
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = `position:fixed;left:50%;transform:translateX(-50%);bottom:16px;z-index:2147483000;
      max-width:86vw;padding:8px 14px;border-radius:6px;font:12px/1.6 system-ui;white-space:pre-wrap;
      background:${bad ? '#2a1414' : '#14110c'};color:${bad ? '#ffb4b4' : '#e9e0cc'};
      border:1px solid ${bad ? '#8a3c3c' : '#8a6f3c'}`;
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  } catch { console.log(LOG, text); }
}

/** 关系键 → 最看重的一维（由人设/塔罗表提供；缺省用共情） */
const AXIS_OF = new Map();
function registerAxis(name, axis) { AXIS_OF.set(name, axis); }

function axisTier(stat, name) {
  const axis = AXIS_OF.get(name) ?? '共情';
  return stat.五维?.[axis]?.阶 ?? 2;
}

function allAxes(stat) {
  return Object.values(stat.五维 ?? {}).map(v => v?.阶 ?? 2);
}

/** 处理一条消息里的全部请求 */
async function handleMessage(mid) {
  const raw = await readText(mid);
  if (!raw) return;
  let text = raw;
  const stat = (await readStat(mid)) ?? defaultStat();
  const notes = [];
  let changed = false;

  // ---- act ----
  text = text.replace(TAG.act, (tag) => {
    const a = attrs(tag);
    if (!C.ACT_DO.includes(a.do)) { notes.push(`未知行动「${a.do}」，按休息处理`); a.do = '休息'; }
    const r = spend(stat, a.do);
    if (!r.ok) { notes.push(r.reason); return ''; }
    if (a.do === '潜入') { stat.宫殿.在宫殿 = true; stat.主角.体力 = Math.max(0, stat.主角.体力 - 10); }
    if (a.do === '休息') { stat.主角.体力 = Math.min(100, stat.主角.体力 + 25); stat.主角.魔力 = Math.min(100, stat.主角.魔力 + 25); }
    changed = true;
    notes.push(`${a.do} −${r.cost} 点（${stat.日程.本周已用}/4）`);
    return '';
  });

  // ---- roll ----
  text = text.replace(TAG.roll, (tag) => {
    const a = attrs(tag);
    const r = resolve(a, {
      studyTier: stat.五维?.学业?.阶 ?? 2,
      spellSkill: stat.能力?.咒语掌握?.[a.spell] ?? 0,
      companions: Array.isArray(stat.队伍) ? Object.keys(stat.队伍).length - 1 : 0,
      relics: stat.宫殿?.本局战利品?.length ?? 0,
      axisTier: stat.五维?.[a.axis]?.阶 ?? 2,
      echo: stat.宫殿?.警戒 ?? 0,
      injury: stat.主角?.伤势 ?? 0,
    });
    for (const [k, v] of Object.entries(r.deltas)) {
      if (k === '社群') continue;
      const path = ['体力', '魔力', '伤势', '声望'].includes(k) ? stat.主角 : null;
      if (path) path[k] = Math.max(0, Math.min(100, (path[k] ?? 0) + v));
    }
    stat.宫殿.警戒 = Math.min(100, (stat.宫殿.警戒 ?? 0) + r.echoGain);
    changed = true;
    notes.push(`检定 ${r.type}：1d100=${r.roll}／线 ${r.line} → ${r.result}`);
    return renderCheck(r);
  });

  // ---- affinity ----
  text = text.replace(TAG.affinity, (tag) => {
    const a = attrs(tag);
    const name = (a.name || '').trim();
    if (!name) return '';
    const rel = stat.关系[name] ??= { Rank: 1, 社群点: 0 };
    const res = settleAffinity(
      { rank: rel.Rank ?? 1, points: rel.社群点 ?? 0 },
      { kind: a.kind, delta: Number(a.delta) || 0 },
      { axisTier: axisTier(stat, name), axis: AXIS_OF.get(name), axes: allAxes(stat) },
    );
    rel.Rank = res.rank; rel.社群点 = res.points; rel.已建立 = true;
    changed = true;
    notes.push(`${name} ${res.receipt}`);
    return '';
  });

  // ---- event（只记录，不改 Rank）----
  text = text.replace(TAG.event, (tag) => {
    const a = attrs(tag);
    if (!a.kind || !a.name) return tag;
    if (a.kind === '主线节点') {
      stat.事件线索.主线节点进度[a.name] = C.EVENT_STATE.includes(a.state) ? a.state : '进行中';
      stat.事件线索.当前事件 = a.name;
    } else if (a.kind === '支线') {
      const arr = stat.事件线索.进行中支线;
      if (!arr.includes(a.name)) arr.push(a.name);
    }
    changed = true;
    return tag; // 保留标签给正文渲染
  });

  // ---- 剥离模型自写的 check ----
  if (TAG.check.test(text)) { text = text.replace(TAG.check, ''); notes.push('已剥离模型自写的 <check>'); }

  if (changed) {
    await writeStat(mid, stat);
    if (text !== raw) await writeText(mid, text);
  }
  if (notes.length) toast(notes.join('\n'));
}

/** 安装：绑定事件、幂等 */
async function install() {
  if (globalThis.__HP_REVERB_INSTALLED__) { console.log(LOG, '已安装，跳过'); return; }
  globalThis.__HP_REVERB_INSTALLED__ = true;

  const on = api('eventOn');
  const EV = globalThis.tavern_events ?? {};
  const disposers = [];

  if (on && EV.MESSAGE_RECEIVED) {
    disposers.push(on(EV.MESSAGE_RECEIVED, (mid) => { void handleMessage(mid); }));
    console.log(LOG, '已绑定 MESSAGE_RECEIVED');
  } else {
    toast('酒馆助手事件不可用，脚本不会自动结算', true);
  }

  globalThis.__HP_REVERB_DISPOSE__ = () => {
    while (disposers.length) { try { disposers.pop()?.stop?.(); } catch {} }
    globalThis.__HP_REVERB_INSTALLED__ = false;
  };
  console.log(LOG, '已就绪');
  return { ok: true };
}
