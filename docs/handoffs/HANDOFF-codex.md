# Handoff · Codex(阶段 2 + 3:IP 敏感组件精装)

> 贴给 Codex 的任务书。配套契约 `FRONTEND.md` 必须一并提供,它是唯一真值,**逐字照它实现,不自主发挥**。
> 你接手 Replit 起好的骨架,把它留的占位按契约精装。你负责的是**这个产品 IP 所在的精密零件**——精确 > 好看,一致 > 优雅。

---

## 0. 你的角色边界(先读这条)

Replit 已搭好五屏骨架 + 轨迹图技术骨架(占位色),代码在 `frontend/`(分支 `frontend-replit-v1`)。**你不重搭结构**,只把占位换成契约精确实现。**先读 §0.5 现状交接**——它有今天验收后的真实状态和三个新增前置任务(T0 端到端验证 / T1 剥离多余后端 / T2 修 nlAssembly)。

**贯穿红线(违反即错,无论哪个组件):**
- 用户可见文案**绝不**出现系统黑话:「轴 / 毕业 / 无解 / 口味层 / 萃取层」。按用户认得的词(磨粗磨细、到位/没到位、换豆、下一步)。
- **反差对绝不抹平**:互斥的诊断状态在 UI 上必须明显可辨,**绝不**为"友好/好看"把它们做成同一种表达。这是这个产品的核心 IP。
- **raw flag 绝不上屏**,只显示 flag 触发的动作/终止。
- 照 `FRONTEND.md` 的 L1 文案**逐字实现**,不改写、不"优化"措辞。

---

## 0.5 现状交接(2026-07-10 更新 · 阶段1验收后)

> 这段是阶段1(Replit)跑完 + Chillin 验收后的真实状态。**读这段再开工**,别基于"前端还没做"的旧假设。

### 工作位置
- 分支:**`frontend-replit-v1`**(直接在此分支改,整理好后一次 merge 回 main;不另开分支)
- 前端目录:仓库根下 **`frontend/`**(是一个 pnpm monorepo,前端 app 在 `frontend/artifacts/coffee-coach/`)
- 后端:**冻结,不碰**。真后端在 Chillin 本地真 repo,ADK + Gemini + SQLite,通过 `localhost:8000` 对接。

### ✅ 已验证(读代码 + 截图确认,别推翻、别重做)
- `frontend/artifacts/coffee-coach/src/lib/adkClient.ts` 连的是**真 ADK**(`/apps/{app}/users/.../sessions`、`/run`,base URL 走 `VITE_API_BASE_URL ?? localhost:8000`),**不是**自造 `/api`。API 地址已环境变量化。
- `nlAssembly.ts` 确实把表单**组装成自然语言整句**(不是 JSON payload)——契约方向对。
- 反馈屏双补位**已分开**(「没注意看」= 没观察;「尝到了但说不清」= 形容不出),没合并成统一「不确定」。
- 感官词按钮**正确**:酸/发苦(像烧焦木头)/发涩(口腔收紧发干,不是苦)/薄/纸板味闷味/尝到了但说不清;**无「甜」按钮**;苦涩已在文案分开。
- `diagnosis.tsx` / `timeline.tsx` 的 `terminate_reason` **留的是占位** `[taste_unaddressable]` 式 raw value,代码注释明确"intentionally does NOT translate yet"——**没有自主编造文案**。这是你要精装的地方。

### ⚠️ 新增任务(今天发现,优先于原阶段2/3)

**T0 · 端到端验证(阶段1未完成,你补)**
阶段1因本地 pnpm 原生模块 + `catalog:` 环境问题,**没能在本地真跑通端到端**。代码层对接已确认对,但"点一遍真的通"没验过。你接手后**先在你的环境跑通端到端**(冷启动→杯2→落账→持久化),确认真管道通,再开始精装。跑通前别假设管道无误。

