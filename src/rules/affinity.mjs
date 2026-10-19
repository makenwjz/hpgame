// src/rules/affinity.mjs —— 社群结算纯函数（不碰 DOM / MVU）
// 口径：02-社群与网、08-社群口径

export const KIND_CAP = { 对话: 2, 帮助: 8, 送礼: 8, 共患难: 10, 检定: 5, 任务: 10 };
export const KIND_MIN = { 送礼: -3 };
export const SINGLE_CAP = 10;
export const RANK_GATES = { 3: 3, 6: 4, 9: 5 };
export const RANK10_MIN_AXES = 3;
export const RANK10_MIN_TIER = 4;

export function clampAff(v, a, b) { return Math.min(Math.max(v, a), b); }

/** 单次增减幅度：按 kind 夹取，再夹 ±10 */
export function clampDelta(kind, delta) {
  const cap = Math.min(KIND_CAP[kind] ?? 5, SINGLE_CAP);
  const d = Number.isFinite(Number(delta)) ? Number(delta) : cap;
  return clampAff(d, -cap, cap);
}

/** 周内第二次 ×0.5；同 kind 连刷三次起 ×0.7 */
export function decay(delta, { weeklySame = 0, sameKindStreak = 0 } = {}) {
  let d = delta;
  if (weeklySame >= 1) d *= 0.5;
  if (sameKindStreak >= 2) d *= 0.7;
  return Math.round(d);
}

/** 门槛：她最看重的一维达到 3/4/5 阶 */
export function gateOk(rank, axisTier) {
  const need = RANK_GATES[rank];
  if (!need) return true;
  return Number(axisTier) >= need;
}

/** Rank 10 额外条件：任意三维 ≥4 阶 */
export function rank10Ok(axes = []) {
  return axes.filter(t => Number(t) >= RANK10_MIN_TIER).length >= RANK10_MIN_AXES;
}

/**
 * 结算一次好感。
 * @param {{rank:number, points:number}} rel
 * @param {{kind:string, delta:number}} req
 * @param {{axisTier:number, axes:number[], weeklySame?:number, sameKindStreak?:number}} ctx
 */
export function settleAffinity(rel, req, ctx = {}) {
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
export function betrayalPenalty() { return -15; }
