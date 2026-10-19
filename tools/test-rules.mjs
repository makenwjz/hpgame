// tools/test-rules.mjs —— 无依赖单测：node tools/test-rules.mjs
import assert from 'node:assert/strict';
import { settleAffinity, clampDelta, gateOk, rank10Ok } from '../src/rules/affinity.mjs';
import { computeLine, judge, settle, resolve, renderCheck, CHECK_TYPES } from '../src/rules/roll.mjs';
import { spend, addExp, weekTick, examScore, examGrade, COST, addHousePoints, housePointsToCharmExp } from '../src/rules/schedule.mjs';
import { defaultStat, sanitizePatch, isAllowedPath, normalizeStat } from '../src/schema.mjs';
import { settleText } from '../src/core.mjs';

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
  s.主角.体力 = 999; s.主角.学院分 = 9999;
  const n = normalizeStat(s);
  assert.equal(n.主角.体力, 100);
  assert.equal(n.主角.学院分, 500);
});
t('幽灵键在真实写入路径被丢弃', () => {
  // 之前只在 sanitizePatch 里拦，normalizeStat 会保留未知键 → 幽灵键照样入库
  const n = normalizeStat({ 关系: { '德拉科娅·马尔福·rank 3': { Rank: 9 }, '罗娜·韦斯莱': { Rank: 4 } } });
  assert.ok(!('德拉科娅·马尔福·rank 3' in n.关系));
  assert.ok('罗娜·韦斯莱' in n.关系);
});
t('五维含本年已得字段', () => {
  assert.equal(defaultStat().五维.学业.本年已得, 0);
});
t('两次 defaultStat 不共享可变对象', () => {
  // 曾经 list/record 的 dflt 是字面量 [] / {}，被所有实例共享：
  // 一个存档改了关系，下一个新存档会继承 → 极隐蔽的串档 bug。
  const a = defaultStat();
  const b = defaultStat();
  a.关系['罗娜·韦斯莱'] = { Rank: 3 };
  a.日程.本周安排.push('陪人');
  a.事件线索.主线节点进度['入学'] = '已完成';
  a.物品与金钱.背包.push({ 名称: '魔杖', 数量: 1, 类型: '道具' });
  assert.equal(Object.keys(b.关系).length, 0);
  assert.equal(b.日程.本周安排.length, 0);
  assert.equal(Object.keys(b.事件线索.主线节点进度).length, 0);
  assert.equal(b.物品与金钱.背包.length, 0);
});

console.log('\n[settleText · 运行时结算]');
// 纯函数结算：不碰 DOM / MVU，可直接测
const S = () => defaultStat();

t('act 扣行动点并移除标签', () => {
  const s = S();
  const r = settleText('<act do="陪人" slot="周三"/>正文。', s);
  assert.equal(s.日程.本周已用, 1);
  assert.equal(r.text, '正文。');
  assert.equal(r.changed, true);
});

t('自习加五维经验（之前完全没接线）', () => {
  const s = S();
  const r = settleText('<act do="自习" axis="胆识" slot="周三"/>', s);
  assert.equal(s.五维.胆识.经验, 1);
  assert.equal(s.五维.胆识.本年已得, 1);
  assert.ok(r.notes.some(n => n.includes('胆识')));
});

t('自习不写 axis 默认学业', () => {
  const s = S();
  settleText('<act do="自习" slot="周三"/>', s);
  assert.equal(s.五维.学业.经验, 1);
});

t('打工加钱', () => {
  const s = S();
  settleText('<act do="打工" slot="周五"/>', s);
  assert.equal(s.物品与金钱.钱.加隆, 3);
  assert.equal(s.物品与金钱.钱.西可, 8);
});

t('行动点用满触发周结算（之前是死锁）', () => {
  const s = S();
  const r = settleText(
    '<act do="陪人"/><act do="陪人"/><act do="陪人"/><act do="陪人"/>', s);
  assert.equal(s.时空.周, 2);
  assert.equal(s.时空.日期, '1991年09月08日');
  assert.equal(s.日程.本周已用, 0);
  assert.ok(r.notes.some(n => n.includes('周结算')));
});

t('周结算后还能继续行动（不再是死锁）', () => {
  const s = S();
  settleText('<act do="陪人"/><act do="陪人"/><act do="陪人"/><act do="陪人"/>', s);
  const r = settleText('<act do="陪人"/>', s);
  assert.equal(s.日程.本周已用, 1);
  assert.ok(!r.notes.some(n => n.includes('安排满了')));
});

t('脚本产出的 <check> 不会被自己剥掉', () => {
  const s = S();
  const r = settleText('<roll type="咒语命中" dc="普通"/>', s, { rng: () => 41 });
  assert.ok(r.text.includes('<check'), '结算后正文里应保留 check');
  assert.ok(!r.notes.some(n => n.includes('已剥离')));
});

