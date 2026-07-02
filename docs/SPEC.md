# 咖啡 Agent · 产品定义 Spec
# Coffee Agent · Product Definition Spec

> **状态 / Status**: 产品定义已锁定 (Product definition LOCKED) — 2026/6/25
> **用途 / Purpose**: Build 阶段的规格锚点 (Spec anchor for build) + Day 5 spec-driven 实证 (spec-driven evidence)
> **来源 / Provenance**: 本文件不是凭空写的需求书,而是一轮教练式产品定义讨论(六个硬判断)的产物。每条结论都经过压测,没有一条是未经挑战的默认。
> This is not a top-down requirements doc. It is the output of one coached product-definition session — six hard judgment calls, each stress-tested, none accepted as an unchallenged default.

> **给 Claude Code 的第一指令 / First instruction to the builder**:
> 实现的是**收敛循环**,不是推荐器。如果你发现自己在写一个"输入症状 → 输出配方"的单轮函数,你写错了。核心是一个带状态、跨杯、会终止的爬山循环。详见 §3。
> Implement a **convergence loop**, not a recommender. If you find yourself writing a single-shot "symptom in → recipe out" function, you are building the wrong thing. The core is a stateful, cross-cup, terminating hill-climb. See §3.

---

## 1. 一句话定义 / One-Line Definition

**中文**
> 大师的方案不一定是你的最佳选择;Agent 会陪你从一包豆的最开始调整冲煮方案,随着每一次水温 / 研磨度 / 时间等产生的变化,直到你逼近"萃取到位且贴近自己口味"的地方。

**English**
> A master's recipe is a starting point, not your answer. From the first cup of a fresh bag, the agent remembers every brew and walks you — through changes in grind, temperature, and timing — toward the point where extraction is dialed in *and* the cup matches your taste.

**验收标准 / Why this sentence holds (self-check):**
1. 有终点 (has a terminus): "直到 / toward the point where" — 指向一个会到达的目标,不是无尽探索。
2. 有"上一杯" (has a "previous cup"): "从最开始…每一次变化 / from the first cup… every brew" — 系统记得轨迹,不是每次从零。
3. 平庸版本抄不走 (un-copyable by the baseline): 贴到一个"大师配方 GPT 壳"上会违和,因为壳子没有收敛能力。

---

## 2. 产品概述 / Product Overview

| | 中文 | English |
|---|---|---|
| **产品** | 手冲单一豆种的迭代收敛教练 | An iterative-convergence coach for single-origin pour-over |
| **用户** | 手冲初学者:磨豆机可能无刻度、手法不稳、想在一包豆开封后的 ~15 杯生命周期里尽快喝好 | Pour-over beginners: grinder may have no scale, technique is unstable, wants to drink well across a fresh bag's ~15-cup lifecycle |
| **真实行为** | 不是"隔天复诊",是"一包豆喝完前的十几杯,每杯比上杯更准" | Not "next-day re-diagnosis" but "across the dozen-plus cups before the bag runs out, each cup beats the last" |
| **截止 / Deadline** | 2026/7/6 23:59 PT (Kaggle 课程页为准) | per Kaggle course page |

### 2.1 核心闭环 / Core Loop

大师方案当**起点** → 单变量受控、按杠杆序(研磨 → 水温 → 手法)**串行爬山** → 读每杯相对上杯的反馈梯度 → 决定「同向继续 / 收小步长 / 转下一轴 / 判定到顶停手」→ 收敛到"萃取到位且贴近口味"。

Master recipe as **seed** → single-variable, controlled, **serial hill-climb** along the leverage order (grind → temperature → technique) → read each cup's feedback gradient relative to the previous cup → decide *continue same direction / shrink step / switch to next axis / declare summit and stop* → converge on "extraction dialed in *and* taste-aligned."

### 2.2 诊断 IP / The Diagnostic IP

