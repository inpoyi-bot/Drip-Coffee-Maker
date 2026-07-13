## Codex Task Card · Ending 屏 happy-path 收束态

**归属**:轨迹屏(Trajectory view)的 `terminate_reason=satisfied` 收束态。非独立 tab、非新页面。

### Intent

当一包豆的收敛循环以 `satisfied` 终止时,轨迹屏顶部渲染一个收束态,把"用户在这次收敛里获得的判断力"显性化(主),并给出可复现的收敛坐标(辅)。**这是展示层的确定性派生,不是 agent 生成、不写任何记录。**

### Input contract

只读现有轨迹数据,不新增后端字段、不新增 record。假定前端已能拿到这包豆的 `cups` 数组,每条含(以下为读取依赖,字段名以实际 schema 为准,不一致时 halt 见下):

- `turn_type`: `seed|adjust|probe|terminate`
- `gradient`: `变好+同向|变坏|没变|info_insufficient|已收敛`
- `direction`: `finer|coarser|null`
- `terminate_reason`: `satisfied|...`(本卡只处理 `satisfied`,其余 reason 一律不进本收束态,留待后续卡)
- grind 相对描述字段(如"较基准细 N 格")

**Mock data-1(用这条 4 杯 clean-arc 自测,不要等真实后端):**

```
[
 {cup:1, turn_type:'adjust', gradient:'变好+同向', direction:'finer', grind:'较基准细 2 格'},
 {cup:2, turn_type:'adjust', gradient:'变好+同向', direction:'finer', grind:'较基准细 4 格'},
 {cup:3, turn_type:'adjust', gradient:'变好+同向', direction:'finer', grind:'较基准细 6 格'},
 {cup:4, turn_type:'terminate', terminate_reason:'satisfied', grind:'较基准细 6 格'}
]
```

(注:seed 杯若存在于真实数据,遍历时跳过;mock 里省略。)

**Dirty-arc mock-2(6 杯,含过冲回退 + 探针)**,加进 Input contract 的自测数据:

```
[
 {cup:1, turn_type:'adjust', gradient:'变好+同向', direction:'finer', grind:'较基准细 2 格'},
 {cup:2, turn_type:'adjust', gradient:'变好+同向', direction:'finer', grind:'较基准细 4 格'},
 {cup:3, turn_type:'adjust', gradient:'变坏',      direction:'coarser', grind:'较基准细 3 格'},
 {cup:4, turn_type:'probe',  gradient:'info_insufficient', grind:'较基准细 3 格'},
 {cup:5, turn_type:'adjust', gradient:'变好+同向', direction:'finer', grind:'较基准细 4 格'},
 {cup:6, turn_type:'terminate', terminate_reason:'satisfied', grind:'较基准细 4 格'}
]
```

**期望叙事输出**(拐点不折叠、连续相同折叠):

> 这包豆你走了 6 杯。认出欠萃 → 连续两次方向对、继续推进 → 这一步过头了,回退一格 → 线索还不够,再进一步探一探 → 方向对了,继续推进 → 到位收手。下次换一包新豆,你也知道该怎么读、怎么调、什么时候停了。

### Expected behavior

**进入条件**:末杯 `terminate_reason === 'satisfied'` 才渲染本收束态。否则不渲染(不报错,静默跳过——其他 reason 是后续卡的事)。

**布局,从上到下三段:**

**① 收束卡**(视觉权重内部铁律:块1 > 块2 > 块3)

