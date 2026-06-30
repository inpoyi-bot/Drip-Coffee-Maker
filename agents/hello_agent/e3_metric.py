"""确定性自定义 eval metric:E3/E3b 磨豆机条件化归因。

测什么:
- E3 砍豆机 + 又酸又苦:必须终止研磨轴,terminate_reason=axis_unreliable。
- E3b 锥刀 + 又酸又苦:不得使用 axis_unreliable,防止机械复述砍豆机双峰。
- 只判 record_cup 结构化字段,不判用户可见话术。
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


def _check_e3_blade(actual_args: Optional[dict]) -> tuple[bool, list[str]]:
    fails: list[str] = []
    if actual_args is None:
        return False, ["这一轮没调 record_cup(应有结构化记录)"]

    expected = {
        "turn_type": "terminate",
        "decision": "停手",
        "terminate_reason": "axis_unreliable",
    }
    for field, value in expected.items():
        if actual_args.get(field) != value:
            fails.append(f"{field}: 期望 {value!r},实得 {actual_args.get(field)!r}")

    for field in ("direction", "step"):
        if _has_value(actual_args, field):
            fails.append(f"{field}: E3 axis_unreliable 终止记录必须为空/不传,实得 {actual_args.get(field)!r}")

    return (len(fails) == 0), fails


def _check_e3b_burr(actual_args: Optional[dict]) -> tuple[bool, list[str]]:
    fails: list[str] = []
    if actual_args is None:
        return False, ["这一轮没调 record_cup(应有结构化记录)"]

    if actual_args.get("terminate_reason") == "axis_unreliable":
        fails.append("terminate_reason=axis_unreliable:锥刀场景误用砍豆机硬件出口")
    if actual_args.get("turn_type") == "terminate" and actual_args.get("decision") == "停手":
        fails.append("锥刀场景不应直接停掉研磨轴")

    return (len(fails) == 0), fails


def e3_grinder_contract_gate(
    eval_metric: EvalMetric,
    actual_invocations: list[Invocation],
    expected_invocations: Optional[list[Invocation]],
    conversation_scenario: Optional[ConversationScenario] = None,
) -> EvaluationResult:
    """E3/E3b 结构化落账 gate。"""
    actual_inv = actual_invocations[0] if actual_invocations else None
    expected_inv = expected_invocations[0] if expected_invocations else None
    actual_args = _last_record_cup_args(actual_inv)
    expected_args = _last_record_cup_args(expected_inv)

    if expected_args and expected_args.get("terminate_reason") == "axis_unreliable":
        passed, _fails = _check_e3_blade(actual_args)
    else:
        passed, _fails = _check_e3b_burr(actual_args)

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
