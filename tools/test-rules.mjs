// tools/test-rules.mjs —— 无依赖单测：node tools/test-rules.mjs
import assert from 'node:assert/strict';
import { settleAffinity, clampDelta, gateOk, rank10Ok } from '../src/rules/affinity.mjs';
import { computeLine, judge, settle, resolve, renderCheck, CHECK_TYPES } from '../src/rules/roll.mjs';
import { spend, addExp, weekTick, examScore, examGrade, COST } from '../src/rules/schedule.mjs';
import { defaultStat, sanitizePatch, isAllowedPath, normalizeStat } from '../src/schema.mjs';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; console.log('  ✗', name, '—', e.message); } };

console.log('\n[affinity]');
t('单次幅度按 kind 夹取（帮助 8）', () => assert.equal(clampDelta('帮助', 20), 8));
t('单次幅度不超过 10（任务）', () => assert.equal(clampDelta('任务', 99), 10));
t('对话只 +2', () => assert.equal(clampDelta('对话', 8), 2));
t('周内第二次 ×0.5', () => {
  const r = settleAffinity({ rank: 1, points: 0 }, { kind: '帮助', delta: 8 }, { weeklySame: 1 });
  assert.equal(r.delta, 4);
});
t('门槛不足时 Rank 不动', () => {
  const r = settleAffinity({ rank: 2, points: 18 }, { kind: '共患难', delta: 10 }, { axisTier: 2, axis: '共情' });
  assert.equal(r.rank, 2); assert.ok(r.blocked);
});
t('门槛足够时升级', () => {
  const r = settleAffinity({ rank: 2, points: 18 }, { kind: '共患难', delta: 10 }, { axisTier: 3, axis: '共情' });
  assert.equal(r.rank, 3); assert.equal(r.blocked, null);
});
t('Rank 10 需三维≥4', () => {
  assert.equal(rank10Ok([4, 4, 4, 2, 2]), true);
  assert.equal(rank10Ok([5, 3, 3, 3, 3]), false);
  const r = settleAffinity({ rank: 9, points: 95 }, { kind: '任务', delta: 10 }, { axisTier: 5, axes: [5, 3, 3, 3, 3] });
  assert.equal(r.rank, 9); assert.ok(r.blocked);
});

console.log('\n[roll]');
t('判定线基准 50（无修正）', () => {
  const { line } = computeLine({ studyTier: 0, axisTier: 2 });
  assert.equal(line, 50);
});
t('判定线含敌人与回声', () => {
  const { line } = computeLine({ studyTier: 3, spellSkill: 10, companions: 2, relics: 4, axisTier: 4, foe: '精英', echo: 62 });
  assert.equal(line, 50 + 6 + 5 + 6 + 4 + 4 - 5 - 5); // 65
});
t('低掷成功 / 部分成功 / 失败', () => {
  assert.equal(judge(10, 60).result, '成功');
  assert.equal(judge(70, 60).result, '部分成功');
  assert.equal(judge(80, 60).result, '失败');
  assert.equal(judge(98, 60).result, '极值失败');
  assert.equal(judge(3, 60).result, '极值成功');
});
t('结算带难度系数', () => {
  const d = settle('决斗', '失败', 1.4, false);
  assert.equal(d.体力, -21); assert.equal(d.伤势, 14);
});
t('resolve 输出可渲染 <check>', () => {
  const r = resolve({ type: '咒语命中', dc: '普通', foe: '普通' }, { studyTier: 3, spellSkill: 8, axisTier: 3 }, () => 41);
  assert.equal(r.result, '成功');
  assert.ok(renderCheck(r).startsWith('<check'));
});
t('十类检定齐全', () => assert.equal(Object.keys(CHECK_TYPES).length, 10));

console.log('\n[schedule]');
t('四点用完就不给做', () => {
  const s = defaultStat();
  s.日程.本周已用 = 4;
  assert.equal(spend(s, '陪人').ok, false);
});
t('潜入占 2 点', () => {
  const s = defaultStat();
  const r = spend(s, '潜入');
  assert.equal(r.cost, 2); assert.equal(s.日程.本周已用, 2);
});
t('经验满 6 升阶', () => {
  const s = defaultStat();
  const r = addExp(s, '学业', 6);
  assert.equal(r.stage, 3); assert.equal(r.exp, 0);
});
t('每学年单维 ≤12 经验', () => {
  const s = defaultStat();
  addExp(s, '胆识', 12);
  const r = addExp(s, '胆识', 5);
  assert.equal(r.ok, false);
});
t('周结算推进日期', () => {
  const s = defaultStat();
  const r = weekTick(s);
  assert.equal(r.week, 2); assert.equal(r.date, '1991年09月08日');
});
t('考试分与档位', () => {
  const s = defaultStat();
  assert.equal(examScore(s, { selfStudy: 6, review: 2, midBonus: 3 }), 23);
  assert.equal(examGrade(30), 'O'); assert.equal(examGrade(9), 'D');
});

console.log('\n[schema]');
t('白名单放行合法路径', () => {
  assert.ok(isAllowedPath('/关系/罗娜·韦斯莱/Rank'));
  assert.ok(isAllowedPath('/宫殿/灯火'));
});
t('白名单拦截幽灵键', () => {
  const { patch, dropped } = sanitizePatch([
    { op: 'replace', path: '/关系/德拉科娅·马尔福·rank 3/社群等级', value: 3 },
    { op: 'replace', path: '/关系/罗娜·韦斯莱/Rank', value: 4 },
  ]);
  assert.equal(patch.length, 1); assert.equal(dropped.length, 1);
});
t('脏输入被夹回范围', () => {
  const s = defaultStat();
  s.主角.体力 = 999; s.主角.声望 = 99;
  const n = normalizeStat(s);
  assert.equal(n.主角.体力, 100);
});

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