把用户**给得出**的主观感官词("太酸 / 发苦 / 寡淡 / 涩"),在「**这包豆的私有历史 + 这支豆的先验**」上**消歧**成下一步动作。诚实区分两件事:

The agent disambiguates the subjective sensory words the user *can* give ("too sour / bitter / thin / astringent") against **this bag's private history + this bean's priors**, turning them into a next action. It honestly separates two cases:

- **"萃取没到位" / "Extraction not there yet"** → 客观、有对错、该治 (objective, has a right answer, treat it)
- **"到位了但不合口味" / "Dialed in but not to your taste"** → 主观、无对错、该承认豆子性格或转风味微调 (subjective, no right answer — acknowledge the bean's character, or shift toward taste-tuning)

> 这一区分是命根子。把"他不爱果酸"误判成"萃取不足",系统会一路磨细升温,把一支好浅焙萃到死,用户还以为是自己手艺问题。
> This split is load-bearing. Mistaking "he dislikes acidity" for "under-extraction" sends the system grinding finer and hotter, destroying a good light roast while the user blames their own hands.

### 2.3 记忆两层 / Two Memory Layers

- **豆级 / Bean-level (主 / primary)**: 这包豆的收敛轨迹 — 闭环成立的前提,demo 弧线的数据源。This bag's convergence trajectory — the precondition for the loop, the data behind the demo arc.
- **用户级 / User-level (副 / secondary)**: 跨豆沉淀的口味画像 — 冲过几包豆后自然长出"你偏好浅焙果酸"。Cross-bag taste profile — emerges after a few bags ("you lean toward light-roast brightness").

### 2.4 Taste Diagnostician 输入契约 / Input Contract
> 口味层消歧以「萃取已毕业」为**前置真值**,由上游(萃取层收敛判定)保证,下游信任、不复核。
> The taste-layer disambiguation takes "extraction has graduated" as a **given truth**, guaranteed upstream (the extraction-layer convergence call); the downstream trusts it and does not re-verify.

- E11a/E11b 等口味层 case 的开局「萃取四项已收敛」是**给定前提**,非待验状态。
- ⚠️ **已知风险(指派给上游,非 S3)**:「欠萃伪装成毕业」灰区(豆偏粗 / 到研磨极限 / 相对最甜 → 四项全绿实则欠萃 plateau)。若上游误放行,本组件会忠实信任 → 误判口味层无解 / 换豆。**该灰区的拦截是萃取层责任,见 `docs/evals.md` 缺口看板「萃取层 · 拦截欠萃伪装」条。**
  Build note:该风险已由 E12 graduation gate eval 编码覆盖;仍保留为 taste-layer 输入契约的设计边界。

---

## 3. 诊断 Agent 的真实形态 / What the Diagnostic Agent Actually Is

> **这一节是给 builder 的。它决定你写出的是 agent 还是脚本。**
> **This section is for the builder. It decides whether you ship an agent or a script.**

诊断 agent **不是**"看一眼症状就开方"的单轮专家系统。它是一个在你这包豆上做**单变量受控实验、靠反馈梯度往最优点收敛的优化器** — 本质是**爬山法 (hill climbing)**。

The diagnostic agent is **not** a single-shot expert system that reads a symptom and prints a prescription. It is an **optimizer running single-variable controlled experiments on your specific bag, climbing a feedback gradient toward the optimum** — fundamentally **hill climbing**.

### 3.1 收敛回路(按动作顺序)/ The Convergence Loop (in action order)

```
1. 用户报告一句主观感官词        User reports one subjective sensory word
   ↓
2. 在「这包豆历史 + 豆种先验」上    Disambiguate against
   消歧 → 是萃取问题还是口味问题?   (bag history + bean priors) → extraction issue or taste issue?
   ↓
3. 决定动哪一根轴(按杠杆序)      Pick which axis to move (by leverage order)
   + 决定步长(大步,扛噪声)       + pick step size (large, to beat noise)
   ↓
4. 给出调整:"这次只动 X,别的照旧"  Issue adjustment: "this time move only X, hold the rest"
   ↓
5. 用户冲、给反馈                 User brews, gives feedback
   ↓
6. ★ 读这杯相对上杯的梯度          ★ Read the gradient vs. the previous cup
   = 变好 / 变坏 / 没变?            = better / worse / unchanged?
   ↓
7. ★ 据此决定下一步:               ★ Decide next move:
   同向继续 / 收小步长 /             continue same direction / shrink step /
   这根轴到顶了→转下一根轴 /          this axis is maxed → switch axis /
   已收敛→停手                      converged → STOP
   ↓
   (回到 3 / back to 3)
```

> **★ 标记的第 6、7 步是 agent 的命根子。** 没有"读梯度 → 回接决策"这个回环,它就是一条直线流程(脚本),单轮 chatbot 也能假装做。有了它,才是带状态、会自我修正、会判断何时终止的循环。
> **Steps 6–7 (★) are the heart.** Without "read gradient → loop back into the decision," it is a straight-line flow (a script) that a chatbot can fake. With it, it becomes a stateful, self-correcting loop that knows when to terminate.

> **终止条件不可省。** Agent 必须知道"什么时候该停"(到这包豆的最优点了,再调就过萃),否则会无限让用户"再调一格",把人冲烦、把豆冲废。
> **The termination condition is non-negotiable.** The agent must know when to stop (the bag's optimum is reached; further moves over-extract), or it will forever say "tweak one more notch," exhausting the user and wasting the bag.

### 3.2 多维 = 跨轮串行,不是单杯齐转 / Multi-axis = serial across rounds, not simultaneous within a cup

任一**瞬间**只动一维(信号干净、归因清楚);但**跨越整包豆的生命周期**,agent 依次爬完研磨 → 水温 → 手法。多维活在**跨轮的编排**里,不在单杯的旋钮数上。决定"先爬哪条轴、何时转轴、何时收手"的那个调度者 = **Coordinator / conductor**。

At any single **instant**, only one axis moves (clean signal, clear attribution); but **across the bag's lifecycle**, the agent climbs grind → temp → technique in sequence. "Multi-axis" lives in the **cross-round orchestration**, not in the number of knobs per cup. The scheduler deciding *which axis first, when to switch, when to stop* is the **Coordinator / conductor**.

---

## 4. 六个关键决策及理由 / Six Key Decisions & Rationale

> 这是决策日志 (decision log)。每条记录:挑战了什么强默认、结论、为什么、实证哪条白皮书原则。Build 时每个模块都能接回这里。
> This is the decision log. Each entry: what default was challenged, the call, why, and which whitepaper principle it evidences. Every build module traces back here.

### D1 — 用户与触发点 / User & Trigger
- **挑战的默认 / Default challenged**: 入口是"用户能把感官词说对 → AI 翻译成调整"(假设用户有感官词汇)。Entry = "user names the flaw correctly → AI translates" (assumes sensory vocabulary).
- **结论 / Call**: 触发点改为"买了新豆、面对器具不知道怎么开冲"。真初学者**说不准自己哪里不对**。Trigger = "fresh bag, doesn't know how to start." True beginners *can't reliably name* what's wrong.
- **理由 / Why**: 对初学者更诚实的入口。More honest entry point for the actual user.

### D2 — 闭环的时间结构 / Temporal Structure of the Loop
- **挑战的默认 / Default challenged**: "隔天复诊"是自然行为。"Next-day re-diagnosis" is natural behavior.
- **结论 / Call**: 闭环由**一包豆的生命周期**驱动(~15 杯 / 一两周),不是某个特定的"明天"。The loop is driven by **the bag's lifecycle** (~15 cups / 1–2 weeks), not a specific "tomorrow."
- **理由 / Why**: 用户的真实行为是"豆子开了就尽快喝完"。这把"24 小时遗忘断崖"稀释成"十几次自然开冲时机",行为门槛大降 — 产品不必"拽用户回来",只需在他**本就要冲的那杯**上给建议。User's real behavior: "bag's open, finish it soon." This dilutes the "24-hour forgetting cliff" into a dozen natural brew occasions; the product needn't drag the user back, only advise the cup they were already going to brew.
- **实证 / Evidence**: agent-centrality — 跨杯记忆从"nice feature"升为"闭环前提"。Cross-cup memory rises from nice-to-have to precondition.

### D3 — 目标函数分两层 / Objective Function Splits Into Two Layers
- **挑战的默认 / Default challenged**: 闭环目标 = "调出最符合个人偏好的方案"(把萃取和口味焊成一个目标)。Goal = "the most taste-matching recipe" (welds extraction and taste into one).
- **结论 / Call**: 两层有序 — **先萃取到位(客观、可收敛、是 IP),再口味微调(主观、靠沉淀、是副产品)**。Two ordered layers — **extraction first (objective, convergeable, the IP), taste second (subjective, accreted, a byproduct)**.
- **理由 / Why**: 同一句"太酸",在两个目标下要做相反的事。不分层 → 诊断逻辑崩溃。The same "too sour" demands opposite actions under the two goals. No split → diagnostic logic collapses.
- **实证 / Evidence**: 这是 §2.2 诊断 IP 的根。Root of the diagnostic IP in §2.2.

### D4 — Execution Gap(建议值 ≠ 执行值)/ The Execution Gap (advised ≠ actual)
- **挑战的默认 / Default challenged**: 系统知道用户实际怎么冲的(可拿绝对参数反推萃取状态)。The system knows how the user actually brewed (can reverse-infer extraction from absolute params).
- **结论 / Call**: **不依赖绝对参数,只靠相对变化。** 用户(无刻度磨、不测温)的执行值默认不可信。**Don't depend on absolute params; use relative change.** A user with no grind scale / no thermometer makes the actual values untrustworthy by default.
- **理由 / Why**: 若拿"系统建议的 20 格"当"用户实际",会把萃取不足误判成豆子性格,该治的病被放过。Treating "advised 20 clicks" as "actual" mislabels under-extraction as bean character; a treatable fault goes untreated.
- **实证 / Evidence**: 这是诊断范式从"绝对参数反推"转向"相对变化收敛(爬山)"的转折点。The pivot from "absolute-param inference" to "relative-change convergence (hill-climb)."

### D5 — 初学者噪声 / Beginner Noise
- **挑战的默认 / Default challenged**: 用户能稳定"控制变量"(只动一维、别的照旧)。The user can reliably "control variables" (move one axis, hold the rest).
- **结论 / Call**: 接受噪声 — **串行单变量 + 大步长 + 看趋势**。不跟初学者的手法稳定性较劲。Accept the noise — **serial single-variable + large steps + read the trend**. Don't fight the beginner's instability.
- **理由 / Why**: 初学者每杯都在无意识多变量乱动;靠大步长让信号强过抖动,靠多杯趋势把噪声平均掉。Beginners unconsciously move many variables each cup; large steps make signal exceed jitter, multi-cup trends average the noise out.
- **代价 / Cost**: 收敛偏慢 → 直接影响 demo 弧线设计(见 §6)。Slower convergence → directly shapes the demo arc (see §6).

### D6 — 多维 vs 单维 / Multi-axis vs Single-axis
- **挑战的默认 / Default challenged (来自教练的反向施压 / coach pushed to cut to single-axis)**: 为 demo 干净,砍成只动研磨。Cut to grind-only for a clean demo.
- **结论 / Call**: 保留多维,但**严格串行(方案 A)** — 一次仍只动一维,agent 编排杠杆序。Keep multi-axis, but **strictly serial (option A)** — still one axis at a time, agent orchestrates the leverage order.
- **理由 / Why**:
  1. 单维在因果模型里是假的 — "又酸又苦 = 萃取不均匀",单动研磨治不了。Single-axis is false to the causal model — "sour *and* bitter = uneven extraction" can't be fixed by grind alone.
  2. 只有多维才撑得起 conductor 编排 — 单变量不需要调度。Only multi-axis justifies the conductor — one knob needs no scheduling.
  3. A 同时满足:多维(跨轮调度)+ 干净信号(瞬时单变量)+ conductor 实证 + 可上镜(分段弧线),且不违背 D5。A satisfies all of: multi-axis (cross-round), clean signal (instantaneous single-var), conductor evidence, demo-able (segmented arc) — without violating D5.
- **被否决的 / Rejected**: 多维齐动(方案 B)— 归因不可能做干净,且重交互违背"忠于真实用户"。Simultaneous multi-axis (B) — attribution impossible to keep clean, heavy interaction betrays "stay true to the real user."

---

## 5. 差异化与送命题 / Differentiation & The Killer Question

### 5.1 平庸版本长什么样 / What the baseline looks like
一万个项目里的主流:**一个带聊天皮的配方数据库** — 套大师方案(粕谷哲 4:6 / Hoffmann),价值是检索 + 复述。没有"你",没有"你这杯",没有"上一杯"。**一个静态 App 加 GPT 壳就做完,不需要 agent。**

The mainstream entry: **a recipe database with a chat skin** — serves a master recipe (Kasuya 4:6 / Hoffmann), value = retrieve + recite. No "you," no "your cup," no "previous cup." **A static app plus a GPT shell finishes it; no agent required.**

### 5.2 护城河 / The moat
不是"我的方案更优"(守不住 — 你一个 capstone 凭什么比咖啡大师懂萃取)。是**收敛过程本身**:

Not "my recipe is better" (indefensible — why would a capstone out-extract a master?). It's **the convergence process itself**:

- 平庸版本交付一个**点**(拿去用的最优参数)。The baseline delivers a **point** (here's your optimal recipe).
- 你交付一条**轨迹**(从大师起点,根据你这杯的实际反馈,爬向你的最优点)。You deliver a **trajectory** (from the master's seed, climbing on *your* cup's real feedback toward *your* optimum).

> 大师方案在你的产品里不是终点,是**起点(初始猜测)**。大师方案是给"标准豆、标准水、标准手法、标准口味"的;你面前是你这包具体的豆、你家的水、你不稳的手、你的口味。**从那个标准起点收敛到你这个具体情境** — 大师方案做不了(它是死的),检索 chatbot 也做不了(它没有"你的上一杯")。
> The master recipe is not the destination but the **seed**. It's written for a standard bean / water / technique / palate; you have *your* bean, *your* water, *your* unsteady hands, *your* taste. Converging from that standard seed to your specific situation — the master recipe can't (it's static), the retrieval chatbot can't (it has no "your previous cup").

### 5.3 送命题答案 / Answer to "why an agent, not a chatbot?"
> 单轮 chatbot 没有"上一杯",做不了爬山(爬山的本质是"基于上一步决定下一步")。静态 App 不会因"这包豆第四杯还在酸"而改变策略。**只有带跨杯记忆、会编排杠杆序、会判断终止的 agent,才能爬这座山。** 而护城河不是某一个特征 — 是收敛所需的「跨杯记忆 + 编排 + 消歧 + 终止判断」这四样**只能凑在一个 agent 里**才成立。
>
> A single-shot chatbot has no "previous cup," so it cannot hill-climb (the essence of hill-climbing is "decide the next step from the last"). A static app won't change strategy because "this bag's 4th cup is still sour." **Only an agent with cross-cup memory, leverage-order orchestration, and a termination judgment can climb this hill.** The moat is no single feature — it's that convergence's four requirements (cross-cup memory + orchestration + disambiguation + termination) **can only co-exist inside an agent**.

---

## 6. 范围 / Scope

### 6.1 死保 (P0) / Must-protect (P0)
- 诊断推理(主观词 → 消歧 → 下一步动作)Diagnostic reasoning (sensory word → disambiguation → next action)
- 跨杯记忆(豆级轨迹)Cross-cup memory (bean-level trajectory)
- 收敛闭环(读梯度 → 回接决策 → 终止)Convergence loop (read gradient → loop decision → terminate)
- 一条可上镜的收敛弧线 One demo-able convergence arc
- 单一冲煮法:**只 V60** Single method: **V60 only**

### 6.2 落后时砍 (P2) / Cut if behind (P2)
- Bean Scout(豆种识别 agent)/ Bean Scout (bean-ID agent)
- 多冲煮法 / Multiple brew methods
- 口味自动调参 / Auto-tuned taste params
- 照片识别 / Photo recognition

> **砍范围的真正理由**:不是"做不完",是"为了让 D5 的收敛弧线在 demo 里**短、干净、可读**"。D5 选了"大步长 + 看趋势"→ 收敛偏慢、会抖 → demo 必须靠降维去换一条清晰弧线。
> **Real reason to cut**: not "no time," but "to keep D5's convergence arc **short, clean, readable** on demo." D5 chose "large steps + trend-reading" → slower, jittery convergence → the demo must trade breadth for a legible arc.

### 6.3 Demo 弧线 / The demo arc
D6 原设想是串行多维 → demo 可拍成**分段收敛弧线**:"研磨收敛 → 转水温 → 再收敛"。v1 为了保持 SPEC §3 的梯度信号短、干净、可读,实际 demo **收窄为研磨单轴闭环**:冷启动 → 欠萃 → 磨细 → 读梯度 → 满意停手。多轴 conductor 保留为后续版本,不是本次 capstone 的交付承诺。

D6 originally chose serial multi-axis → the demo could become a **segmented convergence arc**: "grind converges → switch to temp → converges again." For v1, the actual demo is intentionally narrowed to a **grind-only closed loop** so SPEC §3's gradient signal stays short, clean, and readable: cold start → underextraction → finer grind → gradient reading → satisfied stop. The multi-axis conductor remains future scope, not a capstone delivery claim.

### 6.4 关键概念覆盖 (要求 ≥3) / Key Concepts Covered (≥3 required)
多 Agent / ADK · MCP Server · 跨轮 Memory · 安全护栏 Guardrails · 可部署 Deployability。
Multi-agent / ADK · MCP Server · cross-round Memory · Guardrails · Deployability.

### 6.5 非 agent 边界 / Non-agent Boundary

> **给 builder 的硬指令**:以下部分**不要用 agent**。它们是静态规则地盘,用 agent 是杀鸡用牛刀,还会模糊产品真正的 IP。诚实剥离这些,剩下的收敛闭环才是提纯的、攻不倒的 agent 核心。
> **Hard instruction to the builder**: the following are **NOT agents**. They are static-rule territory; using an agent here is overkill and blurs the real IP. Honestly stripping these out leaves a purified, indefensible-by-others agent core.

| 部分 / Part | 该用 / Use | 为什么不用 agent / Why not an agent |
|---|---|---|
| **Seed 匹配** (烘焙度 → 初始配方) / Seed match (roast → initial recipe) | 静态规则 / static rule | 一张固定查找表,输入(烘焙度)固定→输出(初始配方)固定,无需推理。A fixed lookup table; fixed input → fixed output, no reasoning. |
| **开方前自检** (豆过期 / 水质 / 磨豆机不均) / Pre-Rx checklist (stale bean / water / uneven grinder) | 静态规则 / static rule | 固定排查清单,命中即提示"不是你的手法",无需推理。A fixed checklist; on hit, flag "not your technique." No reasoning. |

> **判断方法(三方案标尺)/ The test (three-tool ruler)**:任何模块,先问三句 —— 静态规则够吗(同输入是否该同输出)?检索够吗(是否只需复述历史、无需在历史上推理)?决策树够吗(路径能否设计时画死)?**三个都"不够"且说得清不够在哪,才用 agent。** Any module: ask the three questions — static rule enough (same input → same output)? retrieval enough (recite history, no reasoning over it)? decision tree enough (paths fixable at design time)? **Only when all three are "no" — and you can say why — use an agent.**
>
> 实证白皮书脊椎 ②:商品化层(seed/自检,谁都能做)vs 耐用资产层(收敛推理,你的 IP)分开装。Evidences spine ②: separate the commoditized layer (seed/checklist, anyone can do) from the durable-asset layer (convergence reasoning, your IP).

### 6.6 版本边界注释 / Version-boundary notes
> 防止把「本版冻结」误读成「永久产品原则」。每条版本边界留痕,等对应轴解冻时重判 gold。

- **口味层 · 提粉量(E11b · `taste_unaddressable`)**:本版只动研磨、冻结比例与水温轴。萃取毕业后用户「爱这个酸但想更厚」属口味层,正确杠杆(升温 / 延长接触 / 提浓度)全在 brew 端、本版冻结 → 诚实终止(`taste_unaddressable` + `limitation_noted`),**不碰粉量**。这是**版本边界,非产品原则**:多轴 conductor 上线、比例轴解冻后,「提粉量」从越界变正解,`docs/evals.md` 的 **E11b gold 须重判**。

---

## 7. 开放问题 / Open Questions

> 真正未决的,不是已能从上文推出的。Genuinely unresolved — not things already derivable above.

- **[设计 / design]** 萃取/口味的边界:因果模型覆盖到哪算"够"?哪些是可靠规则、哪些不该假装确定?(Section 4 第 4 题的延续,build 时随 eval case 逐步钉。)Where does the causal model stop being reliable? Which rules are solid, which shouldn't pretend certainty? (To be pinned via eval cases during build.)
- **[已决 / v1 decision]** 第一杯的冷启动:问齐烘焙度、烘焙日期或未知状态、粉量、磨豆机类型和起始研磨描述后,调用 `start_bag`;未知烘焙日期走 E7c 的低置信冷启动,不阻塞也不编造豆龄。Cold start now asks for roast level, roast date or unknown status, dose, grinder type, and baseline grind, then calls `start_bag`; unknown roast age follows E7c's low-confidence path without blocking or inventing bean age.
- **[数据 / data]** 单一来源数字进 portfolio/视频前**必须核**:Day 3「56% skill 不触发 / SkillsBench 19%」、Day 4「slopsquatting 扩散」、Day 1「85%/51%/41% / 25–39% 生产力」。Verify single-source stats before they enter the writeup/video.
- **[已决 / v1 decision]** 口味画像(用户级记忆)不进 v1;本版只交付豆级轨迹记忆。User-level taste memory is out of v1; this build only ships bean-level trajectory memory.

---

## 8. 给 Build 的护栏 / Guardrails for the Build

> 来自 Handoff §6/§7,搬到这里以便 Claude Code 直接读到。From Handoff §6/§7, relocated so the builder reads them directly.

- **小步走 / Small batches**: 在 Claude Code 里小步走、让它解释每个决策、别整文件盲接(Day 4: small batch + "别签你看不懂的" / Vibe Diff)。
- **EDD**: Taste Diagnostician 先写 eval case 再写规则(eval ≠ unit test)。Write eval cases before rules.
- **学习 > 速度 / Learning over speed**: 放太自动会 ship 但学不到 0→1。宁可慢、问清楚。Over-automating ships but skips the 0→1 learning. Slower, with questions.
- **vendor 分装 / Separate the pitch**: conductor / orchestrator / factory model / 80% problem 是 Addy Osmani 造词,好用但非行业标准;Gemini / ADK / Antigravity / Cloud Trace 是厂商 pitch — 和可迁移概念分开装。
- **硬规矩 / Hard rules**: ① 6/29 必须有"能跑通的丑闭环";② 7/2 代码冻结;③ 7/5 晚提交完整草稿,别赌 7/6 23:59。
