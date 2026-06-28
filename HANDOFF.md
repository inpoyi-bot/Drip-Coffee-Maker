# HANDOFF · 明天(额度恢复后)三件事

> **写于**:2026-06-26 收工时。今天 daily-20 配额耗尽,以下都要等额度。
> **明天三件事**:
> 1. **(S1)跑干净 5/5 收敛弧线** 替换 `docs/demo-arc.md`(现为 4/5 占位)——见 §1–§5。
> 2. **(S1)补跑剩下 7 个 eval**(E1a/E2a/E4/E6/E7/E8/E9),拿到全绿 S1 基线——见 §7。
> 3. **(S2)端到端测记忆层**(start_bag/record_cup 真被调用 + 跨会话持久化)——见 §8。
> 4. **(S3,待规则定稿)口味层规则落地 + 跑 E11**——case+契约已落,规则在 S3 对话推,定稿后写进 instruction 再测——见 §9。
> **顺序建议**:先 §8(S2 端到端,最关键)→ §1 弧线 → §9(若 S3 规则已定)→ §7 补 eval。**额度紧,一天大概只够 1–2 件,别贪。**

---

## 0. 为什么这份 handoff 存在
- 弧线脚本原本在 session 级 scratchpad,明天会消失 → 本文件**自带脚本全文**(见 §5),不依赖任何临时文件。
- 当前 [docs/demo-arc.md](docs/demo-arc.md) 第4杯是空响应(转折杯),逻辑由第3、5杯覆盖,闭环成立但不完美。目标是拿到 1–5 杯全非空、收敛干净的版本替换它。

## 1. 前置条件(先确认,否则白跑)
- **配额**:今天撞了 `gemini-2.5-flash` 免费层 **每天 20 次** 上限(报错 `429 ... limit: 20 ... GenerateRequestsPerDayPerProjectPerModel-FreeTier`)。
  - 重置时间:太平洋时间午夜(≈ 北京时间次日下午 3–4 点)。**早于这个时间跑还会撞墙。**
  - 更稳的解法:给该 Google Cloud 项目**开启结算(绑卡)**升到 Tier 1,日限大幅提高 —— demo 日强烈建议这么做。
- **模型**:确认 `agents/hello_agent/agent.py` 里 `model="gemini-2.5-flash"`(正式版本;今天为应急临时换过 lite/latest,已改回)。
- **环境**:用 venv 里的解释器 `./.venv/bin/python`(已装好 `google-adk`)。

## 2. 怎么跑
```bash
cd "/Users/yue/Documents/Drip Coffee Maker"
# 把 §5 的脚本存成 run_arc.py(若还在的话直接用),然后:
./.venv/bin/python run_arc.py 2>&1 \
  | grep -v "UserWarning\|warnings.warn\|EXPERIMENTAL\|super().__init__\|site-packages\|^    \|^  File\|Traceback\|\^\|ConnectError\|Node execution\|Root node\|above exception\|^The \|empty response\|RuntimeError\|RESOURCE_EXHAUSTED\|adk-docs\|次失败" \
  > arc_clean.txt
```
> 注:Python 经管道是**块缓冲**,跑的过程中 `arc_clean.txt` 可能一直是空的,要等进程**结束**才一次性刷出 —— 别以为卡死了。想实时看就加 `-u`:`./.venv/bin/python -u run_arc.py`。

## 3. 验收标准(达不到就别替换)
- `grep -c "^\[杯" arc_clean.txt` == **5**。
- **每杯 AGENT 都有非空内容**。校验(注意 `AGENT: ` 有尾随空格,别再被它坑):
  ```bash
  grep -n "^AGENT: *$" arc_clean.txt   # 输出应为空(没有空 AGENT 行)
  ```
- 内容合格线:杯1 冷启动给 seed+冻结手法+味觉校准;杯2 判**欠萃**→调细;杯3 读梯度"方向对"+收小步长;杯5 **满意即停、明说"研磨这根轴已调好"**。杯与杯之间有"和上一杯比"的回指。

## 4. 跑出 5/5 之后
1. 按 [scratchpad 那份 demo-arc.md 的排版](docs/demo-arc.md) 把 `arc_clean.txt` 整理成 markdown(去掉分隔线噪声、保留 5 杯逐字稿、去掉第4杯的空响应备注)。
2. **覆盖** `docs/demo-arc.md`。
3. 提交(全英文):
   - **Summary:** `Replace demo arc with clean 5/5 run`
   - **Description:** `Re-run grind-axis convergence arc on gemini-2.5-flash after quota reset; all 5 cups non-empty; removes the cup-4 empty-response placeholder`

