"""确定性自定义 eval metric:E5 plateau 终止记录契约。

测什么:
- 用户可见话术可以有多种表达,不判作文。
- 只判最后一次 record_cup 的结构化字段:
  turn_type=terminate, decision=停手, terminate_reason=plateau_ambiguous。
- direction / step 必须为空或不传,防止"话术说停手,结构化却写 adjust/finer/+1格"。
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


def _check_e5(actual_args: Optional[dict]) -> tuple[bool, list[str]]:
    fails: list[str] = []

    if actual_args is None:
        return False, ["这一轮没调 record_cup(应有结构化记录)"]

    expected = {
        "turn_type": "terminate",
        "decision": "停手",
        "terminate_reason": "plateau_ambiguous",
    }
    for field, value in expected.items():
        if actual_args.get(field) != value:
            fails.append(f"{field}: 期望 {value!r},实得 {actual_args.get(field)!r}")

    for field in ("direction", "step"):
        if _has_value(actual_args, field):
            fails.append(f"{field}: E5 terminate 记录必须为空/不传,实得 {actual_args.get(field)!r}")

    if _has_value(actual_args, "validation_warning"):
        fails.append(f"validation_warning: eval 中不接受规范化告警 {actual_args.get('validation_warning')!r}")

    return (len(fails) == 0), fails


def e5_plateau_contract_gate(
    eval_metric: EvalMetric,
    actual_invocations: list[Invocation],
    expected_invocations: Optional[list[Invocation]],
    conversation_scenario: Optional[ConversationScenario] = None,
) -> EvaluationResult:
    """E5 plateau 结构化落账 gate。"""
    per: list[PerInvocationResult] = []
    expected_inv = expected_invocations[0] if expected_invocations else None
    actual_inv = actual_invocations[0] if actual_invocations else None

    passed, _fails = _check_e5(_last_record_cup_args(actual_inv))
    per.append(
        PerInvocationResult(
            actual_invocation=actual_inv or expected_inv,
            expected_invocation=expected_inv,
            score=1.0 if passed else 0.0,
            eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
        )
    )

    return EvaluationResult(
        overall_score=1.0 if passed else 0.0,
        overall_eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
        per_invocation_results=per,
    )