- **块1 能力叙事(主,最大视觉权重)**:遍历 cups(跳过 seed),每杯按下表映射成短语,应用折叠规则,拼成叙事。
    - 映射表:
        
        |条件|短语|
        |---|---|
        |首个 `adjust`(欠萃起点)|认出欠萃|
        |`gradient=变好+同向`|方向对了,继续推进|
        |`gradient=变坏` & `direction=coarser`|这一步过头了,回退一格|
        |`turn_type=probe`|线索还不够,再进一步探一探|
        |`terminate_reason=satisfied`|到位收手|
        
    - **折叠规则**:连续且完全相同的短语折叠计数(如两次"方向对了,继续推进"→"连续两次方向对、继续推进")。**拐点(过头回退、探针)永不折叠、永不省略。**
    - 模板:`这包豆你走了 {N} 杯。\n{短语用 → 连接}。\n下次换一包新豆,你也知道该怎么读、怎么调、什么时候停了。`
    - clean-arc 期望输出:`这包豆你走了 4 杯。认出欠萃 → 连续两次方向对、继续推进 → 到位收手。下次换一包新豆,你也知道该怎么读、怎么调、什么时候停了。`
- **块2 收敛坐标(辅,从属视觉权重)**:读 terminate 杯 grind 相对格数。文案:`你这包豆的落点:研磨 {grind}。下次开同款豆,直接从这儿开始,不用再从大师配方那套从头试。`
- **块3 收口(最轻,无按钮)**:静态文案:`这次我们只调了「研磨」这一根轴,它到位了。水温、注水手法也还能再调——不过那是后面的事,现在不用急。`

**② 轨迹渲染图**:现有收敛曲线组件,原样放在收束卡下方。

**③ 完整逐杯记录**:默认折叠,入口"查看完整 {N} 杯记录 ▾"放在轨迹图下方;展开后是现有逐杯记录组件,**一条不删**。

### Must-not(硬约束——交卡前重点审这段)

1. **不写任何记录**:块1 叙事是前端派生的只读视图,禁止落进 record_cup、禁止新增聚合记录、禁止改动任何持久化数据。
2. **块2 禁绝对参数**:只渲染 grind 相对格数。**禁止**渲染或凭空生成水温(°C)、粉水比(1:15)、克数等任何绝对参数。若数据源混入绝对参数,只取相对 grind、其余丢弃。
3. **折叠只收纳、不摘要**:逐杯历史折叠是视觉默认态,展开后必须**完整、逐杯、一条不少**。禁止把历史压缩成摘要、禁止只保留部分杯、禁止丢弃任何一杯的细节。
4. **拐点永不抹平**:块1 叙事的折叠只作用于连续相同短语;过头回退、探针这类非单调步骤必须逐个如实出现,禁止为了叙事顺滑而合并或跳过。
5. **块3 无 CTA**:不加"开始调水温"之类的引导按钮,不强推下一轴。
6. **文案逐字锁定**:上面给的所有用户可见文案**逐字使用**,不要改写、不要"优化"、不要加 emoji。禁止出现"爬/hill-climb/收敛/带得走"等内部隐喻词。
7. **不生成、不调用模型**:块1 是确定性映射,禁止调用任何 LLM 来"生成"叙事。

### Halt protocol

- 若真实 schema 字段名与 Input contract 不符(如 `gradient` 取值不同、grind 字段结构不同)→ **停,报出实际字段结构,等确认**,不要自己猜映射。
- 若发现映射表覆盖不了某个真实出现的 per-cup 状态(happy path 里出现了表外组合)→ **停,报出该状态,等确认**,不要自造短语。
- 若 terminate_reason 有 `satisfied` 以外的值 → 本卡范围外,静默不渲染收束态即可,**不要**自行为其他 reason 编写出口。

### Review checklist(实现完我逐条验)

- [ ] 仅 `satisfied` 触发;其他 reason 不渲染、不报错
- [ ] 块1 由轨迹派生,mock 4 杯输出与期望文案逐字一致
- [ ] 折叠:连续相同折叠、拐点不折叠(拿 dirty-arc 6 杯再验一次)
- [ ] 块2 只有相对格数,全屏无任何绝对参数
- [ ] 视觉权重 块1>块2>块3,坐标卡未压过叙事
- [ ] 历史折叠可一键完整展开,逐杯无删减
- [ ] 无 record 写入、无 LLM 调用、无 CTA、无隐喻词
- [ ] 文案逐字与卡一致
