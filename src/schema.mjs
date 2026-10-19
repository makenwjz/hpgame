// src/schema.mjs
// 15 容器 schema：无依赖的迷你实现（可被 ZOD 适配层包一层）。
// 每个字段：默认值 → 夹取范围 → 枚举回退。脏输入不崩，只被夹回去。

const clampNum = (v, min, max, dflt) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(Math.max(n, min), max);
};

export const num = (dflt, min, max) => ({
  kind: 'num', dflt, min, max,
  norm: v => clampNum(v, min, max, dflt),
});
export const numOpen = (dflt, min) => ({
  kind: 'num', dflt, min, max: Infinity,
  norm: v => { const n = Number(v); return Number.isFinite(n) ? Math.max(n, min) : dflt; },
});
export const text = (dflt = '') => ({
  kind: 'text', dflt,
  norm: v => (v == null ? dflt : String(v).trim() === '' ? dflt : String(v)),
});
export const pick = (values, dflt) => ({
  kind: 'enum', dflt, values,
  norm: v => (values.includes(v) ? v : dflt),
});
export const flag = (dflt = false) => ({
  kind: 'bool', dflt,
  norm: v => (typeof v === 'string' ? /^(true|1|是|有|开|yes)$/i.test(v.trim()) : v == null ? dflt : Boolean(v)),
});
export const obj = shape => ({ kind: 'obj', shape, dflt: () => defaults(shape),
  norm: v => normalize(v && typeof v === 'object' && !Array.isArray(v) ? v : {}, shape) });
export const list = (item, limit) => ({
  kind: 'list', dflt: [], limit,
  norm: v => {
    const arr = Array.isArray(v) ? v : [];
    const out = arr.map(x => (item.norm ? item.norm(x) : x));
    return limit ? out.slice(-limit) : out;
  },
});
export const record = (item, limit) => ({
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
export const Schema = {
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

export const ROOT_KEYS = Object.keys(Schema);

export function normalizeStat(input = {}) { return normalize(input, Schema); }
export function defaultStat() { return defaults(Schema); }

// ---------------- 路径白名单 ----------------
export const WHITELIST = ROOT_KEYS.map(k => `/${k}`);

export function isAllowedPath(p) {
  if (typeof p !== 'string' || !p.startsWith('/')) return false;
  if (!WHITELIST.some(w => p === w || p.startsWith(w + '/'))) return false;
  return isLegalKeyedPath(p);
}

// 记录类容器的键必须是「规范名」，不是带空格/中文 rank 的伪键（v10.1 幽灵键的根因）
export function isLegalPersonKey(k) {
  if (!k) return false;
  if (/\\s/.test(k)) return false;
  if (/rank/i.test(k)) return false;
  return k.length <= 12;
}
export function isLegalKeyedPath(p) {
  const seg = p.split('/').filter(Boolean);
  if (seg[0] === '关系' && seg[1]) return isLegalPersonKey(seg[1]);
  if (seg[0] === '网' && seg[1]) return /^[^\\s]+▸[^\\s]+$/.test(seg[1]);
  return true;
}

/** 过滤一段 JSONPatch：丢弃非法路径，返回 {patch, dropped} */
export function sanitizePatch(patch) {
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
export function listPaths(schema = Schema, prefix = '', out = []) {
  for (const [k, s] of Object.entries(schema)) {
    const p = `${prefix}/${k}`;
    if (s.kind === 'obj') listPaths(s.shape, p, out);
    else out.push({ path: p, kind: s.kind, dflt: s.dflt });
  }
  return out;
}
