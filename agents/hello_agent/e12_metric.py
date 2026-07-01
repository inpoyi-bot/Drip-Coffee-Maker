"""确定性自定义 eval metric:E12 graduation gate。

测什么:
- E12a:四项看似全绿,但绝对甜感不足/不确定 → 必须留在萃取层 probe。
- E12b:四项看似全绿 + 研磨轴到顶 + 绝对甜感仍弱 → 萃取层 terminate 为
  axis_limit_underextracted。

只判 record_cup 结构化字段,不判用户可见话术或 rationale。核心防假绿:
任何 gradient=已收敛、口味层 flag/reason、继续磨细、解冻 action 都 fail。
"""

from __future__ import annotations

from typing import Optional

from google.adk.evaluation.eval_case import ConversationScenario, Invocation
from google.adk.evaluation.eval_case import get_all_tool_calls
from google.adk.evaluation.eval_metrics import EvalMetric
from google.adk.evaluation.evaluator import (
    EvalStatus,
    EvaluationResult,
    PerInvocationResult,
)


FORBIDDEN_REASONS = {"satisfied", "flavor_mismatch", "taste_unaddressable"}
FORBIDDEN_FLAGS = {"preference_unspecified"}


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


def _check_common(actual_args: Optional[dict]) -> tuple[dict | None, list[str]]:
    fails: list[str] = []
    if actual_args is None:
        return None, ["这一轮没调 record_cup(应有结构化记录)"]

    if actual_args.get("gradient") == "已收敛":
        fails.append("gradient=已收敛:E12 是 graduation 待审状态,不得伪造毕业信号")
    if actual_args.get("terminate_reason") in FORBIDDEN_REASONS:
        fails.append(f"terminate_reason={actual_args.get('terminate_reason')!r}:E12 不得使用口味层/满意终止出口")
    forbidden_flags = sorted(_flags_set(actual_args) & FORBIDDEN_FLAGS)
    if forbidden_flags:
        fails.append(f"flags_asserted 含禁用口味层旗标:{forbidden_flags}")
    if actual_args.get("direction") == "finer":
        fails.append("direction=finer:E12 不得继续磨细")
    if _has_value(actual_args, "step"):
        fails.append(f"step:E12 不得给继续调整步长,实得 {actual_args.get('step')!r}")

    return actual_args, fails


def _check_e12a(actual_args: Optional[dict]) -> tuple[bool, list[str]]:
    actual_args, fails = _check_common(actual_args)
    if actual_args is None:
        return False, fails

    expected = {
        "turn_type": "probe",
        "decision": "探针",
    }
    for field, value in expected.items():
        if actual_args.get(field) != value:
            fails.append(f"{field}: 期望 {value!r},实得 {actual_args.get(field)!r}")

    if _has_value(actual_args, "terminate_reason"):
        fails.append(f"terminate_reason:E12a probe 不得终止,实得 {actual_args.get('terminate_reason')!r}")
    if _has_value(actual_args, "direction"):
        fails.append(f"direction:E12a probe 不得带调整方向,实得 {actual_args.get('direction')!r}")
    if "absolute_extraction_uncertain" not in _flags_set(actual_args):
        fails.append("flags_asserted:缺 absolute_extraction_uncertain")

    return (len(fails) == 0), fails


def _check_e12b(actual_args: Optional[dict]) -> tuple[bool, list[str]]:
    actual_args, fails = _check_common(actual_args)
    if actual_args is None:
        return False, fails

    expected = {
        "turn_type": "terminate",
        "decision": "停手",
        "terminate_reason": "axis_limit_underextracted",
    }
    for field, value in expected.items():
        if actual_args.get(field) != value:
            fails.append(f"{field}: 期望 {value!r},实得 {actual_args.get(field)!r}")

    if _has_value(actual_args, "direction"):
        fails.append(f"direction:E12b terminate 不得带调整方向,实得 {actual_args.get('direction')!r}")
    required_flags = {"absolute_extraction_not_met", "axis_limit_reached"}
    missing = sorted(required_flags - _flags_set(actual_args))
    if missing:
        fails.append(f"flags_asserted:缺 {missing}")
    if "limitation_noted" in _flags_set(actual_args):
        fails.append("flags_asserted:不得含 limitation_noted(E12b 用 extraction-layer 专用 flags)")

    return (len(fails) == 0), fails


def graduation_gate(
    eval_metric: EvalMetric,
    actual_invocations: list[Invocation],
    expected_invocations: Optional[list[Invocation]],
    conversation_scenario: Optional[ConversationScenario] = None,
) -> EvaluationResult:
    """E12 graduation gate。每个 case 一轮,通过 expected gold 判断分支。"""
    actual_inv = actual_invocations[0] if actual_invocations else None
    expected_inv = expected_invocations[0] if expected_invocations else None
    actual_args = _last_record_cup_args(actual_inv)
    expected_args = _last_record_cup_args(expected_inv)

    if expected_args and expected_args.get("turn_type") == "probe":
        passed, _fails = _check_e12a(actual_args)
    else:
        passed, _fails = _check_e12b(actual_args)

    per = [
        PerInvocationResult(
            actual_invocation=actual_inv or expected_inv,
            expected_invocation=expected_inv,
            score=1.0 if passed else 0.0,
            eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
        )
    ]

    return EvaluationResult(
        overall_score=1.0 if passed else 0.0,
        overall_eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
        per_invocation_results=per,
    )
