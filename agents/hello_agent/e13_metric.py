"""确定性自定义 eval metric:E13 overshoot reversal。

测什么:
- E13a:中途继续磨细后明显变坏,必须识别 overshoot,反向磨粗且收小步长继续。
- E13b:舌头说不准有点变坏,但客观信号没动,必须 probe,不得反射反向。

主判 record_cup 结构化字段。另有一个很窄的回复文本 warning,只记录 E13a 是否把
过萃/overshoot 捎带归因到注水或手法;该 warning 不参与 overall pass/fail,避免把
"判动作"退化成"判说法"。

Warning caveat:blame 词表故意保持粗糙,且会误伤部分"洗清手法归因"句式,例如
"你的注水手法没有问题,这是研磨过冲"或"问题不在注水,在研磨"。因此
attribution_wording_warn 只提示人工复读,不得当作 agent 行为失败。

Harness 规则:本 metric 与 E12/E5 一样,读取这一轮最后一次 record_cup 调用作为实际
落账。单条记录内部矛盾由本 gate + memory contract 拦截;若同一轮出现多条各自合法
但彼此矛盾的 record_cup,当前 gate 不做跨条一致性裁决。
"""

from __future__ import annotations

import re
from typing import Optional

from google.adk.evaluation.eval_case import ConversationScenario, Invocation
from google.adk.evaluation.eval_case import get_all_tool_calls
from google.adk.evaluation.eval_metrics import EvalMetric
from google.adk.evaluation.eval_rubrics import RubricScore
from google.adk.evaluation.evaluator import (
    EvalStatus,
    EvaluationResult,
    PerInvocationResult,
)


CHINESE_STEP_VALUES = {
    "半": 0.5,
    "一": 1.0,
    "二": 2.0,
    "两": 2.0,
}
BLAME_PATTERNS = (
    r"(问题|原因|主要|可能).{0,8}(在|是|来自).{0,8}(注水|手法|水流|绕圈|搅拌|swirl|pour|technique)",
    r"(注水|手法|水流|绕圈|搅拌|swirl|pour|technique).{0,8}(导致|造成|引起|问题)",
    r"(你|这次).{0,6}(注水|手法|倒水|水流).{0,8}(不稳|不均|有问题)",
)


def _last_record_cup_args(invocation: Optional[Invocation]) -> Optional[dict]:
    if invocation is None:
        return None
    calls = get_all_tool_calls(invocation.intermediate_data)
    record_cups = [c for c in calls if c.name == "record_cup"]
    if not record_cups:
        return None
    return dict(record_cups[-1].args or {})


def _has_value(args: dict, key: str) -> bool:
    value = args.get(key)
    return value is not None and str(value).strip() != ""


def _flags_set(args: dict) -> set[str]:
    return set(args.get("flags_asserted") or [])


def _step_is_smaller_than_two(step: object) -> bool:
    text = str(step or "").strip().replace(" ", "")
    if text.startswith("+"):
        text = text[1:]

    match = re.fullmatch(r"(\d+(?:\.\d+)?)格?", text)
    if match:
        value = float(match.group(1))
        return 0 < value < 2.0

    match = re.fullmatch(r"([半一二两])格?", text)
    if match:
        return CHINESE_STEP_VALUES[match.group(1)] < 2.0

    return False


def _gradient_is_worse(value: object) -> bool:
    text = str(value or "").strip()
    return "变坏" in text and "变好" not in text and text != "已收敛"


def _response_text(invocation: Optional[Invocation]) -> str:
    if invocation is None:
        return ""
    response = getattr(invocation, "final_response", None)
    if response is None and isinstance(invocation, dict):
        response = invocation.get("final_response")
    if response is None:
        return ""

    parts = getattr(response, "parts", None)
    if parts is None and isinstance(response, dict):
        parts = response.get("parts")
    texts: list[str] = []
    for part in parts or []:
        if isinstance(part, dict):
            texts.append(str(part.get("text") or ""))
        else:
            texts.append(str(getattr(part, "text", "") or ""))
    return "\n".join(texts)


def _blames_pouring_or_technique(text: str) -> bool:
    return any(re.search(pattern, text, flags=re.IGNORECASE) for pattern in BLAME_PATTERNS)


def _rubric(rubric_id: str, passed: bool, fails: list[str]) -> RubricScore:
    return RubricScore(
        rubricId=rubric_id,
        score=1.0 if passed else 0.0,
        rationale="PASS" if passed else "; ".join(fails),
    )


