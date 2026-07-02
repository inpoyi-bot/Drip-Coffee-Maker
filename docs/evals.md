# 咖啡 Agent · Eval 标尺(S1 · 研磨单轴)
# Coffee Agent · Eval Rubric (S1 · grind-only)

> **用途**:验证 `agents/hello_agent` 的 `instruction` 是否真的实现了 SPEC §3 的收敛循环——测的是**决策**,不是配方记忆。
> **状态**:人类可读 rubric + 已编码 ADK eval 回归板。E3/E5/E7c/E11/E12 已有 evalset + custom metric;剩余未编码边界见缺口看板。
> **配套**:`agent.py` 的消歧段标 `[待 eval 校准]`,本文件即那把尺。

---

## 评分总则(先读这条,它决定每个 case 怎么判)

1. **判动作,不判说法。** Gold 奖励的是 agent **做了什么**(磨/不磨/探针/停手/标注局限),不是它**说出某个特定原因**。现实里常有多个合法归因通向同一个正确动作——凡此情形,下方列出"可接受原因集合",命中其一即可。
2. **不留后门。** 每个 case 的报告里,要么**含有**做出 gold 判断所必需的判别信息;要么**故意不含**——此时正确动作就是**先探针/先标注不确定**,而不是自信下判决。一个"其实没理解"的 agent 不应能靠捷径蒙对。
3. **不写死数字阈值。** 验"它有没有想到去判断(豆龄/养豆/流速方向)",不验它背出某个具体天数/秒数(§7:这些边界靠 eval 慢慢钉,现在别假装确定)。
4. **每个 case 标注"防的后门"**:写明我们撤掉了哪条捷径,确保它测的是目标洞察本身。

---

## 一、酸的三分(命根子 + 镜像)

> 同一个"酸",有三种正确处理:口味性格(别动)、信息不足(先探针)、真欠萃(该磨细)。三条必须同时测,否则 agent 会从单条过度泛化。

### E1a — 明确果酸 → 判到位、转口味
- **场景**:浅焙,第2杯,这是第一次调整后(无 plateau 信号可借)。
- **用户报告**:"还是酸,但是那种干净明亮、越喝越生津、带回甘的酸;冲了约2分10秒,床面平整。"
- **✅ 必须**:判**萃取已到位、这是这支豆的果酸性格(口味问题)**;停止磨细;转入口味讨论(承认豆子性格 / 问他要不要换风味方向)。
- **❌ 绝不**:继续"再磨细一点";把任何酸都当欠萃。
- **防的后门**:不给"连续无改善→plateau→停"的捷径(设为第2杯、首次调整)。"停止磨细"只能从"这是果酸"推出,不能靠"反正没变"绕过。

### E1b — 模糊"还是酸" → 必须先探针
- **场景**:浅焙,第2杯。
- **用户报告**:"还是太酸;冲了约2分钟,床面平。"(**没说收尾**是发空还是化甜)
- **✅ 必须**:**不下自信判决**;就这杯弹一次**单轴收尾**探针(例:"这酸**收尾发空、酸完就没了**,还是**会化成甜、有回甘**?")再决定。
- **❌ 绝不**:从"太酸+2分+床平"就自信判"萃取已到位/这是口味"(信息不足,2分钟对浅焙偏快,单看反而偏欠萃);也不得脑补成尖锐/反射磨细。
- **防后门补注**:探针只能问**收尾**(发空/化甜),**不准问"尖不尖锐"**——强度是噪声,高酸度豆入口也冲,会把这杯误判到欠萃边。
- **防的后门**:报告**故意缺**判别信息。和 E1a 配对,逼出"识别果酸"与"不确定不硬猜"两件事——后者正对 instruction"诚实面对不确定、设计探针"。

### E1c — 真欠萃(E1a 的镜像正样本) → 该磨细
- **场景**:浅焙,第2杯。
- **用户报告**:"很酸,而且**酸完发空、收尾就没了**,还有点寡淡水感、口感单薄;流速偏快、冲得比上杯快,床浅。"
- **✅ 必须**:判**萃取不足**(收尾发空 + 寡淡 + 流速快互证) → **研磨调细**(只给研磨一个动作,余照旧)。
- **❌ 绝不**:误判成口味问题 / 因为"酸"就拒绝磨细(从 E1a 过度泛化成"见酸不磨"的失败)。
- **防的后门**:必补此镜像,否则一个 agent 可能从 E1a 学歪成"看到酸永远不磨细",而整套 case 抓不到。优先级同 E1。

---

## 二、通道效应(露骨正样本 + 难孪生)

### E2a — 露骨通道信号(正样本)
- **场景**:中焙,第4杯。
- **用户报告**:"有点涩;**杯壁挂了一圈干粉**、床面中间还塌了个坑。"
- **✅ 必须**:抓住**挂粉环(最硬的不均证据)+ 塌坑** → 判**萃取不均/通道效应**;回指注水/swirl 均匀度;说明单轴版的局限。
- **❌ 绝不**:直接判过萃 → 让用户磨粗。
- **防的后门**:信号太露骨,只当**正样本**用(确认它不会把教科书级通道误判成过萃)。真考题是 E2b。

### E2b — 难孪生:涩 + 客观正常(真考题)
- **场景**:中焙,第4杯。
- **用户报告**:"有点涩;但**杯壁没挂粉环**、床面看着还算平、流速跟上杯差不多正常。"(均匀度证据**全无**)
- **✅ 必须**:**不反射"涩→过萃→磨粗"**;查均匀度证据(挂粉环/塌坑/流速)——此处**均无 + 手法稳** → 倾向**豆子/烘焙自带的涩**,转口味讨论,或先探针确认;**不磨粗、不让用户狂调 swirl**。
- **可接受原因集合**:{ 判豆性/烘焙涩转口味、先探针确认手法与豆性 } 命中其一即可。
- **❌ 绝不**:① 看到"涩"反射"过萃→磨粗"(旧反射);② 无证据却默认"通道→去调 swirl"(新反射,把豆性涩误诊成通道)。
- **防的后门**:既撤掉露骨床面信号、又显式**否定挂粉环**,逼它走判别(有证据才通道、无证据转豆性),两个反射都堵死。

---

## 三、砍豆机归因(浅层 vs 深层通过)

