"""S2 记忆层:豆级轨迹的工具 + schema + 注入。

设计要点(和你逐轮敲定的):
- 一包豆 = 一个(持久化)session;轨迹存在 session state 里。
  state["bag"]  = 包级表头(冷启动写一次)
  state["cups"] = 每杯一条结构化记录(record_cup 追加)
  (user: 作用域留给将来的"用户级口味画像",本版不写)
- seed 配方 = 静态查找表(SPEC §6.5:商品化层用静态规则,不用 agent)。
- flags 分两类:agent 声明的(asserted) vs 工具从表头/豆龄派生的(derived),
  派生项不由 agent 经手,从结构上杜绝"step=+2格 却 hardware_unreliable"这类矛盾。
"""

from __future__ import annotations
from datetime import date, timedelta

# ── 静态规则:烘焙度 → 起点配方(SPEC §6.5 seed match) ──────────────
# 水温记基准值(数字),便于 baseline/actual 分开;比例记文本。
SEED = {
    "浅": {"ratio": "1:15~1:16", "temp_baseline_c": 93},
    "中": {"ratio": "1:15", "temp_baseline_c": 91},
    "深": {"ratio": "1:15", "temp_baseline_c": 89},
}

# 冻结的注水手法(整包不变,稳定信号)
POUR_METHOD = (
    "闷蒸:注入约2倍粉重的水,轻轻 swirl 让粉全湿,等约45秒。"
    "主注水:连续平稳注到目标克重,保持水位,不戳不大力搅。"
    "收尾:轻轻 swirl 找平床面,等滴尽。整包照抄、绝不改。"
)


def _bean_age_days(roast_date: str, on: date | None = None) -> int:
    """派生量:当前豆龄 = 今天 - 烘焙日期(每杯重算,它每天在长)。"""
    on = on or date.today()
    return (on - date.fromisoformat(roast_date)).days


def _bean_band(roast: str, age_days: int) -> str:
    """豆龄三档(驱动 seed 提示 + plateau 解读):
    under_rested(养豆不足)/ stale(过老)/ fresh(中段可用)。"""
    rest = 7 if roast == "浅" else 5          # 浅<7、中深<5 养豆不足
    if age_days < rest:
        return "under_rested"
    if age_days > 35:                         # 30~45 取代表值 35
        return "stale"
    return "fresh"


def _is_blade(grinder_type: str) -> bool:
    return "砍豆" in grinder_type or "blade" in grinder_type.lower()


def _has_value(value: str | None) -> bool:
    return value is not None and str(value).strip() != ""


def _validate_record_contract(
    *,
    turn_type: str,
    decision: str,
    direction: str,
    step: str,
    terminate_reason: str,
) -> None:
    """拒绝互相矛盾的结构化记录,避免污染后续梯度判断。"""
    errors: list[str] = []
    has_direction = _has_value(direction)
    has_step = _has_value(step)
    has_terminate_reason = _has_value(terminate_reason)

    if decision == "停手" or has_terminate_reason:
        if turn_type != "terminate":
            errors.append("decision=停手 或 terminate_reason 非空时,turn_type 必须是 terminate")
        if has_direction:
            errors.append("terminate 记录不能带 direction")
        if has_step:
            errors.append("terminate 记录不能带 step")

    if turn_type == "adjust":
        if has_terminate_reason:
            errors.append("adjust 记录不能带 terminate_reason")
        if not has_direction:
            errors.append("adjust 记录必须带 direction")

    if turn_type == "probe":
        if has_terminate_reason:
            errors.append("probe 记录不能带 terminate_reason")
        if has_direction:
            errors.append("probe 记录不能带 direction")
        if has_step:
            errors.append("probe 记录不能带 step")

    if errors:
        raise ValueError("record_cup contract violation: " + "; ".join(errors))


