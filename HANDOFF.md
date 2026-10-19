# 交接文档 · HP-Reverb

> 给接手的新 agent。**先读完这一份，再看 `设计/README.md`。**
> 最后更新：commit `711b4a8`（2026-10-19）
> 仓库：https://github.com/makenwjz/hpgame

---

## 0. 三十秒理解这个项目

**这是一张 SillyTavern 角色卡**：哈利·波特娘化 AU，主角固定男版哈利。
白天是日程/社群/关系网模拟（Persona 式），夜里是**9 座像素宫殿 + 八方旅人式回合战斗**。
**121 人可攻略**，22 张塔罗可操作。

**当前进度**：骨架能跑（构建/单测/检查器/CDN 全绿），**但玩家导进去只能看到纯文本**。

---

## 1. 工作目录与仓库

| 项 | 值 |
|---|---|
| 本地目录 | `C:\bd\ds project` |
| 仓库 | `https://github.com/makenwjz/hpgame`（main 分支） |
| 远端 HEAD | `711b4a8` |
| tag | `v0.1.0`（**已存在，指向当前提交**） |
| 推送方式 | `git -c http.version=HTTP/1.1 push origin main`（本机 raw.githubusercontent 不稳，必须用 HTTP/1.1 + jsDelivr） |
| 凭据 | 已配置，可直接 push |

**注意**：`raw.githubusercontent.com` 在本机**经常超时**，一切外部访问优先用 `cdn.jsdelivr.net`。

---

## 2. 目录结构

```
C:\bd\ds project
├── src/                        源码
│   ├── contract.mjs            契约唯一源（枚举 + 语法 + renderContract）
│   ├── schema.mjs              15 容器 schema + 白名单 + 幽灵键拦截
│   ├── core.mjs                运行时核心（解析四类请求 → 规则 → 写回）
│   ├── rules/
│   │   ├── affinity.mjs        社群结算（点数/门槛/升级）
│   │   ├── roll.mjs            十类检定（判定线/结算/check 渲染）
│   │   └── schedule.mjs        日程/周结算/五维经验/考试
│   ├── scripts/loader.js       卡内引导脚本（从 CDN 加载 core.mjs）
│   ├── entries/                15 条常驻条目（md + frontmatter）
│   ├── ui/_ref-status.html     ⭐ 原卡状态栏渲染器（77KB，可复用）
│   ├── ui/_ref-create.html     ⭐ 原卡创角页渲染器（75KB，可复用）
│   └── palace/                 ⬜ 空，宫殿前端待建
├── tools/
│   ├── gen-entries.mjs         生成 15 条常驻 md
│   ├── build-card.mjs          打包 chara_card_v2 JSON
│   ├── build-dist.mjs          内联打包 dist/<ver>/core.mjs
│   ├── pack-png.mjs            PNG 打包（移植自原卡，含 chara+ccv3）
│   ├── check-contract.mjs      检查器①：契约枚举
│   ├── check-paths.mjs         检查器②：路径白名单
│   ├── check-names.mjs         检查器③：人名变体
│   ├── test-rules.mjs          22 条单测
│   └── _ref-build-png.js       原卡打包器参考
├── dist/                       产物（已入库，CDN 要读）
│   ├── card.json               47KB，15 条世界书
│   ├── card.png                132KB，可直接导入
│   ├── initvar.json            初始变量
│   ├── 0.1.0/core.mjs          29KB，运行时
│   └── latest.json             版本指针
├── probe/                      环境探针（8 项）
├── art/cover.png               占位底图（800×1200 纯色）
├── cards/HP-Reverb/
│   ├── 设计/                   ⭐ 22 份设计文档（00–22）
│   ├── 解析报告-v10.1.md       原卡逆向分析
│   └── 进度.md                 进度追踪
└── _card_parse/                ⚠️ 原卡只读证据（已 gitignore）
```

---

## 3. 已完成（可依赖，别重做）

