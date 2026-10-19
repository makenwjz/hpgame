// src/rules/roll.mjs —— 对峙结算纯函数（十类检定 / 1d100 低掷）
// 口径：10-战斗-八方旅人、11-对峙与回声、03-行间对峙回声 §8

export const DIFFICULTY = {
  简单: { line: 65, scale: 0.6 },
  普通: { line: 50, scale: 1.0 },
  困难: { line: 35, scale: 1.4 },
  极难: { line: 20, scale: 1.8 },
};
export const FOE_MOD = { 普通: 0, 精英: 5, 首领: 10, 灾厄: 15 };
export const PARTIAL_WINDOW = 15;

export const CHECK_TYPES = {
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

export const DELTA_CAP = { 体力: 40, 魔力: 40, 伤势: 30, 声望: 15, 社群: 10 };
const clampRoll = (v, a, b) => Math.min(Math.max(v, a), b);

/** 判定线 */
export function computeLine(opts = {}) {
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
export function judge(roll, line) {
  if (roll <= 3) return { result: '极值成功', note: '骰面 ≤3', critical: true };
  if (roll <= line) return { result: '成功', note: '', critical: false };
  if (roll <= line + PARTIAL_WINDOW) return { result: '部分成功', note: '', critical: false };
  if (roll >= 98) return { result: '极值失败', note: '骰面 ≥98', critical: true };
  return { result: '失败', note: '', critical: false };
}

/** 结算：结果 × 难度系数 → 各字段变化 */
export function settle(type, result, scale = 1, critical = false) {
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
export function resolve(req, ctx = {}, rng = () => 1 + Math.floor(Math.random() * 100)) {
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
export function renderCheck(r) {
  const d = Object.entries(r.deltas).map(([k, v]) => `${k}${v >= 0 ? '+' : ''}${v}`).join(' ') || '无消耗';
  const mods = r.parts.filter(([l]) => l !== '基础').map(([l, v]) => `${l}${v >= 0 ? '+' : ''}${v}`).join(' ');
  return `<check type="${r.type}" dc="${r.dc}">${r.result}｜1d100=${r.roll} 判定线 ${r.line}（${mods}）｜${d}</check>`;
}