> ⚠️ **环境坑预警(今天踩过,别重踩)**:此 monorepo 在 **x86_64 Mac + pnpm 11.7** 下有已知摩擦:
> - pnpm 11.7 **不读** package.json 的 `pnpm.onlyBuiltDependencies`,导致原生可选依赖(esbuild / rollup / lightningcss 的 `*-darwin-x64` 二进制)不自动安装,起 vite 时报 `Cannot find module @rollup/rollup-darwin-x64` / `@esbuild/darwin-x64` / `lightningcss.darwin-x64.node`。
> - 解法(择一):① `pnpm config set dangerouslyAllowAllBuilds true` 后 `rm -rf node_modules && pnpm install`(一次装齐所有原生依赖,推荐);② 或逐个 `pnpm add -w <pkg>@<对齐版本>` 手补(繁琐,版本必须和 host 精确匹配,如 esbuild 0.27.3 配 `@esbuild/darwin-x64@0.27.3`)。
> - 项目用了 pnpm `catalog:` 协议,**不能用 npm 装**(npm 报 `Unsupported URL Type "catalog:"`)。必须 pnpm。
> - 前端在 `frontend/artifacts/coffee-coach/`,是 workspace 包,`pnpm install` 在 `frontend/` 根做,起用 `pnpm --filter coffee-coach dev`(包名以其 package.json `name` 为准,实为 `@workspace/coffee-coach`)。
> - CORS:前端(vite 端口)连 ADK(8000)跨端口,ADK api_server 需允许前端 origin;参考 repo 现有 local demo frontend 的处理。

**T1 · 剥离多余的自造后端(前置清理)**
Replit 多搭了前端没实际使用的自造后端基础设施:`frontend/artifacts/api-server/`、`frontend/lib/db/`、`frontend/lib/api-spec/`、`frontend/lib/api-zod/`(自造 openapi 只有 healthz)。前端 `coffee-coach` 实际连的是真 ADK,不依赖这些。**剥离它们**(或确认无引用后删除),避免它们污染架构、误导"前端有自己后端"的认知。剥离前先确认 `coffee-coach` 没 import 这些包。

**T2 · 修 nlAssembly 分布差**
`nlAssembly.ts` 现在组的是**逗号串联的模板化句**(如「这杯酸、薄,比上杯变好,床面平」),而 agent 的 evalset 输入是**更口语、带感官细节**的句子(如「很酸,而且酸完发空、收尾很短,整体寡淡水感」)。两者有**分布差**——agent 在口语化输入上调优,喂它模板串可能表现漂移。**把 nlAssembly 的组装调得更贴近 eval 输入风格**(不必完全口语,但别是干巴巴字段串)。参照 `docs/demo-arc.md` 逐字稿的用户输入文风。

---


### 2.1 诊断结果屏:terminate_reason 的 L1 文案(最关键)

按 `FRONTEND.md` §1.1 表,把七个 active `terminate_reason` 的占位换成**逐字 L1 文案**。

**必须守的三组反差对(读起来必须明显不同):**
- `flavor_mismatch`(换一支豆更合口味)⟂ `taste_unaddressable`(同一支豆、下一步调别的)
- `axis_limit_underextracted`(萃取还没到位)⟂ `taste_unaddressable`(萃取已到位)
- `satisfied`(够好了)⟂ `would_overextract`(再调反而会变苦)

**硬验收(来自 FRONTEND.md 屏3):**
- `taste_unaddressable` 时**必须**显示"研磨之外的下一步"指路文案,**绝不**出现"换豆/换一支豆"CTA。
- `flavor_mismatch` 时**必须**指向"换一支豆更合口味",**绝不**说成"下一步调别的"。
- `axis_limit_underextracted` 时**必须**表述"萃取还没到位",**绝不**出现换豆 CTA。
- `taste_unaddressable`/`axis_limit_underextracted` **必须**指路语气,**绝不**用"做不到/走不动了"等道歉认输措辞。
- `plateau_ambiguous` **必须**保留"可能磨到最细、也可能豆子不新鲜"的**欠定表述**,**绝不**改写成单一确定归因(会 overclaim agent 做不到的诊断粒度)。

### 2.2 悬空枚举 + fallback

- `plateau_axis_topped` / `plateau_bean_decay`:**不映射**,不给 UI 文案。
- 任何未映射值(拼错/悬空/未来新值)→ 走 `FRONTEND.md` §5 fallback:降级为通用安全文案,**绝不**显示 raw 字符串、**绝不**崩溃,开发态 console 告警。

### 2.3 反馈录入屏:双补位

按 `FRONTEND.md` 屏2 实现两类补位,**必须可区分、绝不合并**:
- 「没观察」(如挂粉环 `没注意看`)= 数据缺失 → 下游"请补数据"
- 「形容不出」(如 `尝到了但说不清`)= 感官词汇缺失 → 下游**触发 probe**

> 这两类喂给 agent 的信号不同,合并会让 probe 触发逻辑失明。这是本屏最高价值验收点。

