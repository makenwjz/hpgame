// src/contract.mjs
// 全卡唯一契约源：脚本常量、提示词条目都由这里生成。
// 任何枚举只在这里改一次——v10.1 就是因为「13 类检定分三处写」而烂掉的。

export const ACT_DO = ['陪人', '自习', '打工', '采买', '短行动', '休息', '潜入'];
export const SLOT = ['周三', '周五', '周六', '周日'];
export const ROLL_TYPE = [
  '咒语命中', '魔药成败', '决斗', '疑点调查', '说服',
  '潜行', '照料生灵', '变形操作', '炼金配比', '飞行机动',
];
export const DC = ['简单', '普通', '困难', '极难'];
export const FOE = ['普通', '精英', '首领', '灾厄'];
export const ROLL_ACTION = ['撤退', '投降'];
export const AFFINITY_KIND = ['对话', '帮助', '送礼', '共患难', '检定', '任务'];
export const AFFINITY_LINE = ['未开始', '进行中', '已完成', '失败'];
export const EVENT_KIND = ['主线节点', '支线', '社群'];
export const EVENT_STATE = ['未触发', '进行中', '已完成', '已改写'];
export const TIER = ['T1', 'T2', 'T3', '敌对'];

/** 请求语法（供《请求契约》条目直接引用） */
export const GRAMMAR = {
  act: '<act do="陪人" target="罗娜·韦斯莱" slot="周三"/>',
  roll: '<roll type="咒语命中" dc="普通" attr="魔力" spell="火焰熊熊" axis="胆识" foe="普通" action="撤退" retry="false"/>',
  affinity: '<affinity name="罗娜·韦斯莱" kind="帮助" delta="+8" reason="替她挡了扣分"/>',
  event: '<event kind="主线节点" name="入学与分院" state="已完成" date="1991年09月01日"/>',
  ability: '<ability kind="咒语" name="荧光闪烁 0→2" cost="魔力 3">杖尖稳住了一点。</ability>',
};

/** 生成《请求契约》条目正文 */
export function renderContract() {
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