## 5. 完整脚本(明天直接存成 `run_arc.py`)
已含三类重试:429/503、网络 ConnectError、**空响应**。每杯间隔 3s 缓解 per-minute 限流。
```python
import asyncio, sys
sys.path.insert(0, "/Users/yue/Documents/Drip Coffee Maker/agents")
from dotenv import load_dotenv
load_dotenv("/Users/yue/Documents/Drip Coffee Maker/agents/hello_agent/.env")
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from hello_agent.agent import root_agent

# 同一个 session,跨杯历史靠对话上下文成立
TURNS = [
    "我要开一包新豆开始调。V60 手冲,浅焙,烘焙日期 8 天前,粉量 15 克。我的磨豆机是锥刀电动磨,现在磨出来像粗砂糖那么粗。怎么开始?",
    "冲好了。很酸,而且酸完发空、收尾很短,整体寡淡水感、有点单薄;流速挺快,大概1分40秒就下完了,床面有点浅。",
    "按你说的磨细了。比上杯好不少,酸轻了一些、没那么空了;时间长了点,大概2分10秒,床面平。不过还是偏酸。",
    "又磨细了一点。这杯又好了些,酸基本平衡了,开始能尝到一点甜,收尾也长了;时间约2分30秒,床面平。",
    "这杯我挺满意的,酸甜平衡、有回甘,挺好喝;时间约2分40秒,床面平。",
]

async def main():
    svc = InMemorySessionService()
    runner = Runner(agent=root_agent, app_name="arc", session_service=svc)
    await svc.create_session(app_name="arc", user_id="u", session_id="arc1")
    for i, msg in enumerate(TURNS, 1):
        content = types.Content(role="user", parts=[types.Part(text=msg)])
        out = ""
        for attempt in range(5):
            try:
                async for ev in runner.run_async(user_id="u", session_id="arc1", new_message=content):
                    if ev.is_final_response() and ev.content and ev.content.parts:
                        out = ev.content.parts[0].text or ""
                if not out.strip():
                    raise RuntimeError("empty response")  # 空响应也重试
                break
            except Exception as e:
                wait = 8 * (attempt + 1)
                print(f"  (杯{i} 第{attempt+1}次失败 {type(e).__name__},等 {wait}s 重试…)")
                await asyncio.sleep(wait)
        await asyncio.sleep(3)
        print("=" * 72)
        print(f"[杯 {i}] 用户:", msg)
        print("-" * 72)
        print("AGENT:", out.strip())
        print()

asyncio.run(main())
```

## 6. 今天踩过的坑(明天别重踩)
- `gemini-2.0-flash` 免费额度=0,用 `gemini-2.5-flash`;`limit:0` 报错先想到换型号。
- 顺手探可用模型:`gemini-flash-latest` 今天可用(alias,不利复现,只当应急,别提交)。
- 报错谱:`SERVICE_DISABLED`(开服务)→ `API_KEY_SERVICE_BLOCKED`(key 被限,换 AI Studio 干净项目 key)→ `429 limit:0`(换型号)→ `429 limit:20`(日配额,等重置/绑卡)→ `503`(过载,重试)→ `ConnectError`(网络/代理抖动,重试)→ 空响应(重试)。
- `model` 在 `agent.py` 单独一行,换模型是改一个词的事。

---

## 7.(S1)补跑剩下 7 个 eval
今天只跑了 7 个高危场景(全绿),还有 7 个没验:**E1a / E2a / E4 / E6 / E7 / E8 / E9**(定义见 [docs/evals.md](docs/evals.md))。
- 用 §5 同款 Runner 模式,每个 case 开**一段干净会话**喂场景+报告,抓 agent 回应,对着 evals.md 的 ✅必须/❌绝不 判 PASS/FAIL。
- 注意 E4/E7/E8/E9 有"前置杯/冷启动信息"——按 evals.md 里写的场景把状态折进消息(参考今天 `run_evals.py` 的写法,但那脚本在 scratchpad 已消失,按 §5 风格重写即可)。
- 目标:14 个全绿的 S1 基线。哪个 FAIL 就按今天"判动作不判说法 + 找旁路 + 收口"的路子校准 instruction。

