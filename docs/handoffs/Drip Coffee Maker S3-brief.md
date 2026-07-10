# S3 启动 Brief · Taste Diagnostician(因果模型 · EDD)

> **怎么用**:把本文件整段复制进一个全新对话,作为冷启动交接,读完即可开 S3 讨论。
> **项目**:咖啡 Agent capstone,代码在 `/Users/yue/Documents/Drip Coffee Maker/`,完整产品定义见该 repo `docs/SPEC.md`,eval 标尺见 `docs/evals.md`,现有因果规则在 `agents/hello_agent/agent.py`。
> **状态**:S0(骨架)/ S1(单轴收敛闭环 + 14 eval,7 个高危已全绿)/ S2(豆级记忆:start_bag+record_cup 工具,纯 Python 已验,端到端待测)均已完成。S3 现在开始。

---

## 0. S3 是什么 / 不是什么
- **S3 = 打磨 Taste Diagnostician**:把"主观感官词 → 消歧 → 下一步动作"的**因果模型**做深、做可靠(SPEC §2.2,这是产品的 IP/护城河)。
- **方法 = EDD:先写 eval case 再写规则**(SPEC §8)。**eval ≠ unit test**——测的是判断/动作的对错,不是字符串匹配。
- **不是**配方层、不是记忆层、不是多轴 conductor。那些是别的组件(见 §1)。

## 1. 架构定位:S3 在哪一层、和谁有契约
| 层 | 是什么 | 现状 |
|---|---|---|
| Recipe Designer | **确定性 tools / 静态规则**(seed 查表、记账)= 商品化层(§6.5,明令"别用 agent") | 已建:`start_bag`(静态查 seed+豆龄+自检)、`record_cup`(记账)。**不是 agent。** |
| **Taste Diagnostician(S3)** | **LLM 因果推理** = 耐用资产/IP(§2.2) | 现活在 `agent.py` instruction 的"消歧"段 |

- 两层用一套**冻结的结构化契约**(§2)解耦 → **S3 可独立打磨因果模型,不碰工具**。
- **唯一跨层协调规矩**:若 S3 发现因果模型需要一个**现有字段装不下的新诊断维度** → 要回头给 `record_cup` 加字段,标成"跨层协调项",别单方面改契约。

## 2. 冻结的契约(S3 的每个判决必须映射到这些字段)
S3 因果模型的输出 = 往 `record_cup` 这些结构化字段里"灌判断";写 eval case 时**瞄着这些字段评分**(让审慎判断可计数):
```
turn_type        seed | adjust | probe | terminate
direction        finer | coarser | —(仅 adjust)
gradient         变好+同向 | 变坏 | 没变 | 已收敛 | n/a
decision         继续 | 反向 | 收步 | 转轴 | 探针 | 停手
terminate_reason satisfied | would_overextract | plateau_axis_topped | plateau_bean_decay | plateau_ambiguous
confidence       high | medium | low          (对本杯判断的把握)
flags_asserted   [info_insufficient, limitation_noted]   (agent 声明;审慎判断的可计数落点)
flags_derived    [hardware_unreliable, bean_aged]         (工具从表头/豆龄派生,agent 不填)
report           sensory · vs_prev · brew_time · bed_shape(平/拱/塌坑/偏厚下陷不足) · wall_ring(有/无) · bed_note
rationale        自由文本(纹理,不计数)
```
> 关键设计:**要 COUNT/评分的 → 枚举/旗标;只供人读的 → rationale。** `wall_ring` 独立、`terminate_reason` 枚举、`flags_asserted` 都是为了让"涩判别/plateau欠定/守审慎"变可统计。