| # | 件 | 状态 | 验证方式 |
|---:|---|---|---|
| 1 | 22 份设计文档 | ✅ | 读 `设计/README.md` |
| 2 | 15 条常驻条目（8,919 字） | ✅ | `npm run gen` 重新生成 |
| 3 | 15 容器 schema + 67 路径 | ✅ | `npm run check` 退出 0 |
| 4 | 幽灵键拦截 | ✅ | 单测「白名单拦截幽灵键」 |
| 5 | 三段规则纯函数 | ✅ | `npm test` 22/22 通过 |
| 6 | 运行时 core.mjs | ✅ | `node --check dist/0.1.0/core.mjs` |
| 7 | PNG 打包 | ✅ | `npm run png` 回读一致 |
| 8 | CDN 可加载 | ✅ | `curl https://cdn.jsdelivr.net/gh/makenwjz/hpgame@v0.1.0/dist/0.1.0/core.mjs` |
| 9 | 三个检查器 | ✅ | `npm run check` 全绿 |
| 10 | 环境探针 | ✅ 已写，⬜ 未跑 | 需真机 |

**一条命令验证全部**：
```bash
npm run all     # build → test → check
```

---

## 4. 未完成（按优先级）

### P0 · 卡还不可玩

| # | 任务 | 工期 | 依赖 | 做法 |
|---:|---|---:|---|---|
| **A1** | **状态栏六页** | 1 天 | 无 | **不要重写**。改 `src/ui/_ref-status.html` 里的 `cw-sheet` JSON：六页 = 主角/五维/日程/关系/网/宫殿，路径换成 15 容器。roster 的 `gate` 用 `/关系/{键}/Rank` |
| **A2** | **创角页三栏** | 0.5 天 | 无 | 同上，改 `_ref-create.html` 的 sheet：删开局/姓名/性别三步，保留血统出身/魔杖，性情倾向改成给五维 +2 经验 |
| **A3** | **正则接线** | 1 天 | A1 A2 | 写 `tools/build-regex.mjs`，把 HTML 压成正则 `replaceString`，写进 `card.json` 的 `extensions.regex_scripts` |
| **A4** | **宫殿前端 MVP** | 8 天 | 无 | `src/palace/`。见 `设计/15`（工程）与 `设计/20`（美术/怪物/解密）。先做「能走 + 能打一场」 |

### P1 · 内容缺失

| # | 任务 | 工期 | 依赖 |
|---:|---|---:|---|
| **B1** | 22 塔罗人设（七段 + 十级台阶） | 7 天 | 需用户给「最想攻略的 3 人」 |
| **B2** | 9 座宫殿 + 13 回响房 | 12 天 | A4 |
| **B3** | ≈320 条关系边 + 60 交叉线 | 20 天 | B1 骨架 |
| **B4** | 59 个 T2 + 42 个 T3 + 11 敌对 | 20 天 | B1 |

### P2 · 工程

| # | 任务 | 工期 | 说明 |
|---:|---|---:|---|
| **C1** | 真机探针 | 0.5 天 | 装 `probe/probe-script.js`，8 项结果 |
| **C2** | CI 流水线 | 1 天 | `.github/workflows/release.yml`：tag → `npm run all` → 发布 |
| **C3** | 版本页 | 0.5 天 | 状态栏加一页显示 卡版本/插件版本/契约版本 |
| **C4** | 真实封面 | 0.5 天 | 现在是 800×1200 纯色占位 |

---

## 5. 关键口径（不要推翻，都定过了）