### E3 — 砍豆机 + 又酸又苦 → 归因双峰分布,不得甩锅注水
- **场景**:冷启动,用户磨豆机是**砍豆机(blade)**;开局症状"又酸又苦"。
- **✅ 必须**:① 告知**研磨轴在砍豆机上不可靠**(双峰分布:细粉过萃发苦+粗块欠萃发酸)、降低期望、建议换锥/平刀;② **把"又酸又苦"归因到砍豆机本身的双峰分布**,而不是回指注水手法。
- **结构化 gold**:`turn_type=terminate` + `decision=停手` + `terminate_reason=axis_unreliable`。原因:当前优化轴因硬件约束无法产生可靠反馈;这不是 `plateau_ambiguous`(还没爬山,原因也不模糊)。
- **❌ 绝不**:把"又酸又苦"判成"注水不均→调你的 swirl"(在砍豆机上是误诊,不均来自磨豆机不是手法);当成正常磨豆机自信"磨细2格";把 `terminate_reason` 填成 `plateau_ambiguous`。
- **防的后门**:"又酸又苦"在 E2 逻辑里本是"萃取不均→回指注水"的信号——此 case 专门分辨"真懂砍豆机"与"碰巧提了砍豆机却把不均归错因"。rubric 必须显式要求归因到磨豆机。**注意**:说成"萃取不均"= FAIL(它通向"调 swirl"这条错误干预轴,而双峰 swirl 一万次也去不掉),不给"碰巧没说出回指注水"的同情分——按动作判。
- **配对防"复述双峰"假绿**:E3 单独存在仍有捷径——一个见"砍豆机"标签就背"双峰"的 agent 也能过。必须配 E3b 才测得真。

### E3b — 锥刀 + 又酸又苦(E3 的对照,防"复述双峰"假绿)
- **场景**:冷启动,磨豆机是**锥刀(burr)**;开局症状**同样**"又酸又苦"。
- **✅ 必须**:**不归因到双峰/磨豆机**(锥刀颗粒分布正常);按萃取不均(通道/注水)或先探针,走均匀度证据路径。
- **结构化 gate**:不得使用 `terminate_reason=axis_unreliable`。
- **❌ 绝不**:不分磨豆机类型,照样背"砍豆机双峰"(暴露它在复述标签而非条件化归因)。
- **防的后门**:与 E3 配成对——"复述双峰"的 agent 会 E3 过、E3b 翻车。只有真正**按磨豆机类型条件化归因**才能两条都过。

---

## 四、客观交叉验证(舌头 vs 客观打架)

### E4 — 舌头说变好、客观没动 → 别急着收敛,再验一杯
- **场景**:第5杯,**上一杯磨细了2格**(确保"本该动")。
- **用户报告**:"感觉变好了、酸轻了一点;但整杯时间和床面跟上杯没差别。"
- **✅ 必须**(按动作判):**不草率确认改善/宣布收敛**;提议**再验证一杯**。
- **可接受原因集合**:{ 手法波动骗了舌头、研磨步长太小没过噪声 } —— 二者都导向同一动作,命中其一即可。
- **❌ 绝不**:把"变好→继续同方向/宣布收敛"照单全收。
- **防的后门**:补足"上一杯磨细了"前提(否则客观不动是理所当然);gold 不把原因写死成"手法波动"(那是过度具体)。

---

## 五、正常收敛(正样本,与 E4 对照)

### E6 — 舌头与客观一致变好 → 同方向收小步长
- **场景**:中焙,第2→3杯。
- **用户报告**:"磨细后变好了,酸轻了;冲得比上杯慢一点,床面平。"
- **✅ 必须**:确认梯度向好;**同方向继续、步长收小**;只给研磨一个动作;回指上一杯。
- **可接受动作(加分)**:先问一句"这杯算到位/满意了吗"再决定继不继续。
- **❌ 绝不**:一次动多根轴;不回指上一杯;丢出一份大师配方。
- **设计说明**:E6(舌头与客观**一致**)和 E4(两者**打架**)形成对照——这个对照本身验证 agent 真的在用客观信道,而非摆设。

---

## 六、冷启动静态自检(pre-check 分支)

### E7 — 养豆不足 → 先告知、别急着归咎手法
- **场景**:冷启动,浅焙,**烘焙日期是昨天**(养豆严重不足)。
- **✅ 必须**:命中开方前自检,告知**排气旺、萃取不稳**,这阶段的不稳**不一定是手法问题**;可给起点配方但**附此前提、降低对前几杯的解读权重**。
- **❌ 绝不**:无视烘焙日期,当正常豆直接进调研磨流程。
- **变体(同分支)**:把烘焙日期换成"烘后约40天"→ 必须提示豆可能已衰减、风味平淡别归咎手法。
- **防的后门**:E5 在第12杯触到陈化,但没测**开局**的 pre-check;此 case 专测静态排查这条分支被不被触发。

### E7c — 未知烘焙日期 → 低置信冷启动 + 排气信号 validation probe
- **归属**:冷启动静态自检 / bag-level uncertainty routing。
- **场景**:
  1. Turn 1 冷启动:V60、浅焙、粉量15g、锥刀电动磨、当前研磨像粗砂糖,但用户不知道烘焙日期,包装上也找不到。
  2. Turn 2 第一杯后:闷蒸气泡很多、粉床明显鼓、流速忽快忽慢;味道不稳定、有点酸空;床面还算平,杯壁没挂粉环。
- **✅ Turn 1 必须**:接受未知烘焙日期为合法冷启动状态,继续给浅焙 V60 seed;调用 `start_bag(roast_age_status="unknown")`,不传 `roast_days_ago`;bag 写入 `roast_age_status=unknown`、`roast_date=null`、`bean_age_days=null`、`bean_age_band=null`、`flags` 含 `roast_age_unknown`/`low_confidence_cold_start`、`bean_age_hypothesis=uncertain`、`bean_age_evidence_status=no_signals_yet`;明确低置信提示,冻结手法,本版仍只调研磨。
- **✅ Turn 2 必须**:把排气/流速不稳记为当杯 observation,只更新假设为 `bean_age_hypothesis=possibly_under_rested`、`bean_age_evidence_status=supporting_single_direction`;调用 `record_cup(turn_type=probe,decision=探针,flags_asserted=["degas_signals_observed"],confidence=low|medium)`,不带 `direction`/`step`/`terminate_reason`;发起 validation probe:下一杯研磨/水温/粉量/比例照旧,低扰动复现,观察流速稳定后酸空是否仍稳定出现。
- **❌ 绝不**:把烘焙日期当 blocking requirement;编造/默认 `roast_days_ago=0/7/14`;把 unknown 当 fresh;第一杯见排气就写死 `under_rested`;把酸空直接判欠萃并 `direction=finer`;把不稳定直接归咎手法;解冻水温、粉量、比例或手法。
- **防的后门**:E7/E7c 形成 known-risk / unknown-risk 对照。E7a/E7b 是已知日期命中 pre-check;E7c 是 ground truth 缺失时把"不知道"建模成 first-class uncertainty state,保护 hill-climbing 的梯度可读性。

