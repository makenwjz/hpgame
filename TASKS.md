# 剩余任务清单（可勾选）

> 交接用。每条都有：做什么 / 怎么做 / 验收 / 工期 / 依赖。
> 详细背景见 `HANDOFF.md` 与 `cards/HP-Reverb/设计/`。

---

## A · 让卡可玩（P0）

### A1 · 状态栏六页 ⬜
- **工期**：1 天
- **依赖**：无
- **做法**：
  1. 打开 `src/ui/_ref-status.html`（77KB，原卡渲染器）
  2. 找到 `<script id="cw-sheet" type="application/json">` 里的 JSON
  3. 把 `statusHead.pages` 改成六页：
     - 主角：`/主角/{姓名,性别,学院,年级,血统,出身,魔杖/木材,魔杖/杖芯,声望}` + `bars`(体力/魔力/伤势)
     - 五维：`bars`，五条 `/五维/{学业,胆识,魅力,共情,心志}/阶`
     - 日程：`/日程/本周已用`、`/日程/本周安排`、`/期限/*`
     - 关系：`roster`，`path:/关系`，`gate:/关系/{键}/Rank`，`gateAt:1`
     - 网：`relation`，`path:/网`
     - 宫殿：`stats` + `bars`(灯火/警戒)，`/宫殿/在宫殿` 为 false 时整页隐藏
  4. `summary` 改成：日期/时段/行动点/距涨潮
- **验收**：构造一段假 stat_data，浏览器打开渲染出的 HTML，六页能翻、数值正确
- **不要**：重写渲染器（`CardwrightCore`、`resolve()`、`escape()` 都是好的）

### A2 · 创角页三栏 ⬜
- **工期**：0.5 天
- **依赖**：无
- **做法**：改 `src/ui/_ref-create.html` 的 sheet
  - 删：开局、姓名、性别三步
  - 留：血统出身、魔杖（木材+杖芯）
  - 改：性情倾向 → 五维选三项各 +2 经验
  - 留：旧识（初始关系倾向）
- **验收**：提交后写出正确 `sheet.writes`

### A3 · 正则接线 ⬜
- **工期**：1 天
- **依赖**：A1、A2
- **做法**：
  1. `tools/build-regex.mjs`：读 HTML → 压缩（去注释/空白）→ 转成 `replaceString`
  2. 生成 4 条正则：
     - `01-正文美化`：匹配 `<content>([\s\S]*?)</content>` → 正文 + 状态栏
     - `02-创角页`：匹配 `<start>([\s\S]*?)</start>` → 表单
     - `03-变量隐藏`：匹配 `<UpdateVariable>` 块 → 隐藏注释
     - `04-剥离自写check`：匹配 `<check>` → 空
  3. 写进 `card.json` 的 `data.extensions.regex_scripts`
- **验收**：`npm run card` 后 JSON 里有 4 条正则；正则字段完整（`id/scriptName/findRegex/replaceString/placement/...`）

### A4 · 宫殿前端 MVP ⬜
- **工期**：8 天（能走 3 + 能打 5）
- **依赖**：无
- **做法**：见 `设计/15`（工程）与 `设计/20`（美术/怪物/解密）
  1. `src/palace/engine/`：loop / input / render / tiles / sprites / rng
  2. `src/palace/scenes/explore.js`：24×18 房间、走格移动、碰撞、开箱
  3. `src/palace/scenes/battle.js`：回合制、BP、护盾 Break、行动队列
  4. `src/palace/data/`：8 职业、6 敌人、1 Boss
  5. `tools/build-palace.mjs`：内联成单文件 HTML ≤450KB
- **验收**：浏览器直接打开 `dist/palace.html`，能走完一层、打出一次 Break
- **不要**：前端算数值。战斗调用 `core.mjs` 的 `resolve()`

---

## B · 内容（P1）

### B1 · 22 塔罗人设 ⬜
- **工期**：7 天
- **依赖**：用户给「最想攻略的 3 人」
- **做法**：
  1. 先出骨架表：每人 6 个标题 + 10 行戏眼（1 天）
  2. 逐人扩写 2,000 字（6 天）
  3. `src/data/chars.json` 存数据，`tools/gen-people.mjs` 生成条目
- **验收**：`check-names` 零变体；门槛维与 `设计/08` 表一致

### B2 · 9 座宫殿 + 13 回响房 ⬜
- **工期**：12 天
- **依赖**：A4
- **做法**：
  1. `src/data/palaces.json`：层/房间类型/机关/敌人表/掉落
  2. `tools/gen-palaces.mjs`：叙事 → 世界书条目；关卡 → 前端数据表
  3. 先做斯内普一座全通，再复制
- **验收**：前端能从数据表生成 2 层宫殿并通关

### B3 · 关系网 ⬜
- **工期**：20 天
- **依赖**：B1 骨架
- **做法**：
  1. `src/data/edges.csv`：A,B,类型,强度,可见性,一句话
  2. `tools/check-graph.mjs`：每人 2–4 边、12 群覆盖、任意两点 ≤3 步
  3. 60 条交叉线按「三走向」模板
- **验收**：`check-graph` 全绿

### B4 · T2/T3/敌对 ⬜
- **工期**：20 天
- **依赖**：B1
- **做法**：59 个 T2（900 字/人）、42 个 T3（450 字/人）、11 个敌对（400 字/人）

---

## C · 工程（P2）

### C1 · 真机探针 ⬜
- **工期**：0.5 天
- **依赖**：用户操作
- **做法**：把 `probe/probe-script.js` 粘进酒馆助手脚本库 → 跑 → 收 8 行结果
- **验收**：8 项都有结论

### C2 · CI 流水线 ⬜
- **工期**：1 天
- **做法**：`.github/workflows/release.yml`
  ```yaml
  on: { push: { tags: ['v*'] } }
  jobs: { release: { steps: [checkout, 'npm ci || true', 'npm run all', 'gh release create'] } }
  ```
- **验收**：打 tag 自动跑，失败即停

### C3 · 版本页 ⬜
- **工期**：0.5 天
- **做法**：状态栏第七页显示 `卡 0.1.0 / 插件 0.1.0 / 契约 2026-11-a`

### C4 · 真实封面 ⬜
- **工期**：0.5 天
- **做法**：换 `art/cover.png`，重跑 `npm run png`
- **要求**：黑发绿眼、细框圆眼镜、格兰芬多旧袍（现在封面是金发斯莱特林，不对）

---

## 推荐顺序

```
第 1 周：A1 → A2 → A3 → C1        （能导进去、能看界面、知道环境）
第 2 周：A4 前半（能走 + 能打）    （宫殿动起来）
第 3 周：A4 后半 + B2 斯内普一座   （能改心）
第 4–6 周：B1 22 人 + B3 网        （人活起来）
第 7–8 周：B2 余下 + B4 + C2 C3 C4 （可发布）
```

**总计约 52 个工作日。**