## 3. 当前因果模型基线(S3 要打磨的就是这套规则)
摘自 `agent.py` 消歧段,作为改进起点:
- **第0步信息闸门**:用户只给光秃秃感官词、缺判别信息时,不脑补、不空耗一杯;就这杯给二选一维度探一次(优先于客观捷径)。
- **酸看收尾轴(不看强度)**:收尾发空/短 = 欠萃→调细;收尾化甜/回甘 = 萃取到位的果酸性格 = 口味问题→绝不再磨细。(强度尖不尖锐是噪声。)
- **苦/过萃**:舌根滞留苦、焦/木质、空洞 + 流速变慢/偏长/床泥泞 → 调粗。
- **涩(判别式,绝不反射)**:绝不"涩→过萃→磨粗"。先找均匀度证据,硬度排序 **杯壁挂粉环(最硬)>塌坑>流速异常**;有证据→通道/手法;无证据+手法稳→豆性/烘焙涩→转口味,**不磨粗、不狂调 swirl**。
- **又酸又苦按磨豆机归因**:砍豆机→双峰分布(细粉过萃苦+粗块欠萃酸),归因磨豆机本身、不回指注水;锥/平刀→才考虑萃取不均。
- **plateau 欠定**:连续无改善时禁止单方面咬定"轴到顶"或"豆老了";两者并存欠定,**无论哪种都别再磨细**;陈化有专属信号(香气掉/纸板感/平淡)可作旁证但不排除轴到顶。

## 4. 现有 eval 套(在它上面扩,别重起炉灶)
`docs/evals.md` 14 个 action-based case,**评分总则:判动作不判说法 + 给可接受原因集合 + 不留后门**。已有:
- 酸三分:E1a(明确果酸→判到位)/ E1b(模糊→必须探针)/ E1c(收尾发空→磨细镜像)
- 通道:E2a(挂粉环+塌坑露骨→通道)/ E2b(无证据→豆性,不磨粗)
- 砍豆机:E3(归因双峰)/ E3b(锥刀对照,防"复述双峰"假绿)
- 客观交叉验证:E4(舌头说好但客观没动→别急着收敛)
- 正常收敛:E6(舌头与客观一致→同向收步)
- 冷启动自检:E7(养豆不足→别归咎手法)
- 终止三支:E8(满意)/ E9(再调过萃→回退)/ E5(移动山顶→plateau_ambiguous)
- 对抗:E10(索要完美配方→扛住,不退化查表)
- **缺口看板**(可作 S3 起点):冷启动信息不全、多重矛盾词、口味层微调、编码成 ADK evalset 自动回归。
- **今天只跑了 7 个高危(E1b/E1c/E2b/E3/E3b/E5/E10)全绿;另 7 个(E1a/E2a/E4/E6/E7/E8/E9)未验。**

## 5. 五条判 case 原则(S3 质量命门,务必带着)
这几条是前几轮辛苦攒的,不带过去会写出弱 case:
1. **不留后门**:gold 不能有"其实没理解也能蒙对"的捷径;撤掉混淆信号,该缺信息就缺(逼出探针)。
2. **判动作不判说法**:奖励 agent 做了什么,不是说出某个特定原因;多个合法归因→列"可接受原因集合"。
3. **加孪生/对照防假绿**:太露骨的 case 配一个难孪生(如 E2b)或反向对照(如 E3b 锥刀),只有真懂才两条都过。
4. **观察 vs 解释分开**:raw 观察字段只装用户看得到的(初学者 D1 说不清);"通道型/阻塞型"这种**解释**交给 agent 推,别塞进观察字段。
5. **审慎判断要可计数**:把"信息不足→探针""声明局限""plateau欠定"做成枚举/旗标(info_insufficient / limitation_noted / plateau_ambiguous),别埋进自由文本——否则跑100条统计不了。

## 6. S3 的核心开放问题(§7,讨论从这切入)
- **因果模型边界**:覆盖到哪算"够"?哪些是可靠硬规则、哪些**该承认不确定、不假装确定**?(这条决定 confidence 怎么用、何时该 info_insufficient 探针。)
- 萃取层 vs 口味层的分界在因果上哪里最容易误判?(§2.2 命根子:把"不爱果酸"误判成"欠萃"会一路磨死好浅焙。)

## 7. 建议的 S3 第一步
按 EDD:**先针对上面的因果边界/缺口写一批新 eval case(瞄准 §2 的结构化字段、守 §5 五原则),再据此改/补 §3 的规则。** 别先改规则。

---
> 接口冻结说明:S3 改的是因果规则(`agent.py` 消歧段)+ eval 套(`docs/evals.md`),**不动** Recipe Designer 工具(`memory.py`),除非命中 §1 的"跨层协调项"。这保证 S3 能和 S2 端到端测试并行,互不阻塞。
