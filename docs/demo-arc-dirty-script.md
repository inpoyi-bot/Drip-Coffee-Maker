# Demo · 研磨单轴 dirty arc 逐字稿(6 杯)

> 单会话 · 脚本模拟用户 · V60 + 研磨单轴。目的:在干净弧线之外,展示一次真实搜索会遇到的过冲回退,再通过探针确认后满意停手。
> 对应 SPEC §3 第 6/7 步:读这杯相对上杯的梯度 → 反向收步 / 探针 / 终止。

---

## 六条用户消息

### 杯 1 · 冷启动
**用户**:我要开一包新豆开始调。V60 手冲,浅焙,烘焙日期 8 天前,粉量 15 克。我的磨豆机是锥刀电动磨,现在磨出来像粗砂糖那么粗。怎么开始?

### 杯 2 · 欠萃诊断
**用户**:冲好了。很酸,而且酸完发空、收尾很短,整体寡淡水感、有点单薄;流速挺快,大概1分40秒就下完了,床面有点浅,杯壁没挂粉环。

### 杯 3 · 方向变好但未毕业
**用户**:按你说的磨细了。比上杯好不少,酸轻了一些、没那么空了;时间长了点,大概2分10秒,床面平,没挂粉环。不过还是偏酸。

### 杯 4 · 明确过冲 → 反向收步
**用户**:这杯比上杯明显差:发苦了,口腔有点发干,流速慢了不少,大概2分55秒,床面偏厚、下陷不足。

### 杯 5 · 回退后变好但 graduation 证据不足 → 探针
**用户**:比上杯好,苦涩没了,酸也干净,尾段能尝到一点甜,但我说不好算不算酸甜平衡,好像还是偏薄。

### 杯 6 · 确认满意 → 终止
**用户**:想了一下,甜是清楚压过酸的,喝完有持续回甘,我很满意。

---

## 预期 record_cup 表骨架

| cup | turn_type | gradient | direction | step | terminate_reason | 备注 |
|---|---|---|---|---|---|---|
| 1 | seed | n/a | — | — | — | `start_bag` 写包级表头;若 agent 同轮记录第一杯反馈,允许作为起点欠萃记录落账 |
| 2 | adjust | 变好+同向 | finer | 2格 | — | 欠萃签名明确,只调研磨 |
| 3 | adjust | 变好+同向 | finer | 2格 | — | 方向对,但用户仍偏酸、未出甜,不得写 `已收敛` |
| 4 | adjust | 变坏 | coarser | 1格 | — | E13a gold:`flags_asserted` 含 `overshoot_observed`,不得含 `axis_limit_reached` |
| 5 | probe | 没变 / info_insufficient | — | — | — | E12a-style gold:`decision=探针`,`flags_asserted` 含 `absolute_extraction_uncertain` |
| 6 | terminate | 已收敛 | — | — | satisfied | 用户明确满意,研磨轴收敛停手 |

---

## Run checklist

1. 启动 ADK web:

```bash
./.venv/bin/adk web agents --session_service_uri="sqlite+aiosqlite:///./sessions.db"
```

2. SQLite session flag 必须保留:

```text
--session_service_uri="sqlite+aiosqlite:///./sessions.db"
```

3. 用同一个 web session 依次粘贴 6 条用户消息。不要临场改变量;水温、粉量、比例、注水手法保持冻结。

4. 持久化复读验证:演示后用一个全新的 `DatabaseSessionService` 连同一个 `sessions.db`,确认能读回同一包豆的 `bag` 和 6 杯 `cups` 轨迹。验点同 `docs/demo-arc.md`:证明 "上一杯" 来自持久化结构化轨迹,不是聊天上下文错觉。

5. 最多 3 次尝试。只允许做 wording-only tuning:微调用户消息里的措辞清晰度或停顿,不得改 gold 动作、不得改 agent prompt、不得解冻水温/比例/粉量/手法。