---

## 七、终止的三条分支(E5 只摸了一条,补齐另两条)

### E8 — 用户满意 → 干净收手
- **场景**:第4杯。
- **用户报告**:"这杯我挺满意的,挺好喝。"
- **✅ 必须**:**宣布研磨这根轴已调好、停手**;可一句话提及后续还有水温/手法可优化,但不强推。
- **❌ 绝不**:继续"我们再磨细一格试试";过度优化把满意的杯子调坏。

### E9 — 再调就会过萃 → 主动回退并停
- **场景**:第5杯,前几杯一路磨细、上一杯最好;这一杯又磨细后**开始发苦/口腔发干**。
- **用户报告**:"比上杯稍微发苦了、口腔有点干;其实上一杯更好喝。"
- **✅ 必须**:识别**已越过最优点**;**回退到上一杯那个更好的研磨设置**并**宣布收敛/停手**(再磨细会过萃)。
- **❌ 绝不**:继续磨细;无视"上一杯更好"这条信息。
- **设计说明**:与 E8(满意而停)区分——这是"再调会变坏而停",测的是"认峰回退"。

### E5 — 移动山顶 / 陈化(plateau 的欠定归因)
- **场景**:第12杯,**烘后约35天**(锚烘焙日期,非开封天数)。
- **用户报告**:"连续两杯都没改善;而且**香气明显掉了、有点纸板感、整体变平淡**。"(陈化专属风味词,与酸/苦的萃取轴不同类)
- **✅ 必须**(按动作判):指出 plateau 在"轴到顶"与"豆陈化"之间**本就欠定/模糊**,把**两种归因都点出**;并明确——**无论哪种,继续磨细都救不了**(轴到顶→磨细过萃;陈化→磨细补不回流失的香气)→ **别让用户继续磨细**。
- **结构化 gold**:`turn_type=terminate` + `decision=停手` + `terminate_reason=plateau_ambiguous`;`direction` 与 `step` 必须为空/不传。若话术说停手、结构化却写 `adjust`/`finer`/`+1格` = FAIL。
- **❌ 绝不**:机械套"连续两次无改善→宣布到顶"而不想陈化;反向一口咬定"是豆老了"往豆子上甩锅(同样是过度自信);继续让用户磨细。
- **防的后门**:加入陈化**专属风味词**(纸板感/香气掉),让"是不是豆老了"从瞎猜变成有据可依;gold 奖励的是**动作(别再磨细+点出模糊)**,不是某个单一诊断。

---

## 八、对抗样本(守住"你不是什么")

### E10 — 用户索要"完美配方" → 扛住,不退化成查表
- **场景**:任意,用户拒绝走流程。
- **用户报告**:"别问那么多了,直接给我一个完美配方,我照着冲就行。"
- **✅ 必须**:**守住立场**——说明不存在一份对"你这包豆/你家水/你的手"通用的静态完美配方,价值在于陪你收敛到**你这杯**;邀请进入循环(给起点 seed + 第一个调整)。仍然是个 agent。
- **❌ 绝不**:直接甩一份大师配方就结束;放弃收敛框架退化成配方数据库。
- **防的后门**:这正是 instruction"你不是什么"那段的命根子,值得一个**专门** case,而不只写在 E6 的 ❌ 里。

---

## 九、口味层孪生(E11a / E11b)· 萃取毕业 → 偏好定位 probe → 双分支

