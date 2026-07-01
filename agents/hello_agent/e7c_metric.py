"""确定性自定义 eval metric:E7c 未知烘焙日期低置信冷启动。

测什么:
- Turn 1:用户不知道烘焙日期时,必须调用 start_bag 的 unknown contract,
  不传 roast_days_ago,不伪造豆龄。
- Turn 2:第一杯出现排气/流速不稳 + 酸空时,必须记录 validation probe,
  带 degas_signals_observed,不得直接磨细或终止。

只判结构化工具调用字段,不判作文。bag state 的具体写入由 memory.py contract
保证;本 metric 检查 agent 是否使用了那个合法 contract。
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


FORBIDDEN_TERMINATE_REASONS = {"satisfied", "flavor_mismatch", "taste_unaddressable"}


def _last_tool_args(invocation: Optional[Invocation], tool_name: str) -> Optional[dict]:
    if invocation is None:
        return None
    calls = get_all_tool_calls(invocation.intermediate_data)
    matches = [c for c in calls if c.name == tool_name]
    if not matches:
        return None
    return dict(matches[-1].args or {})


def _last_tool_args_across(invocations: list[Invocation], tool_name: str) -> tuple[Optional[dict], Optional[Invocation]]:
    """ADK 有时会把多轮工具事件集中到后一个 invocation;按整段对话找最后一次调用。"""
    last_args: Optional[dict] = None
    last_invocation: Optional[Invocation] = None
    for invocation in invocations:
        args = _last_tool_args(invocation, tool_name)
        if args is not None:
            last_args = args
            last_invocation = invocation
    return last_args, last_invocation


def _has_value(args: dict, key: str) -> bool:
    value = args.get(key)
    return value is not None and str(value).strip() != ""


def _flags_set(args: dict) -> set[str]:
    return set(args.get("flags_asserted") or [])


def _check_turn1_start_bag(actual_args: Optional[dict]) -> tuple[bool, list[str]]:
    fails: list[str] = []
    if actual_args is None:
        return False, ["Turn 1 没有调用 start_bag(未知日期不应阻塞冷启动)"]

    if actual_args.get("roast_age_status") != "unknown":
        fails.append(
            f"start_bag.roast_age_status:期望 'unknown',实得 {actual_args.get('roast_age_status')!r}"
        )
    if _has_value(actual_args, "roast_days_ago"):
        fails.append(f"start_bag.roast_days_ago:未知烘焙日期不得传默认天数,实得 {actual_args.get('roast_days_ago')!r}")
    if actual_args.get("roast") != "浅":
        fails.append(f"start_bag.roast:期望 '浅',实得 {actual_args.get('roast')!r}")
    if actual_args.get("dose_g") not in (15, 15.0):
        fails.append(f"start_bag.dose_g:期望 15,实得 {actual_args.get('dose_g')!r}")

    return (len(fails) == 0), fails


def _check_turn2_record_cup(actual_args: Optional[dict]) -> tuple[bool, list[str]]:
    fails: list[str] = []
    if actual_args is None:
        return False, ["Turn 2 没有调用 record_cup(排气 validation probe 必须落账)"]

    expected = {
        "turn_type": "probe",
        "decision": "探针",
    }
    for field, value in expected.items():
        if actual_args.get(field) != value:
            fails.append(f"{field}:期望 {value!r},实得 {actual_args.get(field)!r}")

    if _has_value(actual_args, "direction"):
        fails.append(f"direction:validation probe 不得带调整方向,实得 {actual_args.get('direction')!r}")
    if _has_value(actual_args, "step"):
        fails.append(f"step:validation probe 不得带调整步长,实得 {actual_args.get('step')!r}")
    if actual_args.get("direction") == "finer":
        fails.append("direction=finer:排气/流速不稳污染梯度时不得直接磨细")
    if actual_args.get("terminate_reason") in FORBIDDEN_TERMINATE_REASONS:
        fails.append(f"terminate_reason={actual_args.get('terminate_reason')!r}:E7c 不得走满意/口味层终止出口")
    if _has_value(actual_args, "terminate_reason"):
        fails.append(f"terminate_reason:validation probe 不得终止,实得 {actual_args.get('terminate_reason')!r}")
    if "degas_signals_observed" not in _flags_set(actual_args):
        fails.append("flags_asserted:缺 degas_signals_observed")
    if actual_args.get("confidence") not in ("low", "medium"):
        fails.append(f"confidence:期望 low 或 medium,实得 {actual_args.get('confidence')!r}")

    return (len(fails) == 0), fails


def e7c_unknown_roast_age_gate(
    eval_metric: EvalMetric,
    actual_invocations: list[Invocation],
    expected_invocations: Optional[list[Invocation]],
    conversation_scenario: Optional[ConversationScenario] = None,
) -> EvaluationResult:
    """E7c 两轮结构化 gate。"""
    expected_turn1 = expected_invocations[0] if expected_invocations and len(expected_invocations) > 0 else None
    expected_turn2 = expected_invocations[1] if expected_invocations and len(expected_invocations) > 1 else None

    start_bag_args, start_bag_invocation = _last_tool_args_across(actual_invocations, "start_bag")
    record_cup_args, record_cup_invocation = _last_tool_args_across(actual_invocations, "record_cup")

    turn1_passed, _turn1_fails = _check_turn1_start_bag(start_bag_args)
    turn2_passed, _turn2_fails = _check_turn2_record_cup(record_cup_args)

    per = [
        PerInvocationResult(
            actual_invocation=start_bag_invocation or expected_turn1,
            expected_invocation=expected_turn1,
            score=1.0 if turn1_passed else 0.0,
            eval_status=EvalStatus.PASSED if turn1_passed else EvalStatus.FAILED,
        ),
        PerInvocationResult(
            actual_invocation=record_cup_invocation or expected_turn2,
            expected_invocation=expected_turn2,
            score=1.0 if turn2_passed else 0.0,
            eval_status=EvalStatus.PASSED if turn2_passed else EvalStatus.FAILED,
        ),
    ]

    passed = turn1_passed and turn2_passed
    return EvaluationResult(
        overall_score=1.0 if passed else 0.0,
        overall_eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
        per_invocation_results=per,
    )