### 2.4 感官词按钮:A/B/C 三类触发逻辑

按 `FRONTEND.md` 屏2「感官词按钮集」实现:

| 按钮 | 类别 | 点了之后 |
|---|---|---|
| 酸 | B 触发 | **必然触发**收尾 probe |
| 苦 | A 自足 | 直接落账,文案"发苦(像烧焦/木头味)" |
| 涩 | A 自足 | 直接落账,文案"发涩(口腔收紧发干,像浓茶/生柿子,不是苦)" |
| 薄 | B 触发 | **必然触发**厚薄/萃取 probe |
| 纸板味/闷味 | A 自足 | 直接落账(前置 E5 陈化信号) |
| 尝到了但说不清 | C 补位 | 触发开放 probe |

**硬约束:**
- **绝不**加"甜"按钮。甜由 agent 通过绝对刻度 probe 主动问——加"甜"按钮=邀请用户拍板萃取毕业,与产品核心判别冲突。
- 苦、涩**必须**在按钮文案里就分开(苦=味道,涩=触感),**绝不**都用光秃秃"发干"——否则下游分不清走哪条诊断分支。

### 2.5 confidence 星级

按 `FRONTEND.md` §6:low/medium/high → 星级。**独立于诊断文案**呈现,**绝不**把置信度混进结论那句话。low 时附"需要更多信息判断",**绝不**表述成产品犹豫。

---

## 阶段 3 · 「我的」轨迹页:语义视觉精装

Replit 已起好折线图技术骨架(recharts、真数据、占位灰、颜色可替换)。你按 `FRONTEND.md` §5「收敛时刻」精装语义视觉。

**必须实现:**
- 收敛/满意那杯:用 `--converge`(青绿)点亮,**且全页仅此一处彩色**。
- 前面的爬升/震荡段:**全用中性色**(灰阶),让收敛色跳出来。
- demo 走**干净弧线**(无过冲回退):轨迹一路向好到收敛,不画转折。
  - (轨迹渲染逻辑本身应能表达转折——留作条件化能力;但干净弧线数据里没有转折点,别硬造。)
- **跨会话持久化标识**:必须有,表明"上一杯"来自持久化轨迹、不是聊天上下文错觉。

**硬约束:**
- `--converge` 是**语义化唯一色**(=用户到达的成就标识)。**绝不**把它用在导航/按钮/普通强调等无关处,否则稀释"看到它=我到了"的意义。
- **绝不**为"好看"给每个数据点上色/加渐变——全程克制,boldness 只花在收敛这一刻。

---

## 阶段 3.5(若做英文版才需要,v1 跳过)

v1 只中文。但文案实现时,若 Replit 已搭键值化(i18n 占位):
- 文案走键值查找,v1 只填中文列。
- ⚠️ 若将来加英文:英文译法**必须守同一组反差对**(见阶段2 三组),**绝不**因翻译图省事把互斥语义都译成模糊的"this cup isn't quite right"。discriminating power 是跨语言契约。

---

## 交付检查清单

**前置(今天新增,先做):**
- [ ] T0 端到端在你的环境跑通(冷启动→杯2→落账→跨会话持久化)
- [ ] T1 剥离多余自造后端(artifacts/api-server、lib/db、lib/api-spec、lib/api-zod),确认无引用
- [ ] T2 nlAssembly 调贴近 eval 输入文风(参照 demo-arc 逐字稿),消除分布差

**阶段2:**
- [ ] 七个 terminate_reason 逐字 L1 文案,三组反差对明显可辨
- [ ] taste_unaddressable 无换豆 CTA / flavor_mismatch 有换豆指向 / axis_limit 表"还没到位"
- [ ] plateau_ambiguous 欠定表述保留
- [ ] 悬空枚举不映射 + fallback 兜底不崩不露 raw
- [ ] 双补位可区分不合并(⚠️ 已验证存在,别改坏)
- [ ] 感官词 A/B/C 触发逻辑;无甜按钮;苦涩输入层分开(⚠️ 按钮已验证正确,精装触发逻辑即可)
- [ ] confidence 星级独立、low 附"需要更多信息判断"
- [ ] 用户可见文案零系统黑话

**阶段3:**
- [ ] 收敛点 `--converge` 点亮且全页唯一彩色,震荡段中性
- [ ] 干净弧线不硬造转折
- [ ] 跨会话持久化标识在
- [ ] 收敛色未用于无关处
