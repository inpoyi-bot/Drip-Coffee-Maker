"""确定性自定义 eval metric:口味层孪生 E11a / E11b / E11c / E11d 的「判动作不判话术」门。

为什么自定义(见 docs/evals.md §九 + B 档 handoff §5):
- ADK 自带 `tool_trajectory_avg_score` 做 record_cup 参数**全字典精确等值**,会把 `rationale`
  这类自由文本也比进去 → 把"判动作"偷偷变成"判说法",违背 §5。
- 这里只读 record_cup 的**结构化字段**(turn_type / decision / gradient / terminate_reason /
  direction / flags_asserted)判 gate,**完全不碰探针话术与 rationale**,也不碰 final_response。
- 确定性、无 LLM-judge 抖动 —— 回归门该是确定性的。

判什么(逐轮,期望值从 gold tool_use 读,字段范围在本文件钉死):
- `action_path_pass`:turn_type、decision、terminate_reason、direction、flags_asserted。
- `taste_gate_state_pass`:gradient 是否符合分层闸门。口味层 probe/terminate
  (`preference_unspecified` / `flavor_mismatch` / `taste_unaddressable`)必须携带
  `gradient="已收敛"`;admission 未确认分支必须 `gradient != "已收敛"`。
- flags_asserted 默认集合等值(COUNT 旗标);E11c negative 第二轮只禁 `limitation_noted`,
  不要求 flags 必须为空。
- 方向门按 gold 判:E11a/b 已毕业分支不得 `direction=finer`;E11c negative 第二轮必须
  `direction=finer`;E11c/d 第一轮和 E11d positive 第二轮必须不带方向。
- E11c/d 第一轮的 admission uncertainty 不新增 flag / enum;gold 用 `gradient="非已收敛"`
  作为 metric 期望标记,实际只要求 `gradient != "已收敛"`;flags 用 `info_insufficient`,
  并通过集合等值禁止误标 `preference_unspecified` / `limitation_noted`。

接线:test_config.json 把本函数的 FQN 填进 custom_metrics(见同目录 e11_test_config.json)。
函数签名是 ADK 约定:(eval_metric, actual_invocations, expected_invocations, scenario) -> EvaluationResult。
"""

from __future__ import annotations

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

# 只在这些结构化字段上判正向等值(gold 给了才比)。**绝不含 rationale / sensory 等话术位。**
_ACTION_FIELDS = ("turn_type", "decision", "terminate_reason", "direction")
_NON_CONVERGED_MARKERS = {"非已收敛", "info_insufficient"}
_E11C_NEGATIVE_DECISIONS = {"退回萃取层", "继续萃取诊断", "继续"}
_TASTE_LAYER_FLAGS = {"preference_unspecified"}
_TASTE_LAYER_REASONS = {"flavor_mismatch", "taste_unaddressable"}


def _has_value(value: object) -> bool:
    return value not in (None, "", [], {})


def _last_record_cup_args(invocation: Optional[Invocation]) -> Optional[dict]:
    """取这一轮最后一次 record_cup 的参数 dict;没有则 None。"""
    if invocation is None:
        return None
    calls = get_all_tool_calls(invocation.intermediate_data)
    record_cups = [c for c in calls if c.name == "record_cup"]
    if not record_cups:
        return None
    return dict(record_cups[-1].args or {})


def _flags_set(args: dict) -> set[str]:
    return set(args.get("flags_asserted") or [])


def _uses_taste_layer(args: dict) -> bool:
    return bool(_flags_set(args) & _TASTE_LAYER_FLAGS) or args.get("terminate_reason") in _TASTE_LAYER_REASONS


def _rubric(rubric_id: str, passed: bool, fails: list[str]) -> RubricScore:
    return RubricScore(
        rubricId=rubric_id,
        score=1.0 if passed else 0.0,
        rationale="PASS" if passed else "; ".join(fails),
    )