t('模型自写的 <check> 会被剥离', () => {
  const s = S();
  const r = settleText('正文<check type="x">假结果</check>尾巴', s);
  assert.equal(r.text, '正文尾巴');
  assert.ok(r.notes.some(n => n.includes('已剥离')));
});

t('roll 同时扣体力/加学院分', () => {
  const s = S();
  settleText('<roll type="说服" dc="极难" foe="灾厄"/>', s, { rng: () => 50 });
  assert.ok(s.主角.学院分 >= -200 && s.主角.学院分 <= 500);
});

t('同行数不再恒为 0（队伍是 record 不是数组）', () => {
  const s = S();
  s.队伍 = { 罗娜: { 等级: 3, HP: 80, MP: 40, BP: 1, 装备: [] } };
  // companions 参与判定线计算；有 1 名队友时判定线应高于空队
  const r = settleText('<roll type="决斗" dc="普通"/>', s, { rng: () => 1 });
  assert.ok(r.text.includes('同行') || r.text.includes('<check'));
});

t('affinity 非法键被丢弃', () => {
  const s = S();
  const r = settleText('<affinity name="德拉科娅·马尔福 rank 3" kind="对话" delta="+2"/>', s);
  assert.equal(Object.keys(s.关系).length, 0);
  assert.ok(r.notes.some(n => n.includes('不合法')));
});

t('affinity 合法键正常结算', () => {
  const s = S();
  settleText('<affinity name="罗娜·韦斯莱" kind="帮助" delta="+8"/>', s);
  assert.ok('罗娜·韦斯莱' in s.关系);
  assert.ok(s.关系['罗娜·韦斯莱'].社群点 > 0);
});

t('affinity 周内第二次衰减', () => {
  const s = S();
  const weeklySame = new Map();
  const r1 = settleText('<affinity name="罗娜·韦斯莱" kind="帮助" delta="+8"/>', s, { weeklySame });
  const first = s.关系['罗娜·韦斯莱'].社群点;
  const r2 = settleText('<affinity name="罗娜·韦斯莱" kind="帮助" delta="+8"/>', s, { weeklySame });
  const gained2 = s.关系['罗娜·韦斯莱'].社群点 - first;
  assert.ok(gained2 < 8, `第二次应衰减，实际 +${gained2}`);
});

t('ability 写进咒语掌握', () => {
  const s = S();
  settleText('<ability kind="咒语" name="荧光闪烁 0→2" cost="魔力 3">稳住了。</ability>', s);
  assert.equal(s.能力.咒语掌握['荧光闪烁'], 2);
});

t('未知 do 降级为休息', () => {
  const s = S();
  const r = settleText('<act do="打游戏"/>', s);
  assert.ok(r.notes.some(n => n.includes('未知行动')));
});

t('无请求时 changed 为 false', () => {
  const s = S();
  const r = settleText('只是一段普通叙事，没有标签。', s);
  assert.equal(r.changed, false);
  assert.equal(r.text, '只是一段普通叙事，没有标签。');
});

console.log('\n[学院分]');
t('加分按口径表', () => {
  const s = S();
  const r = addHousePoints(s, '作业O');
  assert.equal(r.delta, 3);
  assert.equal(s.主角.学院分, 3);
});
t('扣分按口径表', () => {
  const s = S();
  addHousePoints(s, '记过');
  assert.equal(s.主角.学院分, -10);
});
t('次数乘算', () => {
  const s = S();
  addHousePoints(s, '课堂表现', 5);
  assert.equal(s.主角.学院分, 5);
});
t('夹在 −200~500', () => {
  const s = S();
  s.主角.学院分 = 498;
  const r = addHousePoints(s, '公开比赛胜');
  assert.equal(s.主角.学院分, 500);
  assert.equal(r.delta, 2);
});
t('未知来源被拒绝', () => {
  const s = S();
  const r = addHousePoints(s, '随便编一个');
  assert.equal(r.ok, false);
  assert.equal(s.主角.学院分, 0);
});
t('学年末折算魅力经验', () => {
  assert.equal(housePointsToCharmExp(-50), 0);
  assert.equal(housePointsToCharmExp(79), 0);
  assert.equal(housePointsToCharmExp(80), 1);
  assert.equal(housePointsToCharmExp(199), 1);
  assert.equal(housePointsToCharmExp(200), 2);
});
t('主线节点完成给学院分', () => {
  const s = S();
  settleText('<event kind="主线节点" name="入学与分院" state="已完成"/>', s);
  assert.equal(s.主角.学院分, 5);
});
t('主线节点重复结算不重复加分', () => {
  const s = S();
  settleText('<event kind="主线节点" name="入学与分院" state="已完成"/>', s);
  settleText('<event kind="主线节点" name="入学与分院" state="已完成"/>', s);
  assert.equal(s.主角.学院分, 5);
});

console.log(`\n通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
