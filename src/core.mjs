// src/core.mjs —— 运行时核心（由卡片里的 loader 从 GitHub 动态加载）
// 职责：解析正文里的请求标签 → 调用纯函数规则 → 写回变量与正文 → 弹回执。
// 边界：不写叙事；所有数值只在这里落地。
// 注意：Tavern Helper / MVU 的具体 API 以目标运行时为准，本文件全部做了能力探测。
//
// 设计要点：结算逻辑全部收在 settleText() 里（纯函数，不碰 DOM/MVU），
// handleMessage() 只负责「读 → 调 settleText → 写」。这样单测可以直接测结算。

import { normalizeStat, sanitizePatch, defaultStat, isLegalPersonKey } from './schema.mjs';
import { settleAffinity } from './rules/affinity.mjs';
import { resolve, renderCheck } from './rules/roll.mjs';
import { spend, addExp, weekTick, examScore, examGrade, addHousePoints } from './rules/schedule.mjs';
import * as C from './contract.mjs';

const LOG = '[HP-Reverb]';
const TAG = {
  act: /<act\b([^>]*?)\/?>/gi,
  roll: /<roll\b[^>]*?(?:\/>|>\s*<\/roll\s*>)/gi,
  affinity: /<affinity\b[^>]*?(?:\/>|>\s*<\/affinity\s*>)/gi,
  event: /<event\b[^>]*?(?:\/>|>\s*<\/event\s*>)/gi,
  ability: /<ability\b([^>]*)>([\s\S]*?)<\/ability\s*>/gi,
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
export function registerAxis(name, axis) { AXIS_OF.set(name, axis); }

function axisTier(stat, name) {
  const axis = AXIS_OF.get(name) ?? '共情';
  return stat.五维?.[axis]?.阶 ?? 2;
}

function allAxes(stat) {
  return Object.values(stat.五维 ?? {}).map(v => v?.阶 ?? 2);
}

/** 打工收入（固定值，可测） */
const WORK_PAY = { 加隆: 3, 西可: 8 };

/**
 * 纯结算：把一段正文里的请求全部解算到 stat 上。
 * 不碰 DOM / MVU / 网络，因此可以直接单测。
 *
 * @param {string} raw 原始正文
 * @param {object} stat 变量对象（会被就地修改）
 * @param {{rng?:()=>number, weeklySame?:Map<string,number>}} opts
 * @returns {{text:string, notes:string[], changed:boolean}}
 */
export function settleText(raw, stat, opts = {}) {
  const rng = opts.rng;
  const notes = [];
  let changed = false;
  let text = String(raw ?? '');

  // ---- 0. 先剥模型自写的 <check> ----
  // 必须最先做：roll 分支会在后面插入合法的 <check>，
  // 若放在最后就会把脚本自己产出的 check 一并删掉（v0.1.0 的真实 bug）。
  // 用 replace 而不是 test()：带 /g 的正则复用 .test() 会残留 lastIndex，导致漏判。
  const stripped = text.replace(TAG.check, '');
  if (stripped !== text) {
    notes.push('已剥离模型自写的 <check>');
    text = stripped;
  }

  // ---- 1. act ----
  text = text.replace(TAG.act, (tag) => {
    const a = attrs(tag);
    if (!C.ACT_DO.includes(a.do)) { notes.push(`未知行动「${a.do}」，按休息处理`); a.do = '休息'; }
    const r = spend(stat, a.do);
    if (!r.ok) { notes.push(r.reason); return ''; }

    if (a.do === '潜入') {
      stat.宫殿.在宫殿 = true;
      stat.主角.体力 = Math.max(0, (stat.主角.体力 ?? 0) - 10);
    }
    if (a.do === '休息') {
      stat.主角.体力 = Math.min(100, (stat.主角.体力 ?? 0) + 25);
      stat.主角.魔力 = Math.min(100, (stat.主角.魔力 ?? 0) + 25);
      stat.主角.伤势 = Math.max(0, (stat.主角.伤势 ?? 0) - 10);
    }
    if (a.do === '自习') {
      // axis 缺省按学业；这样 <act do="自习"/> 也有产出，不会白扣一点。
      const axis = C.AXES.includes(a.axis) ? a.axis : '学业';
      const e = addExp(stat, axis, 1);
      if (e.ok) notes.push(`${axis} +${e.gain} 经验${e.up ? `（升到 ${e.stage} 阶）` : `（${e.exp}/6）`}`);
      else notes.push(`${axis}：${e.reason ?? '未加经验'}`);
    }
    if (a.do === '打工') {
      stat.物品与金钱.钱.加隆 += WORK_PAY.加隆;
      stat.物品与金钱.钱.西可 += WORK_PAY.西可;
      notes.push(`打工收入 ${WORK_PAY.加隆} 加隆 ${WORK_PAY.西可} 西可`);
    }
    changed = true;
    notes.push(`${a.do} −${r.cost} 点（${stat.日程.本周已用}/${stat.日程.行动点上限}）`);
    return '';
  });

  // ---- 2. roll ----
  text = text.replace(TAG.roll, (tag) => {
    const a = attrs(tag);
    const r = resolve(a, {
      studyTier: stat.五维?.学业?.阶 ?? 2,
      spellSkill: stat.能力?.咒语掌握?.[a.spell] ?? 0,
      // 队伍是 record（object），不是数组——旧代码用 Array.isArray 判断，恒为 false。
      companions: Math.max(0, Object.keys(stat.队伍 ?? {}).length),
      relics: stat.宫殿?.本局战利品?.length ?? 0,
      axisTier: stat.五维?.[a.axis]?.阶 ?? 2,
      echo: stat.宫殿?.警戒 ?? 0,
      injury: stat.主角?.伤势 ?? 0,
    }, rng);

    for (const [k, v] of Object.entries(r.deltas)) {
      if (k === '社群') continue;
      if (k === '学院分') {
        // 学院分有独立口径（−200~500），不能套 0~100 的夹取
        const before = stat.主角.学院分 ?? 0;
        stat.主角.学院分 = Math.min(500, Math.max(-200, before + v));
        continue;
      }
      if (['体力', '魔力', '伤势'].includes(k)) {
        stat.主角[k] = clamp(stat.主角[k] ?? 0, v, 0, 100);
      }
    }
    stat.宫殿.警戒 = Math.min(100, (stat.宫殿.警戒 ?? 0) + r.echoGain);
    changed = true;
    notes.push(`检定 ${r.type}：1d100=${r.roll}／线 ${r.line} → ${r.result}`);
    return renderCheck(r);
  });

  // ---- 3. affinity ----
  const weeklySame = opts.weeklySame instanceof Map ? opts.weeklySame : new Map();
  text = text.replace(TAG.affinity, (tag) => {
    const a = attrs(tag);
    const name = (a.name || '').trim();
    if (!name) return '';
    // 键必须是规范名，否则直接丢弃（否则会把幽灵键写进 /关系）
    if (!isLegalPersonKey(name)) { notes.push(`关系键不合法，已忽略：「${name}」`); return ''; }

    const rel = stat.关系[name] ??= { Rank: 1, 社群点: 0 };
    const res = settleAffinity(
      { rank: rel.Rank ?? 1, points: rel.社群点 ?? 0 },
      { kind: a.kind, delta: Number(a.delta) || 0 },
      {
        axisTier: axisTier(stat, name),
        axis: AXIS_OF.get(name),
        axes: allAxes(stat),
        // 周内第二次 ×0.5：之前运行时从不传这两个参数，衰减规则只活在单测里
        weeklySame: weeklySame.get(name) ?? 0,
        sameKindStreak: weeklySame.get(`${name}|${a.kind}`) ?? 0,
      },
    );
    weeklySame.set(name, (weeklySame.get(name) ?? 0) + 1);
    weeklySame.set(`${name}|${a.kind}`, (weeklySame.get(`${name}|${a.kind}`) ?? 0) + 1);

    rel.Rank = res.rank; rel.社群点 = res.points; rel.已建立 = true;
    changed = true;
    notes.push(`${name} ${res.receipt}`);
    return '';
  });

  // ---- 4. event（只记录，不改 Rank；主线节点完成给学院分）----
  text = text.replace(TAG.event, (tag) => {
    const a = attrs(tag);
    if (!a.kind || !a.name) return tag;
    if (a.kind === '主线节点') {
      const prev = stat.事件线索.主线节点进度[a.name];
      const next = C.EVENT_STATE.includes(a.state) ? a.state : '进行中';
      stat.事件线索.主线节点进度[a.name] = next;
      stat.事件线索.当前事件 = a.name;
      // 首次转为「已完成」时给学院分，避免重复结算
      if (next === '已完成' && prev !== '已完成') {
        const hp = addHousePoints(stat, '主线节点完成');
        if (hp.ok) notes.push(`学院分 ${hp.delta >= 0 ? '+' : ''}${hp.delta}（主线节点完成）→ ${hp.after}`);
      }
      changed = true;
    } else if (a.kind === '支线') {
      const arr = stat.事件线索.进行中支线;
      if (!arr.includes(a.name)) { arr.push(a.name); changed = true; }
    }
    return tag; // 保留标签给正文渲染
  });

  // ---- 5. ability（契约里有，之前运行时完全不处理）----
  text = text.replace(TAG.ability, (tag, attrStr, inner) => {
    const a = attrs(attrStr);
    const m = String(a.name || '').match(/^(.+?)\s+(\d+)\s*→\s*(\d+)$/);
    if (m) {
      const [, spell, , to] = m;
      const next = Math.max(0, Math.min(20, Number(to)));
      const book = stat.能力.咒语掌握;
      if (book[spell] !== next) { book[spell] = next; changed = true; }
    }
    return tag; // 保留标签给正文渲染
  });

  // ---- 6. 行动点用满 → 周结算 ----
  // 之前 weekTick 从未被调用，导致一周永远结束不了（第 4 点之后永久「这周的安排满了」）。
  const cap = stat.日程.行动点上限 ?? 4;
  if ((stat.日程.本周已用 ?? 0) >= cap) {
    const r = weekTick(stat);
    changed = true;
    notes.push(`周结算：进入第 ${r.week} 周（${r.date}）`);
  }

  return { text, notes, changed };
}

function clamp(cur, delta, lo, hi) {
  return Math.min(hi, Math.max(lo, (cur ?? 0) + delta));
}

/** 处理一条消息里的全部请求 */
async function handleMessage(mid) {
  const raw = await readText(mid);
  if (!raw) return;
  const stat = (await readStat(mid)) ?? defaultStat();

  const { text, notes, changed } = settleText(raw, stat);

  if (changed) {
    await writeStat(mid, stat);
    if (text !== raw) await writeText(mid, text);
  }
  if (notes.length) toast(notes.join('\n'));
}

/** 安装：绑定事件、幂等 */
export async function install() {
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

export { handleMessage, settleAffinity, resolve, weekTick, examScore, examGrade, sanitizePatch };