## 8.(S2)端到端测记忆层 ★最关键
今天搭好了 S2 记忆层(`agents/hello_agent/memory.py` + `agent.py` 接线),**纯 Python 逻辑已验证**,但**模型真的调工具/填字段**没测过。明天验这个。

**先确认(今天已就位)**:`agent.py` 里 `tools=[start_bag, record_cup]`、`instruction=build_instruction`(动态注入轨迹);`model="gemini-2.5-flash"`。

**怎么跑(带 SQLite 持久化)**:
```bash
cd "/Users/yue/Documents/Drip Coffee Maker"
./.venv/bin/adk web agents --session_service_uri="sqlite:///./sessions.db"
# 浏览器选 hello_agent,走一遍冷启动 → 几杯 → 满意收敛
```
> `sessions.db` 会建在 repo 根,已被 `.gitignore`(`*.db`)挡住。

**验收点(逐条看)**:
1. **冷启动调了 `start_bag`**:agent 问齐 烘焙度/烘焙日期/粉量/磨豆机 后调工具,并**如实转告 seed_recipe + advice**(别埋掉老豆/砍豆机提示)。在 `adk web` 的 **Events/Trace** 面板能看到工具调用和参数。
2. **每杯调了 `record_cup`**,且字段填对:`turn_type` 正确、`wall_ring` 有值、探针轮记成 `probe`+`info_insufficient`(不是"没变")、terminate 给了 `terminate_reason`。
3. **读记忆而非回忆**:回应里对"上一杯"的引用和注入的"## 这包豆的记忆"块一致。
4. **派生项没被 agent 乱填**:砍豆机那杯 `flags_derived` 自动含 `hardware_unreliable`,且 `step` 不出现"+2格"这类假精确。
5. **跨会话持久化(核心卖点)**:关掉浏览器/重启 `adk web`,**resume 同一个 session**,"这包豆的记忆"轨迹**还在**——这就是"上一杯从假变真"。
6. 用 **Trace** 面板看 `record_cup` 的入参,核对是否和那杯对话一致。

**容易踩**:① 模型可能漏调 `record_cup`(软约束),漏了就在 instruction 的"记忆纪律"里加强/或考虑用 callback 强制;② 16 个参数较宽,模型可能填错枚举,对着 evals.md 的取值校;③ 若 503/429,沿用 §5 的重试与错峰。

**S2 端到端通过后**:可以考虑把"读梯度"也接到结构化轨迹(目前靠注入文本,已够;若要更硬可加 get_history 工具),以及规划用户级口味画像(`user:` 作用域,今天留了空槽)。

---

## 9.(S3)口味层规则落地 + 跑 E11
S3 的 eval case(E11a/E11b 口味层孪生)+ 契约枚举**已落 repo**(`docs/evals.md §九`;`memory.py` 已含 `flavor_mismatch`/`taste_unaddressable`/`preference_unspecified`)。**还差"写规则"那半**——口味层逻辑还没进 `agent.py` 的消歧/终止段,所以**现在跑 E11 会 fail**(EDD 正常顺序:case 先行、规则后补)。

**规则设计在另一个对话(S3)进行中。** 设计定稿后:
1. **把口味层逻辑写进 `agent.py` instruction**:萃取毕业(客观四项到位 + 收尾化甜)后用户仍抱怨 → `probe` 偏好(`turn_type=probe` + `preference_unspecified`,不替用户拍)→ 据回答分支:
   - 不爱品类 → `terminate_reason=flavor_mismatch` + 转 Bean Scout(换豆);
   - 爱但想更厚 → `terminate_reason=taste_unaddressable` + `limitation_noted` + 指版本外 brew 出口,**不碰粉量 / 不磨细 / 不换豆**。
2. **契约无需再改**(memory.py 今天已同步),只动 `agent.py`。
3. **跑 E11a/E11b 验证(需额度)**:按 §九 的 gold/gate 判。重点 E11b **别换豆、别提粉量**(最严重假绿);probe 轮**只验 `turn_type`+`preference_unspecified`,不验话术**。
4. 通过后,基线从"14 条"扩成"16 条全绿"。

**依赖与排期**:规则来自 S3 对话;落地只动 `agent.py`,与 §7/§8 互不冲突但都抢额度,**排在 S2 端到端之后**。