# ── 工具 1:冷启动登记表头 + 静态查 seed ─────────────────────────────
def start_bag(
    roast: str,
    roast_days_ago: int | None = None,
    dose_g: float | None = None,
    grinder_type: str = "",
    baseline_grind: str = "",
    roast_age_status: str = "known",
    tool_context=None,
) -> dict:
    """冷启动登记这包豆,并按烘焙度静态查出起点配方。问齐4项后调一次。

    Args:
        roast: 烘焙度,只接受 "浅" | "中" | "深"。
        roast_days_ago: 烘焙距今**天数**(用户说"8天前"就传 8)。已知时由工具换算成日期
            并存,**别让模型自己算日期**(模型不知道"今天",算出来会错)。未知时传 None 或省略。
        roast_age_status: "known" | "unknown"。未知时不生成 roast_date / bean_age_days / bean_age_band。
        dose_g: 粉量(克)。
        grinder_type: 磨豆机类型,如 "锥刀" | "平刀" | "砍豆机" | "不确定"。
        baseline_grind: 当前研磨刻度或描述(如"粗砂糖");砍豆机留空。
    """
    if dose_g is None:
        raise ValueError("start_bag requires dose_g")

    age_unknown = roast_age_status == "unknown" or roast_days_ago is None
    seed = SEED.get(roast, SEED["中"])
    blade = _is_blade(grinder_type)

    if age_unknown:
        roast_age_status = "unknown"
        roast_date = None
        age = None
        band = None
        bag_flags = ["roast_age_unknown", "low_confidence_cold_start"]
        bean_age_hypothesis = "uncertain"
        bean_age_evidence_status = "no_signals_yet"
    else:
        # 工具按可靠的"今天"算出烘焙日期并存;之后每杯据此重算豆龄(它每天在长)
        age = max(0, int(roast_days_ago))
        roast_date = (date.today() - timedelta(days=age)).isoformat()
        band = _bean_band(roast, age)
        bag_flags = []
        bean_age_hypothesis = band
        bean_age_evidence_status = "known_from_roast_date"

    # 豆龄三档 → 期望管理/提示(不自动改温;过老的升温只作可选一档由 agent 转告)
    advice = []
    if roast_age_status == "unknown":
        advice.append(
            "烘焙日期未知:豆龄 pre-check 不能高置信完成,先按低置信冷启动处理;"
            "前几杯若出现排气旺或流速不稳,先保护梯度可读性,别过早归咎手法。"
        )
    elif band == "stale":
        advice.append(
            f"豆龄约{age}天偏老,可能已衰减、风味偏平——别归咎手法。"
            "可选:在基准水温上温和+1~2°C榨残值(可能带苦),愿不愿试由用户定,别静默改。"
        )
    elif band == "under_rested":
        advice.append(
            f"豆龄仅约{age}天养豆不足,排气旺、萃取会不稳,前几杯信号别太当真;水温先别动。"
        )
    if blade:
        advice.append(
            "砍豆机:研磨轴本身不可靠(双峰分布),收敛标准放宽、期望降低;能换锥/平刀最好。"
        )

    bag = {
        "roast": roast,
        "roast_date": roast_date,
        "roast_age_status": roast_age_status,
        "bean_age_days": age,
        "bean_age_band": band,
        "flags": bag_flags,
        "bean_age_hypothesis": bean_age_hypothesis,
        "bean_age_evidence_status": bean_age_evidence_status,
        "dose_g": dose_g,
        "ratio": seed["ratio"],
        "water_temp_baseline_c": seed["temp_baseline_c"],   # 主锚:按烘焙度
        "water_temp_actual_c": seed["temp_baseline_c"],     # 实际起点(=基准,除非过老档+用户同意)
        "temp_adjust_reason": None,
        "grinder_type": grinder_type,
        "baseline_grind": None if blade else (baseline_grind or "(未描述)"),  # 砍豆机无意义→null
        "pour_method": POUR_METHOD,
        "phase": "active",                                  # active | grind_converged
    }
    if tool_context is not None:
        tool_context.state["bag"] = bag
        tool_context.state["cups"] = []

    return {
        "ok": True,
        "seed_recipe": {
            "比例": bag["ratio"],
            "水温": f'{bag["water_temp_actual_c"]}°C(按烘焙度基准)',
            "粉量": f"{dose_g}g",
            "研磨基准": bag["baseline_grind"] or "砍豆机无刻度,记不下基准",
            "注水手法": POUR_METHOD,
        },
        "bean_age_days": age,
        "roast_age_status": roast_age_status,
        "band": band,
        "flags": bag_flags,
        "bean_age_hypothesis": bean_age_hypothesis,
        "bean_age_evidence_status": bean_age_evidence_status,
        "advice": advice,           # 如实转告用户(提示/降期望;别埋掉)
    }


