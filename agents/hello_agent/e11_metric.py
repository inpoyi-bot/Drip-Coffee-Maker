"""确定性自定义 eval metric:口味层孪生 E11a / E11b / E11c / E11d 的「判动作不判话术」门。

为什么自定义(见 docs/evals.md §九 + B 档 handoff §5):
- ADK 自带 `tool_trajectory_avg_score` 做 record_cup 参数**全字典精确等值**,会把 `rationale`
  这类自由文本也比进去 → 把"判动作"偷偷变成"判说法",违背 §5。
- 这里只读 record_cup 的**结构化字段**(turn_type / decision / gradient / terminate_reason /
  direction / flags_asserted)判 gate,**完全不碰探针话术与 rationale**,也不碰 final_response。
- 确定性、无 LLM-judge 抖动 —— 回归门该是确定性的。

判什么(逐轮,期望值从 gold tool_use 读,字段范围在本文件钉死):
- 正向等值:turn_type、decision、gradient、terminate_reason、direction。
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
from google.adk.evaluation.evaluator import (
    EvalStatus,
    EvaluationResult,
    PerInvocationResult,
)

# 只在这些结构化字段上判正向等值(gold 给了才比)。**绝不含 rationale / sensory 等话术位。**
_GATED_FIELDS = ("turn_type", "decision", "gradient", "terminate_reason", "direction")
_NON_CONVERGED_MARKERS = {"非已收敛", "info_insufficient"}
_E11C_NEGATIVE_DECISIONS = {"退回萃取层", "继续萃取诊断", "继续"}


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


def _check_one(
    actual_args: Optional[dict],
    gold_args: Optional[dict],
    invocation_id: str = "",
) -> tuple[bool, list[str]]:
    """对单轮判 gate;返回 (是否通过, 失败原因列表)。"""
    fails: list[str] = []

    if gold_args is None:
        return True, fails  # gold 这轮没规定 → 不判(理论上不会发生)
    if actual_args is None:
        return False, ["这一轮没调 record_cup(应有结构化记录)"]

    # 正向:gold 指定的结构化字段须等值;显式给空值时,实际也必须为空。
    for f in _GATED_FIELDS:
        if f not in gold_args:
            continue

        expected = gold_args.get(f)
        actual = actual_args.get(f)

        if f == "gradient" and expected in _NON_CONVERGED_MARKERS:
            if actual == "已收敛":
                fails.append("gradient=已收敛:admission 未确认时不得宣布收敛")
            elif not _has_value(actual):
                fails.append(f"gradient: 期望非 '已收敛',实得 {actual!r}")
            continue

        if f == "decision" and invocation_id == "E11c-turn2":
            if actual not in _E11C_NEGATIVE_DECISIONS:
                fails.append(
                    f"decision: 期望 {sorted(_E11C_NEGATIVE_DECISIONS)},实得 {actual!r}"
                )
            continue

        if not _has_value(expected):
            if _has_value(actual):
                fails.append(f"{f}: 期望为空,实得 {actual!r}")
        elif actual != expected:
            fails.append(f"{f}: 期望 {expected!r},实得 {actual!r}")

    actual_flags = _flags_set(actual_args)
    gold_flags = _flags_set(gold_args)

    # E11c 第二轮只要求不得 limitation_noted,不要求 flags 必须空。
    if invocation_id == "E11c-turn2":
        if "limitation_noted" in actual_flags:
            fails.append("flags_asserted 含 limitation_noted:E11c negative 应退回萃取层,不得标版本外无解")
    elif actual_flags != gold_flags:
        fails.append(
            f"flags_asserted: 期望 {sorted(gold_flags)},实得 {sorted(actual_flags)}"
        )

    # 兼容旧 E11a/b gold:未显式声明 direction 的轮次,仍禁止直接磨细。
    if "direction" not in gold_args and actual_args.get("direction") == "finer":
        fails.append("direction=finer:该 E11 分支不得磨细(§2.2 命根子,硬 fail)")

    return (len(fails) == 0), fails


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
        passed, _fails = _check_one(
            _last_record_cup_args(actual_inv),
            _last_record_cup_args(gold_inv),
            gold_inv.invocation_id,
        )
        per.append(
            PerInvocationResult(
                actual_invocation=actual_inv or gold_inv,
                expected_invocation=gold_inv,
                score=1.0 if passed else 0.0,
                eval_status=EvalStatus.PASSED if passed else EvalStatus.FAILED,
            )
        )

    scored = [p.score for p in per if p.score is not None]
    overall = (sum(scored) / len(scored)) if scored else None
    all_pass = bool(per) and all(p.eval_status == EvalStatus.PASSED for p in per)
    return EvaluationResult(
        overall_score=overall,
        overall_eval_status=EvalStatus.PASSED if all_pass else EvalStatus.FAILED,
        per_invocation_results=per,
    )
