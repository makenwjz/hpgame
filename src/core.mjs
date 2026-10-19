// src/core.mjs —— 运行时核心（由卡片里的 loader 从 GitHub 动态加载）
// 职责：解析正文里的请求标签 → 调用纯函数规则 → 写回变量与正文 → 弹回执。
// 边界：不写叙事；所有数值只在这里落地。
// 注意：Tavern Helper / MVU 的具体 API 以目标运行时为准，本文件全部做了能力探测。

import { normalizeStat, sanitizePatch, defaultStat } from './schema.mjs';
import { settleAffinity } from './rules/affinity.mjs';
import { resolve, renderCheck } from './rules/roll.mjs';
import { spend, addExp, weekTick, examScore, examGrade } from './rules/schedule.mjs';
import * as C from './contract.mjs';

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
export function registerAxis(name, axis) { AXIS_OF.set(name, axis); }

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