| 项 | 定稿 | 文件 |
|---|---|---|
| 主角 | **固定男版哈利**（0 愚者），无第二条开局 | `07-序章与哈莉线` |
| 哈莉 | 平行世界来客 = **21 世界**，**没有宫殿**，第 1 周末同床登场 | 同上 |
| 关系 | **不排他**，并行恋 ≤5，唯一约束「不能骗」 | `02` §8.6 |
| 阿利安娜 | **13 死神**，平时是猫（摩根娜位），序章入队 | `08` |
| 德拉科娅/麦格/卢娜 | 3 皇后 / 4 皇帝 / 18 月亮 | `08` |
| 双子 | **8 力量**，一个操作位两具身体 | `08` §4 |
| 不可操作 | 詹玛、莉莉、妮可、阿尔巴、格林德沃 | `08` §5 |
| 马尔福家 | 德拉科娅+露西娅+纳西莎 **三人并行可攻略** | `12` §5.1 |
| 韦斯莱家 | **9 人全可攻略**，七阶段家弧 | `13` |
| 01 学年 | **两座宫殿**：斯内普（圣诞前）+ 德拉科娅（圣诞） | `07-九宫殿` |
| 战斗 | 八方式：BP / 护盾 Break / 弱点只削盾 / 显示行动队列 | `10` |
| 数值 | 每周 4 行动点、五维 1–5 阶、Rank 1–10、一学年 172 点 | `00` §2 |
| 分发 | 主路走**酒馆助手脚本库**，自造 loader 是备用 | `16` §0.5 |

---

## 6. 硬规则（违反必出事）

1. **一个字段只有一个写入方**。见 `设计/05` §2 与常驻条目《单写与白名单》。
2. **枚举只在 `src/contract.mjs` 定义一次**。改枚举必须重跑 `npm run check`。
3. **`<check>` 只能由脚本产出**。模型直接写会被 `core.mjs` 剥离。
4. **前端不算数**。宫殿前端只发意图，数值走 `core.mjs`。
5. **dist 必须入库**。否则 CDN 404（tag 指向的文件必须存在）。
6. **发版必须打 tag**，loader 只认 tag 不认分支。
7. **不要逆向商业游戏**。美术方法论见 `设计/20`，全部自绘。

---

## 7. 常见坑

| 坑 | 现象 | 解法 |
|---|---|---|
| raw.githubusercontent 超时 | `import()` 静默失败 | 用 `cdn.jsdelivr.net` |
| `.mjs` MIME 不对 | import 报错 | raw 返回 `text/plain`，jsDelivr 返回 `application/javascript` |
| push 卡住 | 无输出 | 加 `git -c http.version=HTTP/1.1` |
| 内联打包重名 | `Identifier 'clamp' has already been declared` | 各文件用独立前缀（clampAff/clampRoll/clampSched） |
| `.gitignore` 反向规则 | `!dist/` 被前面的 `dist/` 覆盖 | 不要写 `dist/`，只写 `!dist/**` |
| 中文键名在 git 里乱码 | `\350\256\276...` | 正常，是 git 的转义显示 |

---

## 8. 命令速查

```bash
npm run gen      # 重新生成 15 条常驻 md
npm run card     # 打包 card.json
npm run dist     # 内联打包 core.mjs
npm run png      # 打包 card.png
npm run build    # 以上四步
npm test         # 22 条单测
npm run check    # 三个一致性检查器
npm run all      # build + test + check
```

**发版流程**：
```bash
npm run all
git add -A && git commit -m "feat: ..."
git -c http.version=HTTP/1.1 push origin main
git tag -f v0.1.1 && git -c http.version=HTTP/1.1 push -f origin v0.1.1
```

---

## 9. 需要用户提供的（只有 3 件）

| # | 需要 | 用在哪 |
|---:|---|---|
| 1 | 探针 8 项结果 | 确认远程加载/MVU 写回 |
| 2 | 最想先攻略的 3 个人 | 决定 B1 写作顺序 |
| 3 | 尺度边界 | T1 人设写法 |

---

## 10. 建议的第一天

1. 读 `设计/README.md`（文件优先级）→ `设计/14`（流程）→ `设计/20`（游戏）
2. 跑 `npm run all` 确认基线全绿
3. 打开 `dist/card.png` 导入 ST，看现状
4. 开始 **A1 状态栏**：先改 sheet，不要动渲染器

---

## 11. 一句话交接

**骨架是好的，内容是空的。**
优先做「玩家能看见的东西」（状态栏 → 宫殿 → 人设），不要继续写设计文档。
设计已经够多了——`设计/` 里 22 份，足够支撑到发布。