> **归属**:Taste Diagnostician(SPEC §2.2)· EDD 新增。**补的盲区**:前面 14 条几乎全在萃取层;口味层(萃取已收敛、残余抱怨是主观偏好)是暗区,也是 §2.2 命根子的镜像危险带。
> **判别力**:E11a / E11b **共享完全相同的开局**,gold 仅在「用户对探针的回答」后分叉,且**同一个『换豆』动作一对一错**(E11a 换豆=对,E11b 换豆=错)。靠「酸→换豆」反射蒙的 agent 两条都换 → E11b 当场露馅(总则#3 孪生对照)。没有捷径能同时蒙对两条。

### 共享开局(E11a / E11b 输入完全相同)
- 浅焙,已冲数杯,**萃取已收敛**。
- 客观四项全到位:vs_prev **无变化** · 流速 **正常** · 床面 **平** · 收尾 **化甜回甘**(萃取到位签名;过萃签名=舌根滞苦/焦木/空洞+流速慢,本开局已关掉)。
- 用户本杯唯一新信息:「太酸了,我不太喜欢」——**无任何偏好定位信息**(不知是『讨厌果酸品类』还是『爱、但要更圆润』)。

### 第一动作 gold(E11a / E11b 共享、必须完全相同)
| 字段 | gold |
|---|---|
| `turn_type` | `probe` |
| `gradient` | `已收敛` |
| `decision` | `探针` |
| `confidence` | `high` |
| `flags_asserted` | `[preference_unspecified]` |
| `rationale` | 萃取四项到位+流速正常+床面平+收尾化甜 → 萃取毕业;残余酸属口味层非欠萃;偏好未定位 → 探针定位,不假设。 |

> **`confidence: high` 不是笔误**:对「该 probe」高把握(萃取毕业有四项硬证据)。不确定性不在判断里,在**偏好数据**里,由 `preference_unspecified` 单独承载——**认知边界(可不可判定)≠ 校准边界(多有把握)**:这里是认知边界(偏好物理上还没表达成形),正确标出,而非低 confidence 瞎猜。
> **评分(判动作不判话术)**:probe 这一轮**只验 `turn_type:probe` + `flags_asserted:[preference_unspecified]`,不验探针话术**。语义须二选一定位偏好(不爱风格本身 / 爱但想更厚),话术不限。
> **可接受原因集合**:(1) 识别萃取已毕业;(2) 残余酸归口味层非萃取缺陷;(3) 偏好未定位 → 必须 probe,不替用户拍。
> **gate(任一即 fail)**:任何 `direction:finer`(萃取已毕业,磨细=萃死好浅焙,§2.2 命根子)/ 不 probe 直接 `terminate_reason:flavor_mismatch`(酸→反射换豆)/ `decision:转轴` 走萃取内换轴 / probe 探**错对象**(去 probe 流速/床面/研磨而非偏好)。

### E11a · 第二杯:用户答「对,我就是不爱这种酸」
| 字段 | gold |
|---|---|
| `turn_type` / `decision` | `terminate` / `停手` |
| `terminate_reason` | `flavor_mismatch`(萃取毕业、口味层不匹配,**可处理**) |
| `flags_asserted` | `[]`(偏好已定位) |
| 下游 | 转 **Bean Scout** 换品类 |
| `rationale` | 偏好定位为「不爱果酸风格本身」;冲煮端改不了豆的风味取向 → 出口在选豆层。 |

> E11a 是露骨 case(用户已明说),单独看谁都能蒙对 → **必须靠 E11b 对照才有判别力**。
> **gate**:此时仍 `finer` / 萃取内 `转轴` = fail;套 `[limitation_noted]` 装「brew 端还能救」= fail(不爱品类 brew 救不了,误把 E11b 的解贴到 E11a)。

### E11b · 第二杯:用户答「我喜欢这个酸,但想更厚一点」★ 命门
> 用户**明说爱这个酸**。「酸=口味=换豆」反射的 agent 会在这里**把用户喜欢的好豆换掉**(§2.2 命根子的镜像)。真懂的认出「萃取毕业 + 偏好=爱、要更厚」,绝不换豆。

| 字段 | gold |
|---|---|
| `turn_type` / `decision` | `terminate` / `停手` |
| `terminate_reason` | `taste_unaddressable`(萃取毕业、残余在口味层、**本版工具不可处理**;**绝不可填 `flavor_mismatch`**——语义相反:那是可处理/换豆能解) |
| `flags_asserted` | `[limitation_noted]` |
| 下游 | 指向 brew 端三杠杆(升温 / 延长接触 / 提粉量提浓度)作为**版本外**出口;**本版不开、不执行** |
| `rationale` | 偏好=爱此风格、要更厚;软化酸感的合法杠杆在 brew 端,但三者均越出本版单轴范围 → 诚实终止、指版本外出口,不换豆、不磨细。 |

> **可接受原因集合**:识别(a)偏好是「爱、要更厚」非「不爱品类」;(b)正确杠杆在 brew 端;(c)brew 端本版冻结 → 诚实 `limitation_noted` 终止 + 指版本外出口。
> **gate(任一即 fail)**:`terminate_reason:flavor_mismatch` 或「转 Bean Scout 换豆」(换掉用户喜欢的好豆,本条最严重的假绿)/ `direction:finer`(萃取已毕业)/ **擅自提粉量/动比例轴去「帮调厚」**——比例轴是冻结轴,越界解冻=fail。**本版口味层是「会收手的诊断器」,不是「会陪你调到满意的教练」。**

### E11c / E11d — 「不甜」镜像入口 · admission gate twin

> **归属**:E11b 前置 admission gate。**核心判断**:「不甜」不是自动进入口味层的证据;只有「有回甘 + 喜欢这个酸 + 想更厚」才允许进入 E11b / `taste_unaddressable`。若「不甜」伴随寡淡、没余味、酸压甜,则必须退回萃取层。
> **SPEC 回接**:这是 SPEC §2.2 Taste Diagnostician 的入口消歧:把用户主观词「不甜」消歧成下一步动作,而不是关键词反射;同时守 SPEC §2.4 的 handoff guardrail:口味层必须在 admission 通过后才成立。

#### Failure mode
Agent 看到用户说「不甜」,直接解释成「喜欢这个酸但想更厚」,误触发 `taste_unaddressable + limitation_noted`,把本该继续诊断的萃取层债务包装成「本版工具不可处理」。

#### Why this is a twin pair
这不是单个 negative case,而是一组 twin:
| 入口词 | Probe 后证据 | 正确分支 |
|---|---|---|
| 「不甜」 | 寡淡、没余味、酸压甜 | 退回萃取层 |
| 「不甜」 | 有回甘、喜欢这个酸、想更厚 | E11b / `taste_unaddressable` |
> **判别力**:两个 case 共享同一个「不甜」入口,gold 只在用户回答反向探针后分叉。靠「不甜 → taste_unaddressable」或「不甜 → finer」的反射都无法同时过两条。

#### 共享第一轮:用户说「不甜」,但 admission 未确认
- **场景**:浅焙,已冲数杯,表面上接近收敛;用户仍反馈「不甜」。
- **用户报告**:「还是不甜;酸挺明显,但我说不清是寡淡没余味,还是有回甘但被酸盖住。」
- **✅ 必须**:先做**反向探针**,不能直接进入口味层,也不能直接调参。probe 语义要能区分「寡淡、酸完没余味」vs「有回甘、只是被酸盖住、想更厚一点」;不判固定话术。

| 字段 | gold |
|---|---|
| `turn_type` | `probe` |
| `decision` | `探针` |
| `gradient` | `info_insufficient` / 任意非 `已收敛` |
| `terminate_reason` | 空 |
| `flags_asserted` | 包含 `info_insufficient`;不得包含 `limitation_noted` |
| `direction` | 空 |
| negative gate | 不得 `direction=finer`;不得含 `[limitation_noted]`;建议不得含 `preference_unspecified` |

> **Contract note**:不新增 `admission_uncertain` / `extraction_uncertain` flag。Admission uncertainty 用 `gradient != 已收敛` 表达;这轮尚未确认萃取毕业资格,本质是信息不足,所以 E11c/E11d 第一轮用 `[info_insufficient]`,不同于 E11a/E11b 已毕业后的 `[preference_unspecified]`。
> **评分**:自定义 metric 只判结构化字段,不判 probe 话术;probe 话术只要求语义能区分「寡淡没余味」vs「有回甘但被酸盖住」。
> **gate(任一即 fail)**:`gradient=已收敛` / `terminate_reason=taste_unaddressable` / `terminate_reason=flavor_mismatch` / 转 Bean Scout 换豆 / 直接磨细 / 擅自提粉量、水温、比例轴 / 带 `[limitation_noted]` / 误标 `[preference_unspecified]`。

#### E11c · 第二轮 negative:用户确认「寡淡、没余味、酸压甜」
- **用户回答**:「更像寡淡、没什么余味,酸把甜压没了,不是那种酸后会回甘的感觉。」
- **✅ 必须**:识别这条输入破坏 E11b admission,应该**退回萃取层**,而不是进入 `taste_unaddressable`。本 case 的目的不是新增 brew 调参能力;此分支仍只回到萃取层的研磨诊断。

| 字段 | gold |
|---|---|
| `turn_type` | `adjust` |
| `decision` | 退回萃取层 / 继续萃取诊断 |
| `gradient` | 非 `已收敛` |
| `terminate_reason` | 空 |
| `direction` | `finer` |
| `flags_asserted` | 不含 `[limitation_noted]` |

> **gate(任一即 fail)**:`terminate_reason=taste_unaddressable` / `terminate_reason=flavor_mismatch` / 转 Bean Scout 换豆 / 带 `[limitation_noted]` / `direction=coarser` / 擅自提粉量、水温、比例轴。
> **Why this case matters**:它防止 agent 把「寡淡、没余味、酸压甜」这类欠萃证据误包装成「口味层无解」。这条 case 守的是 E11b 的 admission gate:输入不合格时,必须回流萃取层。

#### E11d · 第二轮 positive:用户确认「有回甘、喜欢酸、想更厚」
- **用户回答**:「其实是有回甘的,我也喜欢这个酸;只是酸太亮,甜感被盖住了,我想要更厚、更圆一点。」
- **✅ 必须**:识别这已经满足 E11b admission。用户不是不喜欢这支豆,而是喜欢这个酸、想要更厚。正确分支是 `taste_unaddressable`,因为合法杠杆在 brew 端,而本版冻结比例 / 水温 / 接触时间轴。

| 字段 | gold |
|---|---|
| `turn_type` | `terminate` |
| `decision` | `停手` |
| `terminate_reason` | `taste_unaddressable` |
| `flags_asserted` | `[limitation_noted]` |
| `gradient` | `已收敛` |
| `direction` | 空 |

> **gate(任一即 fail)**:`terminate_reason=flavor_mismatch` / 转 Bean Scout 换豆 / `direction=finer` / 继续 probe / 擅自提粉量、水温、比例轴 / 把「喜欢这个酸但想更厚」解释成「不爱果酸品类」。
> **Why this case matters**:它证明 agent 不是简单拦截所有「不甜」,而是能把「不甜」经 probe 正确放行到 E11b。与 E11c 成对后,系统必须同时做到:遇到「寡淡、没余味、酸压甜」时不进 E11b;遇到「有回甘、喜欢酸、想更厚」时进入 E11b;不把用户喜欢的好豆误换掉;不把版本外 brew 杠杆偷解冻。

### 口味层 `terminate_reason` 三分(已拍定 · 契约新增)
萃取毕业后用户仍有残余抱怨时,`terminate_reason` 互斥三支,靠「可否处理 / 处理在哪层」切开,合起来盖住「萃取没问题但用户没到满意」的全部出口:
| 值 | 语义 | 解在哪 | case |
|---|---|---|---|
| `satisfied` | 无残余抱怨 | — | E8 |
| `flavor_mismatch` | 口味层,**可处理** | 选豆层(换豆) | E11a |
| `taste_unaddressable` | 口味层,**本版工具不可处理** | brew 端但本版冻结 → 本版无解 | E11b |
> 三支两两不重叠,选错一 COUNT 即现形(总则:要 COUNT 的就枚举)。命名留痕:弃用过 `out_of_scope_brew`——它把语义重心错挂在「brew 轴」、易诱导 agent 去引导 brew;`taste_unaddressable` 重心在「口味层 · 本版够不着」,与 `flavor_mismatch` 成 addressable/unaddressable 干净对照。

### ⚠️ 版本边界注释 · E11b / taste_unaddressable
E11b 的 `limitation_noted` gate(判「提粉量 / 任何 brew 干预 = 错」)**绑定单轴版本**,非永久产品原则。
- 本版口味层 = 会收手的诊断器(萃取毕业即诚实终止,brew 端一律不碰)。
- `taste_unaddressable` 的「unaddressable」是**版本性**的:解在 brew 端,但比例轴/水温轴本版冻结 → 本版无解。
- ⚠️ 多轴 conductor 上线、比例轴解冻后,提粉量从「越界」变「正解」,E11b 此 gold **须重判**,`taste_unaddressable` 对该场景可能不再成立。
> 边界决策留痕:别让「本版冻结」被未来读成「agent 永远不该碰粉量」。(已同步 SPEC §6.6。)

---

## 十、萃取层 graduation gate:拦截欠萃伪装毕业 E12a / E12b

> **归属**:Extraction layer · graduation gate。
> **补的盲区**:E11 口味层以 `gradient=已收敛` 为前置真值,信任上游、不复核萃取毕业真假。本 case 专测上游有没有资格写下 `gradient=已收敛`。
> **核心风险**:四项看似全绿,但真实只是 underextraction plateau:`vs_prev 无变化` 是因为研磨轴到顶,`有一点甜 / 有一点回甘` 是相对最优,不是绝对萃取毕业。若上游误盖 `gradient=已收敛`,E11 会忠实信任,进而误判 `flavor_mismatch` / `taste_unaddressable` / 换豆。
> **判别力**:E12a / E12b 共享相似表面 token:`vs_prev 无变化`、流速正常、床面平、无挂粉环、有一点甜。区别只在证据充分性:E12a 缺少"轴到顶"的充分证据,所以 gold 是 probe;E12b 明确给出"轴到顶 + 绝对甜感仍弱",所以 gold 是 terminate。这样防止 agent 永远 probe 逃过该停手的 case,也防止 agent 永远 plateau 逃过信息不足的 case。

### 共享诱饵:四项看似全绿,但不是 E11 开局
- 浅焙,V60,锥刀磨,水温 / 比例 / 粉量 / 手法冻结,只调研磨。
- 前几杯一路从明显欠萃变好:酸从尖空变干净,流速从偏快变正常,床面从浅/不稳变平。
- 当前杯出现看似毕业的四项:`vs_prev 无变化`、流速正常、床面平、无挂粉环,并且用户说"有一点甜 / 有一点回甘"。
- **关键区别**:本 case 不得在 `session_input.state` 里预设 `gradient=已收敛`。E11 的 `gradient=已收敛` 是给定前提;E12 的 `gradient=已收敛` 是待审状态。若 agent 自己写成 `已收敛`,即 fail。

### E12a — 四项看似全绿,但绝对刻度不足 → 必须 probe,不得毕业
- **Failure mode**:agent 把"相对变好 + 四项看似正常"误读成"绝对萃取毕业",直接盖 `gradient=已收敛`,送入口味层。
- **场景**:浅焙,第5杯。前几杯一路磨细后明显变好,但还没有明确达到"酸能干净化甜、有持续回甘"的绝对刻度。当前杯与上一杯几乎无变化,客观信道看似稳定。
- **用户报告**:"这杯和上杯几乎没差。时间大概 2 分 35 秒,流速看起来正常,床面也平,杯壁没挂粉环。酸比最开始干净很多,不是那种酸完完全空掉的感觉,尾段也能尝到一点甜。但甜感不明显,我不确定是不是已经算酸甜平衡;整体还是偏薄,酸感好像还是比甜更突出。"
- **✅ 必须**:停在萃取层,不得宣布毕业;打一次"绝对刻度化甜探针",确认这点甜是"清楚盖过酸、喝完嘴里持续回甘",还是"只是比最开始好一点、努力才尝到一点甜"。
- **结构化 gold**:
  - `turn_type=probe`
  - `decision=探针`
  - `gradient != 已收敛`
  - `direction` 为空 / 不传
  - `step` 为空 / 不传
  - `terminate_reason` 为空 / 不传
  - `flags_asserted` 包含 `absolute_extraction_uncertain`
  - `flags_asserted` 不得包含 `preference_unspecified`
  - `confidence=medium` 或 `low` 均可;关键是承认 graduation evidence 不足
- **探针对象**:必须问萃取绝对刻度,不是问偏好。可接受问法:"这点甜是能清楚盖过酸、喝完嘴里还有持续回甘,还是只是比最开始好一些、需要努力才尝到一点点甜?整体是酸甜平衡,还是仍然酸压甜、偏薄?"
- **❌ 绝不**:`gradient=已收敛`;进入 preference probe;`flags_asserted=[preference_unspecified]`;`terminate_reason=flavor_mismatch` / `taste_unaddressable`;换豆 / 转 Bean Scout;满意停手;解冻水温、比例、粉量或手法作为本版 action。
- **防的后门**:四项全绿是诱饵;报告故意不给"甜感清楚盖过酸 / 明显持续回甘"的毕业证据。正确动作是先 probe 绝对刻度,而不是靠表面 token 伪造 `gradient=已收敛`。

### E12b — 四项看似全绿 + 到研磨极限 + 绝对甜感仍弱 → underextraction plateau
- **Failure mode**:agent 把"研磨轴到顶后的无变化"误读成"萃取已收敛",进入 E11 口味层。
- **场景**:浅焙,第6杯。前几杯一路磨细后相对变好,但最近两杯无改善;用户明确报告已经到最细可用位置,再细会堵、细粉多、流速开始不稳定。
- **用户报告**:"这杯和上杯还是几乎没差。时间大概 2 分 35 秒,流速正常,床面平,没挂粉环。酸比最开始干净很多,也能勉强尝到一点甜,但不是那种酸能干净化成甜、喝完嘴里明显回甘的状态。整体还是偏薄,酸还是压过甜。我的磨豆机已经到最细可用的位置了,再细就容易堵、细粉很多,流速会开始不稳定。"
- **✅ 必须**:识别为萃取层的 underextraction plateau / 研磨轴到顶但绝对萃取未毕业;本版单轴不能继续通过磨细解决。停在萃取层,不能进入 taste layer。
- **结构化 gold**:
  - `turn_type=terminate`
  - `decision=停手`
  - `gradient != 已收敛`
  - `direction` 为空 / 不传
  - `step` 为空 / 不传
  - `terminate_reason=axis_limit_underextracted`
  - `flags_asserted` 包含 `absolute_extraction_not_met`
  - `flags_asserted` 包含 `axis_limit_reached`
  - `flags_asserted` 不得包含 `preference_unspecified`
  - `flags_asserted` 不得包含 `limitation_noted`
  - `confidence=medium` 或 `high` 均可;关键是结构化停在萃取层
- **可接受说明,但不作为 action**:可以指出版本外可能存在 brew 端出口,例如升温、延长接触、调整比例;但本版冻结这些轴,不能执行。
- **❌ 绝不**:`gradient=已收敛`;`terminate_reason=satisfied` / `flavor_mismatch` / `taste_unaddressable`;换豆 / 转 Bean Scout;继续 `direction=finer`;给 `step=+1格` 或任何继续磨细动作;解冻水温、比例、粉量或手法作为本版 action。
- **防的后门**:`vs_prev 无变化` 在这里不是收敛证据,而是 axis limit 信号;"有一点甜"不是毕业证据,而是相对最优证据。只有同时读到"绝对甜感不足 + 到最细可用 + 再细不稳",才能 terminate 为 `axis_limit_underextracted`。

### E12a / E12b 与 E11 的边界
| 维度 | E11 | E12 |
|---|---|---|
| 测什么 | Taste layer 在"已毕业"前提下是否正确偏好消歧 | Extraction layer 有没有资格写 `gradient=已收敛` |
| `gradient=已收敛` | gold 前提 / gold 输出 | hard fail |
| 四项全绿 | 给定真值 | 诱饵,需要审查是否只是相对最优 |
| probe 对象 | 用户偏好:不爱酸 vs 爱但想更厚 | 绝对萃取刻度:甜是否清楚盖过酸 |
| `preference_unspecified` | E11 第一轮 gold flag | E12 forbidden flag |
| `flavor_mismatch` | E11a gold | E12 hard fail |
| `taste_unaddressable` | E11b gold | E12 hard fail |
| 换豆 | E11a 可对 | E12 必错 |
> **一句话边界**:E11 测 downstream trust;E12 测 upstream qualification。E11 不负责判断毕业真假;E12 负责防止 upstream 伪造 graduation signal。

### E12 contract 注释
E12b 需要新增一个 extraction-layer `terminate_reason`:
| 值 | 语义 | 层级 | case |
|---|---|---|---|
| `axis_limit_underextracted` | 当前研磨轴到顶,但绝对萃取仍未毕业;本版单轴无法继续有效推进 | extraction layer | E12b |

不要复用 `taste_unaddressable`。`taste_unaddressable` 属于萃取毕业后的口味层出口,语义是"用户偏好在本版工具范围内不可处理";E12b 的语义是"萃取层尚未毕业,但研磨轴已经到顶"。这两个 failure surface 不同,混用会污染 E11 的三分契约。

E12a / E12b 建议新增 flags:
| flag | 语义 | case |
|---|---|---|
| `absolute_extraction_uncertain` | 表面接近毕业,但缺少绝对刻度证据,需要继续 probe | E12a |
| `absolute_extraction_not_met` | 明确未达到绝对萃取毕业刻度 | E12b |
| `axis_limit_reached` | 当前研磨轴已到可用极限,继续同向会带来堵塞 / 细粉 / 不稳定风险 | E12b |

---

## 十一、B 档后 7 条高危 live 回归观测(现象记录)

> **来源**:实现侧 live 跑真模型(`gemini-2.5-flash`)后的观察记录。
> **性质**:现象记录,供判断侧追溯。不把两处瑕疵归因给 B 档,也不倒推诊断策略。

### 背景
- B 档落地后,重跑 7 条高危萃取 case:`E1b` / `E1c` / `E2b` / `E3` / `E3b` / `E5` / `E10`。
- 7 条在**动作层 rubric**上全过:未毕业开局没有被口味层守卫误接走;酸收尾探针、欠萃磨细、涩判别、砍豆机双峰条件化、plateau 欠定、扛住查表行为照旧。
- 这 7 条此前不是 S1 已绿的那批(`E1a` / `E2a` / `E4` / `E6` / `E7` / `E8` / `E9`),因此下面两处是首次观测到的既有萃取层瑕疵,不是 B 档引入。

### 观测一 · E3 砍豆机终止枚举缺口
- **场景**:冷启动,砍豆机(blade),开局症状"又酸又苦"。
- **动作层表现**:归因正确——双峰分布(细粉过萃发苦 + 粗块欠萃发酸),归因到磨豆机本身,不甩锅注水/swirl,建议换锥/平刀。
- **结构化瑕疵**:live 跑曾出现第一杯 `terminate` 但 `terminate_reason=plateau_ambiguous`。该枚举语义是移动山顶/陈化欠定,与"硬件让当前轴反馈不可靠"不匹配。
- **判断侧决策**:新增 `terminate_reason=axis_unreliable`。拒绝复用 `plateau_ambiguous`,也拒绝继续调研磨。
- **当前状态**:已更新 contract/rubric/instruction,并新增 E3/E3b 自动 eval artifact:`agents/hello_agent/e3_grinder.evalset.json` + `agents/hello_agent/e3_metric.py` + `agents/hello_agent/e3_test_config.json`。

### 观测二 · E5 plateau 话术与结构化落账矛盾
- **场景**:第12杯,烘后约35天,连续两杯无改善 + 香气掉/纸板感。
- **动作层表现**:正确点出"轴到顶"与"豆陈化"两种归因都可能,并说明无论哪种继续磨细都救不了。
- **结构化瑕疵**:live 跑曾出现话术说停手,但 `record_cup` 写成 `turn_type=adjust` + `direction=finer` + `step=+1格`,同条又带 `decision=停手` / `terminate_reason=plateau_ambiguous`。
- **判断侧决策**:这属于 record contract integrity bug,不是诊断策略变更。E5 正确记录为 `turn_type=terminate` + `decision=停手` + `terminate_reason=plateau_ambiguous`,且 `direction`/`step` 为空。
- **当前状态**:已在 `record_cup` 写入前加入 invariants,矛盾记录直接拒绝写入;并新增 E5 自动 eval artifact:`agents/hello_agent/e5_plateau.evalset.json` + `agents/hello_agent/e5_metric.py` + `agents/hello_agent/e5_test_config.json`。

---

## 缺口看板(后续可继续补)

- [x] 冷启动信息不全(用户不知道烘焙日期)时的稳健行为(E7c 已编码)
  - 数据:`agents/hello_agent/e7c_unknown_roast_age.evalset.json`(Turn 1 unknown cold start / Turn 2 degas validation probe)。
  - 评分:`agents/hello_agent/e7c_metric.py::e7c_unknown_roast_age_gate`。Turn 1 只判 `start_bag` 是否走 `roast_age_status=unknown` 且不传 `roast_days_ago`;Turn 2 只判 `record_cup` 是否为 probe + `degas_signals_observed`,并硬禁继续磨细/终止出口。
  - 配置:`agents/hello_agent/e7c_test_config.json`。
  - 本地 contract 验证:unknown 不生成 `roast_date`/`bean_age_days`/`bean_age_band`;排气信号只更新 `bean_age_hypothesis=possibly_under_rested`,不改写 bean age fact。
  - ✅ 端到端结果(2026-07-01):`agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1782911320.2279649.evalset_result.json` → `Tests passed: 1`, `Tests failed: 0`。
- [ ] 用户一次报告多个互相矛盾的词(超出 E1b 的二选一)
- [x] 口味层诊断出口已补(E11 三分:`satisfied`/`flavor_mismatch`/`taste_unaddressable`);brew 端**实际微调**仍版本冻结(见 §九 + SPEC §6.6)
- [x] 把 §九 编码为 ADK `*.evalset.json` + 确定性自定义 metric,接入 `adk eval` 自动回归
  - 数据:`agents/hello_agent/e11_taste_twin.evalset.json`(4 case × 2 轮;E11a/E11b 开局精度由 `session_input.state` 预设——末杯 `gradient=已收敛` 触发 agent.py 第-1步守卫;E11c/E11d 共享「不甜」admission gate 入口,第一轮不得预设 `gradient=已收敛`)。
  - 评分:`agents/hello_agent/e11_metric.py::taste_layer_gate`(自定义 metric)。**只判 record_cup 结构化字段**(turn_type/decision/gradient/terminate_reason/direction/flags_asserted),**不判探针话术/rationale**(§5#2 判动作不判说法)。metric 报 `action_path_pass` / `taste_gate_state_pass` 两个子分数;overall 必须两者都过。E11c/E11d 第一轮用 `gradient != 已收敛` 表达 admission 未确认,并要求 `flags_asserted=["info_insufficient"]`、不得误标 `preference_unspecified` / `limitation_noted`;E11c negative 第二轮要求 `direction=finer` 且不得带 `limitation_noted`;E11d positive 第二轮要求 `taste_unaddressable + limitation_noted`。E11a/E11b 若使用 `preference_unspecified` / `flavor_mismatch` / `taste_unaddressable`,则 `gradient` 必须是携带的萃取层状态 `已收敛`,不能降级成当前主观 delta `没变`。
  - 配置:`agents/hello_agent/e11_test_config.json`(criteria → custom_metrics)。
  - 跑:`PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval agents/hello_agent agents/hello_agent/e11_taste_twin.evalset.json --config_file_path agents/hello_agent/e11_test_config.json`。
  - ⚠️ 已离线验证:E11a/E11b/E11c/E11d gold 自比全 PASSED;磨细/直接终止/误填 `flavor_mismatch`/漏 `limitation_noted` 等结构化错误会 FAILED;仅改 rationale 仍 PASSED。**端到端真跑需 gemini API 配额 + 上游可靠置位 `gradient=已收敛`**(handoff §6#1)。
  - ✅ 最小 live 复跑(2026-07-02):`agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_ab_only_1782977662.0231612.evalset_result.json` → E11a/E11b `Tests passed: 2`, `Tests failed: 0`;两条的 `action_path_pass=1.0`、`taste_gate_state_pass=1.0`。
  - ⚠️ evalset 里 `roast_date` 是固定 ISO 日期;跑得太晚豆龄会漂进 stale(只多派生 `bean_aged` 旗标,不影响守卫与 E11 gold)。
- [x] 把 E5 plateau 结构化终止记录编码为 ADK evalset + 确定性 custom metric
  - 数据:`agents/hello_agent/e5_plateau.evalset.json`(第12杯连续无改善 + 香气掉/纸板感)。
  - 评分:`agents/hello_agent/e5_metric.py::e5_plateau_contract_gate`。只判最后一次 `record_cup` 的结构化字段:`turn_type=terminate`、`decision=停手`、`terminate_reason=plateau_ambiguous`,且 `direction`/`step` 为空;话术不计分。
  - 配置:`agents/hello_agent/e5_test_config.json`。
- [x] 把 E3/E3b 砍豆机条件化归因编码为 ADK evalset + 确定性 custom metric
  - 数据:`agents/hello_agent/e3_grinder.evalset.json`(砍豆机 vs 锥刀,同样"又酸又苦")。
  - 评分:`agents/hello_agent/e3_metric.py::e3_grinder_contract_gate`。E3 必须 `terminate_reason=axis_unreliable`;E3b 不得使用 `axis_unreliable` 或直接停手。
  - 配置:`agents/hello_agent/e3_test_config.json`。
- [x] **【萃取层 · 拦截欠萃伪装 · E12 已编码】** 四项全绿但实为**欠萃 plateau**(vs_prev 无变化是因**到研磨极限**、化甜是**相对最优**而非绝对到位)→ gold:agent **不得直接盖 `gradient:已收敛` 进口味层**;E12a 继续打「**绝对刻度化甜探针**」,E12b 识别为 `axis_limit_underextracted`。接 E1/E4 萃取线、**不进 E11**;是萃取层↔口味层交接点的"哑弹拆除器",被 SPEC §2.4 输入契约的 ⚠️ 指派。
  - 数据:`agents/hello_agent/e12_graduation_gate.evalset.json`(E12a probe / E12b axis-limit terminate;开局不预设 `gradient=已收敛`)。
  - 评分:`agents/hello_agent/e12_metric.py::graduation_gate`。只判 `record_cup` 结构化字段;两条都硬禁 `gradient=已收敛`、口味层 flag/reason、继续磨细。
  - 配置:`agents/hello_agent/e12_test_config.json`。
  - 跑:`PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval agents/hello_agent agents/hello_agent/e12_graduation_gate.evalset.json --config_file_path agents/hello_agent/e12_test_config.json`。
  - ✅ 端到端结果(2026-07-01):`agents/hello_agent/.adk/eval_history/hello_agent_e12_graduation_gate_1782886982.494529.evalset_result.json` → `Tests passed: 2`, `Tests failed: 0`。
    - E12a 实际落账:`turn_type=probe`,`decision=探针`,`gradient=没变`,`flags_asserted=["absolute_extraction_uncertain"]`,且无 `direction`/`step`/`terminate_reason`。
    - E12b 实际落账:`turn_type=terminate`,`decision=停手`,`gradient=没变`,`terminate_reason=axis_limit_underextracted`,`flags_asserted=["absolute_extraction_not_met","axis_limit_reached"]`,且无 `direction`/`step`。
  - 认证排障留痕:本地 ADK 2.3.0 / google-genai 2.10.0 下,传统 `AIza...` key 走 Gemini Developer API 可直接跑通;AI Studio 新 `AQ...` auth key 需走 `GOOGLE_GENAI_USE_VERTEXAI=true` + Agent Platform API / billing / service-bound API key 配套,否则会分别遇到 `401 UNAUTHENTICATED`、`SERVICE_DISABLED`、`BILLING_DISABLED` 或 `API_KEY_SERVICE_BLOCKED`。
- [x] **【E11 口味层 · admission gate twin 已编码】** E11b 前置消歧:用户报「不甜」要区分 **真欠萃**(违反开局前提 → 退回萃取层,E11c)vs **回甘被酸盖住**(符合开局 → 走口味层,E11d);用专家「**反向探针:寡淡没余味 vs 有回甘被酸盖住**」。这是 E11b「爱这个酸但要更厚」的镜像入口,已并入 `agents/hello_agent/e11_taste_twin.evalset.json` + `agents/hello_agent/e11_metric.py`。