# ── 工具 2:每杯追加一条结构化记录 ──────────────────────────────────
def record_cup(
    turn_type: str,
    sensory: str = "",
    vs_prev: str = "",
    brew_time: str = "",
    bed_shape: str = "",
    wall_ring: str = "",
    gradient: str = "",
    decision: str = "",
    rationale: str = "",
    confidence: str = "",
    direction: str = "",
    step: str = "",
    grind_now: str = "",
    bed_note: str = "",
    terminate_reason: str = "",
    flags_asserted: list[str] | None = None,
    tool_context=None,
) -> dict:
    """每杯结束、做完判断后调一次,把这一轮记成结构化轨迹。

    Args:
        turn_type: 本轮类型,"seed" | "adjust" | "probe" | "terminate"。
        sensory: 用户的感官词(太酸/发苦/涩/平淡…)。
        vs_prev: 和上一杯比,"变好" | "变坏" | "没变"。
        brew_time: 整杯冲煮时间(如 "1分40秒")。
        bed_shape: 床面形态,"平" | "拱" | "塌坑" | "偏厚下陷不足"。
        wall_ring: 杯壁是否挂一圈干粉,"有" | "无"(B规则判别涩的命根子)。
        gradient: 梯度判断,"变好+同向"|"变好"|"变坏"|"没变"|"已收敛"|"n/a"。
        decision: 决策,"继续"|"反向"|"收步"|"转轴"|"探针"|"停手"。
        rationale: 短文本,凭什么这么判(供人读,不计数)。
        confidence: 对本杯判断的把握,"high"|"medium"|"low"。
        direction: 仅 adjust 时,"finer" | "coarser"。
        step: 仅 adjust 时的相对步长(如"+2格");砍豆机记"定性/不可量化"。
        grind_now: 当前研磨相对基准(砍豆机记 N/A)。
        bed_note: 自由观察位(沟壑/挂壁等枚举塞不下的形态)。
        terminate_reason: 仅 terminate 时,satisfied|would_overextract|
            plateau_axis_topped|plateau_bean_decay|plateau_ambiguous|axis_unreliable|
            axis_limit_underextracted(萃取层:研磨轴到顶但绝对萃取未毕业)|
            flavor_mismatch|taste_unaddressable(后两个=口味层:可换豆 / 本版不可处理)。
        flags_asserted: agent 声明的旗标,可含 "info_insufficient" | "limitation_noted"
            | "degas_signals_observed"(豆龄未知时,第一杯出现排气/流速不稳信号)
            | "preference_unspecified"(萃取毕业但偏好未定位 → 需 probe)
            | "absolute_extraction_uncertain"(表面接近毕业但绝对刻度证据不足)
            | "absolute_extraction_not_met"(明确未达到绝对萃取毕业刻度)
            | "axis_limit_reached"(研磨轴已到可用极限)。
    """
    state = tool_context.state if tool_context is not None else {}
    bag = state.get("bag", {}) if hasattr(state, "get") else {}
    cups = state.get("cups", []) if hasattr(state, "get") else []

    _validate_record_contract(
        turn_type=turn_type,
        decision=decision,
        direction=direction,
        step=step,
        terminate_reason=terminate_reason,
    )

    # ── 派生项:工具算,不由 agent 经手(杜绝矛盾记录) ──
    age = _bean_age_days(bag["roast_date"]) if bag.get("roast_date") else None
    flags_derived = []
    if _is_blade(bag.get("grinder_type", "")):
        flags_derived.append("hardware_unreliable")   # → step/grind_now 不可靠
    if age is not None and _bean_band(bag.get("roast", "中"), age) == "stale":
        flags_derived.append("bean_aged")

    record = {
        "cup_no": len(cups) + 1,
        "date": date.today().isoformat(),
        "bean_age_days": age,
        "axis": "grind",                       # 预留多轴
        "turn_type": turn_type,
        "direction": direction or None,
        "step": step or None,
        "grind_now": grind_now,
        "report": {
            "sensory": sensory,
            "vs_prev": vs_prev,
            "brew_time": brew_time,
            "bed_shape": bed_shape,
            "bed_note": bed_note,
            "wall_ring": wall_ring,
        },
        "gradient": gradient or "n/a",
        "decision": decision,
        "terminate_reason": terminate_reason or None,
        "confidence": confidence,
        "flags_asserted": flags_asserted or [],
        "flags_derived": flags_derived,
        "rationale": rationale,
    }

    if tool_context is not None:
        cups = list(cups) + [record]
        tool_context.state["cups"] = cups
        if (
            bag.get("roast_age_status") == "unknown"
            and "degas_signals_observed" in (flags_asserted or [])
        ):
            bag = dict(bag)
            bag["bean_age_hypothesis"] = "possibly_under_rested"
            bag["bean_age_evidence_status"] = "supporting_single_direction"
            tool_context.state["bag"] = bag
        if turn_type == "terminate":           # 研磨轴收敛 → 相位推进(留多轴接口)
            bag = dict(bag)
            bag["phase"] = "grind_converged"
            tool_context.state["bag"] = bag

    # The caller needs the exact persisted shape to render the same trajectory
    # the agent will read next turn.  Keep the receipt fields for existing
    # callers, and return the immutable record alongside them rather than
    # asking a client to reconstruct it from tool-call arguments.
    return {
        "ok": True,
        "recorded_cup_no": record["cup_no"],
        "flags_derived": flags_derived,
        "record": record,
    }