def _check_e13a(actual_args: Optional[dict], final_text: str) -> tuple[bool, list[str], list[str]]:
    fails: list[str] = []
    warnings: list[str] = []
    if actual_args is None:
        return False, ["这一轮没调 record_cup(应有结构化记录)"], warnings

    if actual_args.get("turn_type") != "adjust":
        fails.append(f"turn_type:期望 'adjust',实得 {actual_args.get('turn_type')!r}")
    if actual_args.get("turn_type") in {"terminate", "probe"}:
        fails.append(f"turn_type={actual_args.get('turn_type')!r}:E13a 不能停手或探针,必须反向小步继续")
    if actual_args.get("decision") != "继续":
        fails.append(f"decision:期望 '继续',实得 {actual_args.get('decision')!r}")
    if not _gradient_is_worse(actual_args.get("gradient")):
        fails.append(f"gradient:期望语义为变坏,且不得含变好/已收敛,实得 {actual_args.get('gradient')!r}")
    if actual_args.get("gradient") == "已收敛":
        fails.append("gradient=已收敛:E13a 是 mid-search overshoot,不得宣布毕业")
    if actual_args.get("direction") != "coarser":
        fails.append(f"direction:期望 'coarser',实得 {actual_args.get('direction')!r}")
    if actual_args.get("direction") == "finer":
        fails.append("direction=finer:E13a 已经 overshoot,不得继续磨细")
    if not _has_value(actual_args, "step"):
        fails.append("step:缺少反向收小步长")
    elif not _step_is_smaller_than_two(actual_args.get("step")):
        fails.append(f"step:期望小于 2格(接受 1格/半格/0.5格),实得 {actual_args.get('step')!r}")
    if _has_value(actual_args, "terminate_reason"):
        fails.append(f"terminate_reason:E13a 不得终止,实得 {actual_args.get('terminate_reason')!r}")
    if "overshoot_observed" not in _flags_set(actual_args):
        fails.append("flags_asserted:缺 overshoot_observed")
    if "axis_limit_reached" in _flags_set(actual_args):
        fails.append("flags_asserted:不得含 axis_limit_reached(E13a 是过冲回退,不是轴极限)")
    if _blames_pouring_or_technique(final_text):
        warnings.append("final_response:疑似把 E13a 过冲信号捎带归因到注水或手法;仅记录 warning,不参与动作 gate")

    return (len(fails) == 0), fails, warnings


def _check_e13b(actual_args: Optional[dict]) -> tuple[bool, list[str], list[str]]:
    fails: list[str] = []
    warnings: list[str] = []
    if actual_args is None:
        return False, ["这一轮没调 record_cup(应有结构化记录)"], warnings

    if actual_args.get("turn_type") != "probe":
        fails.append(f"turn_type:期望 'probe',实得 {actual_args.get('turn_type')!r}")
    if actual_args.get("turn_type") == "terminate":
        fails.append("turn_type=terminate:E13b 信息不足,不得停手")
    if actual_args.get("decision") != "探针":
        fails.append(f"decision:期望 '探针',实得 {actual_args.get('decision')!r}")
    if "变坏" in str(actual_args.get("gradient") or ""):
        fails.append(f"gradient={actual_args.get('gradient')!r}:E13b 舌头不确定且客观没动,不得记录为明确变坏")
    for field in ("direction", "step", "terminate_reason"):
        if _has_value(actual_args, field):
            fails.append(f"{field}:E13b probe 不得带 {field},实得 {actual_args.get(field)!r}")
    if "gradient_uncertain" not in _flags_set(actual_args):
        fails.append("flags_asserted:缺 gradient_uncertain")

    return (len(fails) == 0), fails, warnings


def overshoot_reversal_gate(
    eval_metric: EvalMetric,
    actual_invocations: list[Invocation],
    expected_invocations: Optional[list[Invocation]],
    conversation_scenario: Optional[ConversationScenario] = None,
) -> EvaluationResult:
    """E13 overshoot reversal gate。每个 case 一轮,通过 expected gold 判断分支。"""
    actual_inv = actual_invocations[0] if actual_invocations else None
    expected_inv = expected_invocations[0] if expected_invocations else None
    actual_args = _last_record_cup_args(actual_inv)
    expected_args = _last_record_cup_args(expected_inv)

    if expected_args and expected_args.get("turn_type") == "probe":
        passed, fails, warnings = _check_e13b(actual_args)
    else:
        passed, fails, warnings = _check_e13a(actual_args, _response_text(actual_inv))

    rubrics = [
        _rubric("action_path_pass", passed, fails),
        _rubric("attribution_wording_warn", len(warnings) == 0, warnings),
    ]

    per = [
        PerInvocationResult(
            actual_invocation=actual_inv or expected_inv,
            expected_invocation=expected_inv,
            score=1.0 if passed else 0.0,
            eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
            rubric_scores=rubrics,
        )
    ]

    return EvaluationResult(
        overall_score=1.0 if passed else 0.0,
        overall_eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
        per_invocation_results=per,
    )
