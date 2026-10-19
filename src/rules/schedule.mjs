// src/rules/schedule.mjs —— 日程 / 周结算 / 五维经验 / 考试（纯函数）
export const POINTS_PER_WEEK = 4;
export const COST = { 陪人: 1, 自习: 1, 打工: 1, 采买: 1, 短行动: 0, 休息: 1, 潜入: 2 };
export const STAGE_STEP = 6;         // 每阶 6 经验
export const STAGE_MAX = 5;
export const STAGE_PER_YEAR = 2;     // 每学年每维最多 2 阶

const clampSched = (v, a, b) => Math.min(Math.max(v, a), b);

export function canDo(used, doWhat) {
  const cost = COST[doWhat] ?? 1;
  if (used + cost > POINTS_PER_WEEK) return { ok: false, cost, reason: '这周的安排满了' };
  return { ok: true, cost };
}

export function spend(stat, doWhat) {
  const r = canDo(stat.日程?.本周已用 ?? 0, doWhat);
  if (!r.ok) return r;
  stat.日程.本周已用 += r.cost;
  return r;
}

/** 五维加经验，返回是否升阶 */
export function addExp(stat, axis, n = 1) {
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
export function weekTick(stat) {
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
export function examScore(stat, { selfStudy = 0, review = 0, midBonus = 0 } = {}) {
  const study = stat.五维?.学业?.阶 ?? 2;
  return study * 4 + Math.min(selfStudy, 6) + review * 3 + midBonus;
}

export function examGrade(score) {
  if (score >= 30) return 'O';
  if (score >= 24) return 'E';
  if (score >= 16) return 'A';
  if (score >= 10) return 'P';
  return 'D';
}

/** 学年切换：清子上限 */
export function yearTick(stat) {
  stat.时空.学年 = clampSched((stat.时空.学年 ?? 1) + 1, 1, 7);
  stat.时空.周 = 1;
  for (const k of Object.keys(stat.五维)) if (stat.五维[k]) stat.五维[k].本年已得 = 0;
  return stat.时空.学年;
}

// ---------------- 学院分（学院杯积分） ----------------
export const HOUSE_POINT_MIN = -200;
export const HOUSE_POINT_MAX = 500;

/** 学院分增减（带夹取）。来源见《五维与门槛》条目。 */
export const HOUSE_POINT_RULES = {
  课堂表现: 1, 作业O: 3, 作业E: 2, 公开比赛胜: 5, 主线节点完成: 5, 受表彰: 5, 帮教师做事: 2,
  迟到: -1, 缺课: -2, 夜游被抓: -5, 当众出丑: -3, 记过: -10, 期限逾期: -5, 违反校规: -3,
};

export function addHousePoints(stat, reason, times = 1) {
  const unit = HOUSE_POINT_RULES[reason];
  if (unit === undefined) return { ok: false, reason: `未知学院分来源「${reason}」` };
  const delta = unit * Math.max(1, Number(times) || 1);
  const before = stat.主角.学院分 ?? 0;
  const after = clampSched(before + delta, HOUSE_POINT_MIN, HOUSE_POINT_MAX);
  stat.主角.学院分 = after;
  return { ok: true, delta: after - before, before, after, reason };
}

/**
 * 学年末学院分 → 魅力经验折算。
 * 口径来自 `01-时间日程五维考试` §3.4（原文按「声望阶」给经验，这里换算成学院分档）。
 * 返回应加的魅力学年经验（0 / 1 / 2）。
 */
export function housePointsToCharmExp(points) {
  const p = Number(points) || 0;
  if (p >= 200) return 2;
  if (p >= 80) return 1;
  return 0;
}