# ── 注入:把结构化轨迹渲染成一段文本,喂给 instruction ───────────────
def render_trajectory(state) -> str:
    """每轮把这包豆的记忆渲染进上下文,让 agent 读结构化记录做梯度判断,
    而不是靠对聊天的模糊回忆(顺带根治 S1 软约束被绕过的问题)。"""
    get = state.get if hasattr(state, "get") else (lambda k, d=None: d)
    bag = get("bag", None)
    if not bag:
        return "## 这包豆的记忆\n(尚未冷启动——请先问齐烘焙度/烘焙日期/粉量/磨豆机,再调 start_bag。)"

    age = _bean_age_days(bag["roast_date"]) if bag.get("roast_date") else None
    age_text = f"烘{bag['roast_date']}(豆龄约{age}天)" if age is not None else "烘焙日期未知(豆龄未知)"
    flags_text = ",".join(bag.get("flags", [])) or "无"
    lines = [
        "## 这包豆的记忆(读这个做决策,别靠回忆)",
        f"包:{bag['roast']}焙 · {age_text} · "
        f"豆龄状态:{bag.get('roast_age_status', 'known')} · "
        f"豆龄假设:{bag.get('bean_age_hypothesis', 'n/a')} · "
        f"证据:{bag.get('bean_age_evidence_status', 'n/a')} · "
        f"包级旗标:{flags_text} · {bag['dose_g']}g · "
        f"{bag['grinder_type']} 基准={bag.get('baseline_grind')} · "
        f"目标{bag['ratio']} {bag['water_temp_actual_c']}°C · 相位={bag['phase']} · 手法已冻结",
    ]
    cups = get("cups", []) or []
    lines.append(f"已冲 {len(cups)} 杯:")
    for c in cups:
        r = c["report"]
        direction = c.get("direction") or "—"
        step = c.get("step") or ""
        lines.append(
            f"- 杯{c['cup_no']}[{c['turn_type']}] "
            f"{direction}{(' '+step) if step else ''} "
            f"报告{{{r['sensory']} / vs上杯:{r['vs_prev']} / {r['brew_time']} / "
            f"床面:{r['bed_shape']} / 挂粉环:{r['wall_ring']}}} "
            f"→ 梯度:{c['gradient']} 决策:{c['decision']}"
            f"{(' 终止:'+c['terminate_reason']) if c['terminate_reason'] else ''} "
            f"[conf={c['confidence']} 旗标={c['flags_asserted']+c['flags_derived']}]"
        )
    return "\n".join(lines)