def _check_one(
    actual_args: Optional[dict],
    gold_args: Optional[dict],
    invocation_id: str = "",
) -> tuple[bool, float, list[RubricScore]]:
    """对单轮判 gate;返回 (是否通过, 分数, 子分数 rubric)。"""
    action_fails: list[str] = []
    state_fails: list[str] = []

    if gold_args is None:
        rubrics = [
            _rubric("action_path_pass", True, []),
            _rubric("taste_gate_state_pass", True, []),
        ]
        return True, 1.0, rubrics  # gold 这轮没规定 → 不判(理论上不会发生)
    if actual_args is None:
        fail = ["这一轮没调 record_cup(应有结构化记录)"]
        rubrics = [
            _rubric("action_path_pass", False, fail),
            _rubric("taste_gate_state_pass", False, fail),
        ]
        return False, 0.0, rubrics

    # action_path_pass:gold 指定的动作字段须等值;显式给空值时,实际也必须为空。
    for f in _ACTION_FIELDS:
        if f not in gold_args:
            continue

        expected = gold_args.get(f)
        actual = actual_args.get(f)

        if f == "decision" and invocation_id == "E11c-turn2":
            if actual not in _E11C_NEGATIVE_DECISIONS:
                action_fails.append(
                    f"decision: 期望 {sorted(_E11C_NEGATIVE_DECISIONS)},实得 {actual!r}"
                )
            continue

        if not _has_value(expected):
            if _has_value(actual):
                action_fails.append(f"{f}: 期望为空,实得 {actual!r}")
        elif actual != expected:
            action_fails.append(f"{f}: 期望 {expected!r},实得 {actual!r}")

    actual_flags = _flags_set(actual_args)
    gold_flags = _flags_set(gold_args)

    # E11c 第二轮只要求不得 limitation_noted,不要求 flags 必须空。
    if invocation_id == "E11c-turn2":
        if "limitation_noted" in actual_flags:
            action_fails.append("flags_asserted 含 limitation_noted:E11c negative 应退回萃取层,不得标版本外无解")
    elif actual_flags != gold_flags:
        action_fails.append(
            f"flags_asserted: 期望 {sorted(gold_flags)},实得 {sorted(actual_flags)}"
        )

    # 兼容旧 E11a/b gold:未显式声明 direction 的轮次,仍禁止直接磨细。
    if "direction" not in gold_args and actual_args.get("direction") == "finer":
        action_fails.append("direction=finer:该 E11 分支不得磨细(§2.2 命根子,硬 fail)")

    # taste_gate_state_pass:gradient 是跨层携带的萃取状态,不是当前主观 delta。
    expected_gradient = gold_args.get("gradient")
    actual_gradient = actual_args.get("gradient")
    if expected_gradient in _NON_CONVERGED_MARKERS:
        if actual_gradient == "已收敛":
            state_fails.append("gradient=已收敛:admission 未确认时不得宣布收敛")
        elif not _has_value(actual_gradient):
            state_fails.append(f"gradient: 期望非 '已收敛',实得 {actual_gradient!r}")
    elif _uses_taste_layer(gold_args) or _uses_taste_layer(actual_args):
        if actual_gradient != "已收敛":
            state_fails.append(
                f"gradient: 使用口味层 flag/reason 时必须携带 '已收敛',实得 {actual_gradient!r}"
            )
    elif "gradient" in gold_args and _has_value(expected_gradient) and actual_gradient != expected_gradient:
        state_fails.append(f"gradient: 期望 {expected_gradient!r},实得 {actual_gradient!r}")

    action_pass = len(action_fails) == 0
    state_pass = len(state_fails) == 0
    rubrics = [
        _rubric("action_path_pass", action_pass, action_fails),
        _rubric("taste_gate_state_pass", state_pass, state_fails),
    ]
    score = (rubrics[0].score + rubrics[1].score) / 2.0
    return action_pass and state_pass, score, rubrics


def taste_layer_gate(
    eval_metric: EvalMetric,
    actual_invocations: list[Invocation],
    expected_invocations: Optional[list[Invocation]],
    conversation_scenario: Optional[ConversationScenario] = None,
) -> EvaluationResult:
    """口味层孪生 gate。每轮 1.0/0.0;全轮通过才整体 PASSED。"""
    if not expected_invocations:
        # 没有 gold 没法判 —— 标 NOT_EVALUATED,别假绿
        return EvaluationResult(
            overall_score=None,
            overall_eval_status=EvalStatus.NOT_EVALUATED,
            per_invocation_results=[],
        )

    per: list[PerInvocationResult] = []
    for i, gold_inv in enumerate(expected_invocations):
        actual_inv = actual_invocations[i] if i < len(actual_invocations) else None
        passed, score, rubrics = _check_one(
            _last_record_cup_args(actual_inv),
            _last_record_cup_args(gold_inv),
            gold_inv.invocation_id,
        )
        per.append(
            PerInvocationResult(
                actual_invocation=actual_inv or gold_inv,
                expected_invocation=gold_inv,
                score=score,
                eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
                rubric_scores=rubrics,
            )
        )

    scored = [p.score for p in per if p.score is not None]
    overall = (sum(scored) / len(scored)) if scored else None
    all_pass = bool(per) and all(p.eval_status == EvalStatus.PASSED for p in per)
    action_scores = [
        r.score
        for p in per
        for r in (p.rubric_scores or [])
        if r.rubric_id == "action_path_pass" and r.score is not None
    ]
    state_scores = [
        r.score
        for p in per
        for r in (p.rubric_scores or [])
        if r.rubric_id == "taste_gate_state_pass" and r.score is not None
    ]
    overall_rubrics = [
        RubricScore(
            rubricId="action_path_pass",
            score=sum(action_scores) / len(action_scores) if action_scores else None,
            rationale="Average action_path_pass across invocations.",
        ),
        RubricScore(
            rubricId="taste_gate_state_pass",
            score=sum(state_scores) / len(state_scores) if state_scores else None,
            rationale="Average taste_gate_state_pass across invocations.",
        ),
    ]
    return EvaluationResult(
        overall_score=overall,
        overall_eval_status=EvalStatus.PASSED if all_pass else EvalStatus.FAILED,
        per_invocation_results=per,
        overall_rubric_scores=overall_rubrics,
    )
