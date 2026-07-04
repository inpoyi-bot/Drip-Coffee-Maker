# EDD Round Report: E13 Overshoot Reversal — Attempt, Rollback, and Final Baselines

## Executive summary

- E13 was encoded as an overshoot-reversal gate, and the first live baseline
  failed both branches in a structurally meaningful way.
- The first E13 instruction fix made E13 pass, but full regression exposed
  failures in previously stable territory; after the hard cap fired, all E13
  instruction changes were rolled back.
- A later seed-integrity investigation found that committed E11a/E11b seeds
  bypassed `record_cup` invariants and injected an impossible trajectory; the
  linter now catches this class of evalset seed pollution.
- The first valid full E11 observation after seed repair passed E11b/E11d and
  failed E11a/E11c, giving a clean baseline without further instruction edits.
- Final snapshot: E12 passes, E13 remains a reproducible known v1 limitation,
  and `agent.py` / `memory.py` are left frozen after rollback.

Final snapshot table:

| Gate | Final status | Result file |
|---|---:|---|
| E3/E3b | passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e3_grinder_1783157921.46782.evalset_result.json` |
| E5 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e5_plateau_1783157994.8373802.evalset_result.json` |
| E7c | rerun passed twice after one prior omission flake | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158504.4199722.evalset_result.json`; `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158549.70929.evalset_result.json` |
| E11 group | first valid observation after seed fix: passed 2 / failed 2 | `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783170428.105809.evalset_result.json` |
| E12 | snapshot passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e12_graduation_gate_1783171042.487395.evalset_result.json` |
| E13 | encoded gate, failing baseline, known limitation v1: passed 0 / failed 2 | `agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783171082.880841.evalset_result.json` |

Timeline index:

1. E13 baseline: encoded gate fails both branches.
2. EDD fix #1: overshoot reversal, noise gate, E13a/E9 boundary, decision enum.
3. Regression red lights: E11 route capture, E3b empty-response flake, E11 taste-layer gradient failures.
4. Hard-cap rollback: restore pre-E13 instruction baseline and keep eval artifacts.
5. Seed root cause: E11a/E11b committed seeds bypassed runtime invariants.
6. First valid E11 observation: clean seed baseline, E11b/E11d pass and E11a/E11c fail.
7. Snapshot archive: E12 passes once, E13 fails once with the same reproducible limitation.

## Step 0 contract smoke

Command run:

```bash
./.venv/bin/python scripts/smoke_e13_contract.py
```

Result:

```text
PASS a) overshoot reversal adjust: accepted
PASS b) uncertain-gradient probe: accepted
PASS c) terminate cannot co-occur with direction: rejected as expected: record_cup contract violation: terminate 记录不能带 direction
E13 contract smoke: PASS
```

Conclusion: the existing `memory.record_cup` contract accepts both E13-required
record shapes, and the existing terminate/direction invariant is still enforced.
No `memory.py` changes were needed or made.

## E13 eval command

```bash
PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval \
  agents/hello_agent \
  agents/hello_agent/e13_overshoot.evalset.json \
  --config_file_path agents/hello_agent/e13_test_config.json
```

## Pattern deviations

- `scripts/` did not exist before this task, so Step 0 adds that directory with
  the single smoke-test script.
- `e13_metric.py` mirrors the E12 deterministic `record_cup` gate for overall
  pass/fail. It also records one narrow E13a `attribution_wording_warn` rubric
  when final-response wording appears to blame pouring/technique, but this
  warning does not participate in overall scoring. Reason: E13's real action
  failure is already carried by structured fields such as `direction` and
  `turn_type`; wording noise is worth surfacing, but is too brittle to be a
  hard gate.
- E13a explicitly asserts `decision=继续` in addition to `turn_type=adjust`,
  `direction=coarser`, and a smaller step. This keeps the gate aligned with the
  E5 lesson: do not allow internally contradictory structured records to pass.
- E13a gradient matching is semantic rather than exact-string: it accepts values
  containing `变坏` so long as they do not also contain `变好` and are not
  `已收敛`. Reason: `memory.record_cup` treats `gradient` as a free string, and
  existing trajectories use composite tokens such as `变好+同向`.
- E13a step matching parses numeric and common Chinese step values before
  comparing against `2格`, so `1.5格` is accepted as a smaller step while
  `2格` / `两格` are rejected.
- Harness rule: as in the existing E12/E5-style helpers, the metric reads the
  last `record_cup` call in the invocation. It does not attempt cross-record
  consistency if one invocation emits multiple individually valid records.

## E13 live-run triage protocol

If the first live E13 run fails, triage metric calibration before treating it as
an agent behavior failure.

- Metric/calibration bug: the structured fields are semantically correct, but
  the metric parser rejects formatting, for example `step="调粗大约1格"` rather
  than a bare `1格`. Fix the metric; do not start an EDD agent change route.
- Agent bug: the structured fields are semantically wrong, for example E13a
  keeps `direction=finer`, terminates/probes instead of continuing, misses
  `overshoot_observed`, or E13b records a definite worse gradient. Only then
  classify the failure by the agreed E13a/E13b severity path.
- `attribution_wording_warn` is warning-only. Because exoneration phrases can
  trigger false positives, manually reread the response before treating the
  warning as noteworthy wording noise.

## E13 live baseline

Command run:

```bash
PYTHONPATH=agents ./.venv/bin/python -m google.adk.cli eval \
  agents/hello_agent \
  agents/hello_agent/e13_overshoot.evalset.json \
  --config_file_path agents/hello_agent/e13_test_config.json
```

Result file:

```text
agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783152917.9967842.evalset_result.json
```

Summary:

```text
Tests passed: 0
Tests failed: 2
```

Triage:

- E13a is an agent behavior miss, not a metric-format bug. The agent recognized
  overshoot directionally (`direction=coarser`, `gradient=变坏`) but did not
  shrink step size: it recorded `step="+2格"` and `decision="反向"` instead of
  the gold `decision=继续` with a smaller-than-2 step.
- E13b is an agent behavior miss. The report explicitly said the bitter note
  was uncertain and objective signals were unchanged, but the agent recorded a
  definite reversal: `turn_type=adjust`, `gradient=变坏`, `direction=coarser`,
  `step="-2格"` instead of `turn_type=probe`, `decision=探针`, no direction/step,
  and `flags_asserted=["gradient_uncertain"]`.
- No agent or prompt changes were made after this baseline run.

## EDD fix #1 (later rolled back)

Instruction fix #1 added four conditional strategy lines to `agent.py`:
overshoot reversal, the subjective-noise gate, the E13a/E9 boundary rule, and
an explicit `decision` value enumeration. This was the first E13 EDD repair
attempt; it was later rolled back after the hard cap fired.

Post-instruction-fix run:

```text
agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783153553.2373152.evalset_result.json
```

Summary:

```text
Tests passed: 2
Tests failed: 0
```

Observed structured records:

- E13a: `turn_type=adjust`, `decision=继续`, `gradient=变坏`,
  `direction=coarser`, `step="+1格"`, `flags_asserted=["overshoot_observed"]`.
- E13b: `turn_type=probe`, `decision=探针`, `gradient=info_insufficient`,
  `flags_asserted=["gradient_uncertain"]`, with no `direction` / `step` /
  `terminate_reason`.

## Step 1 full regression after E13 fix

Status: **STOPPED on failure**. Per task stop rule, no E9 encoding was started.

| Gate | Result | Eval history file |
|---|---:|---|
| E3/E3b | passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e3_grinder_1783154145.416469.evalset_result.json` |
| E5 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e5_plateau_1783154182.253349.evalset_result.json` |
| E7c | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783154220.411474.evalset_result.json` |
| E11 group | passed 3 / failed 1 | `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783154271.857964.evalset_result.json` |
| E12 | not run | stopped before this gate |
| E13 | not run | stopped before this gate |

Failing gate: E11 group, case `E11b_taste_unaddressable`.

Failing actual `record_cup` args, invocation 1:

```json
{"bed_shape": "平", "brew_time": "1分40秒", "confidence": "medium", "decision": "探针", "flags_asserted": ["absolute_extraction_uncertain"], "gradient": "没变", "rationale": "用户反馈太酸，与上一杯状态无明显变化，需探针确认绝对甜感是否到位，以校准萃取毕业状态。", "sensory": "太酸了,不太喜欢", "turn_type": "probe", "vs_prev": "没变", "wall_ring": "无"}
```

Same case invocation 2 actual `record_cup` args, for context:

```json
{"bed_shape": "平", "brew_time": "1分40秒", "confidence": "high", "decision": "停手", "flags_asserted": ["limitation_noted"], "gradient": "已收敛", "rationale": "用户明确表示喜欢酸度，只是想口感更厚实，已超出研磨单轴调节范围，此为口味偏好，且本版工具不可处理。", "sensory": "喜欢酸,想要更厚实", "terminate_reason": "taste_unaddressable", "turn_type": "terminate", "vs_prev": "没变", "wall_ring": "无"}
```

Observed failure shape: E11b first invocation was routed to E12-style
`absolute_extraction_uncertain` instead of the E11 taste-layer
`preference_unspecified` probe. No agent behavior fix, metric relaxation, or
gold edit was made after this failure.

Retrospective caveat: this observation was produced on a polluted E11a/E11b
seed. The later seed-integrity investigation found that the case seed carried
`bag.phase=active` alongside a final cup with `gradient=已收敛` and an illegal
`decision=停手` / `turn_type=adjust` shape. The "noise gate captured the taste
entry" diagnosis and the contradictory seed share responsibility here; the
split is not recoverable from this run alone.

## Scoped E13 search-rule fix + rerun

Fix applied in `agents/hello_agent/agent.py` only:

- Added a precedence line under the search rules: if session state already
  carries upstream `gradient=已收敛`, extraction-layer search rules do not apply
  and the flow must enter the taste-layer route.
- Scoped both new E13 rules, noise gate and overshoot reversal, to
  extraction-layer search while not yet graduated.
- Did not rewrite the 第-1步守卫, E11 taste-layer section, or E13a/E9 boundary
  rule.

Rerun status: **STOPPED on failure**. Per task stop rule, no E9 encoding was
started.

| Gate | Result | Eval history file |
|---|---:|---|
| E3/E3b | passed 1 / failed 1 | `agents/hello_agent/.adk/eval_history/hello_agent_e3_grinder_1783155561.661082.evalset_result.json` |
| E5 | not run | stopped before this gate |
| E7c | not run | stopped before this gate |
| E11 group | not run | stopped before this gate |
| E12 | not run | stopped before this gate |
| E13 | not run | stopped before this gate |

Failing gate: E3/E3b, case `E3b_burr_not_axis_unreliable`.

Failing invocation:

```text
user: 我要开一包新豆,V60,中焙,烘焙约10天,粉量15克。磨豆机是锥刀电动磨,当前像白砂糖粗细。第一杯冲出来又酸又苦,酸很尖,后面也有苦味。整杯大概2分钟,床面看起来还算平,杯壁没挂粉。
final_response: None
record_cup_calls: 0
```

Failing `record_cup` args: none were emitted.

No agent behavior fix, metric relaxation, or gold edit was made after this
failure.

Known observation: the E3b failure above appears to be a transient model/ADK
empty-response event rather than a stable behavior regression. The raw event had
`finish_reason="STOP"`, `error_code=null`, `error_message=null`, and
`content.parts=null`; no tool call was emitted. E3b-only reproduction was run 3
times and passed 3/3:

```text
agents/hello_agent/.adk/eval_history/hello_agent_e3b_only_1783156431.651139.evalset_result.json
agents/hello_agent/.adk/eval_history/hello_agent_e3b_only_1783156475.5561652.evalset_result.json
agents/hello_agent/.adk/eval_history/hello_agent_e3b_only_1783156518.737053.evalset_result.json
```

All three reproduction runs had a present final response and one `record_cup`
call. No code, metric, or gold changes were made for this observation.

## Continued regression from E5 after E3b reproduction

Status: **STOPPED on failure**. Per task stop rule, E12/E13 were not rerun and
E9 encoding was not started.

| Gate | Result | Eval history file |
|---|---:|---|
| E5 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e5_plateau_1783156743.060881.evalset_result.json` |
| E7c | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783156803.3908522.evalset_result.json` |
| E11 group | passed 2 / failed 2 | `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783156860.161388.evalset_result.json` |
| E12 | not run | stopped before this gate |
| E13 | not run | stopped before this gate |

Failing gate: E11 group.

Failing case `E11a_flavor_mismatch`, invocation 1 actual `record_cup` args:

```json
{"bed_shape": "平", "brew_time": "1分40秒", "confidence": "high", "decision": "探针", "flags_asserted": ["preference_unspecified"], "gradient": "没变", "rationale": "上杯已达萃取毕业，本杯“太酸”按口味偏好探针处理", "sensory": "太酸了", "turn_type": "probe", "vs_prev": "没变", "wall_ring": "无"}
```

Failing case `E11a_flavor_mismatch`, invocation 2 actual `record_cup` args:

```json
{"bed_shape": "平", "brew_time": "1分40秒", "confidence": "high", "decision": "停手", "flags_asserted": [], "gradient": "没变", "rationale": "用户明确不喜欢当前豆子的果酸调性，属于口味不匹配，终止研磨调整。", "sensory": "不爱这种酸", "terminate_reason": "flavor_mismatch", "turn_type": "terminate", "vs_prev": "没变", "wall_ring": "无"}
```

Failing case `E11b_taste_unaddressable`, invocation 1 actual `record_cup` args:

```json
{"bed_shape": "平", "brew_time": "1分40秒", "confidence": "high", "decision": "探针", "flags_asserted": ["preference_unspecified"], "gradient": "n/a", "rationale": "萃取已收敛，用户反馈口味问题，转入口味层探针", "sensory": "太酸", "turn_type": "probe", "vs_prev": "没变", "wall_ring": "无"}
```

Failing case `E11b_taste_unaddressable`, invocation 2 actual `record_cup` args:

```json
{"bed_shape": "平", "brew_time": "1分40秒", "confidence": "high", "decision": "停手", "flags_asserted": ["limitation_noted"], "gradient": "已收敛", "rationale": "用户明确表示喜欢酸度，但想要更醇厚，这属于口味偏好微调，超出了当前只调研磨的范围，故终止。", "sensory": "太酸", "terminate_reason": "taste_unaddressable", "turn_type": "terminate", "vs_prev": "没变", "wall_ring": "无"}
```

Observed failure shape: action routing is correct, but E11 taste-layer records
do not consistently preserve the upstream `gradient=已收敛` state in
`record_cup`. No agent behavior fix, metric relaxation, or gold edit was made
after this failure.

## Final taste-layer gradient fix + full regression

Fix applied in `agents/hello_agent/agent.py` only:

- Added one declarative taste-layer rule: every taste-layer `record_cup`
  (`probe` and `terminate`) must carry upstream `gradient=已收敛`; current
  subjective delta belongs in `vs_prev`, not `gradient`.
- Did not modify extraction-search rules, precedence line, 第-1步守卫, or
  E13/E9 boundary text.

Hard cap definition for this EDD route: after any new behavioral red light in
previously stable territory, stop fixing and roll back the E13 instruction
route rather than adding another instruction patch.

Status: **STOPPED on failure**. Per hard cap, no further fixes were made and E9
encoding was not started.

| Gate | Result | Eval history file |
|---|---:|---|
| E3/E3b | passed 1 / failed 1 | `agents/hello_agent/.adk/eval_history/hello_agent_e3_grinder_1783157259.55374.evalset_result.json` |
| E5 | not run | stopped before this gate |
| E7c | not run | stopped before this gate |
| E11 group | not run | stopped before this gate |
| E12 | not run | stopped before this gate |
| E13 | not run | stopped before this gate |

Failing gate: E3/E3b, case `E3_blade_axis_unreliable`.

Failing tool call:

```json
{"bed_shape": "平", "brew_time": "2分钟", "confidence": "high", "decision": "停手", "gradient": "n/a", "grind_now": "N/A", "rationale": "砍豆机造成双峰分布,研磨轴无法提供可靠反馈", "sensory": "又酸又苦", "terminate_reason": "axis_unreliable", "turn_type": "seed", "vs_prev": "n/a", "wall_ring": "无"}
```

Tool error:

```text
ValueError: record_cup contract violation: decision=停手 或 terminate_reason 非空时,turn_type 必须是 terminate
```

Observed failure shape: this is not a zero-evidence retry case. The model emitted
a concrete `record_cup` call, but the call violated the memory contract by using
`turn_type=seed` together with `decision=停手` and
`terminate_reason=axis_unreliable`. No metric/gold edits or further instruction
fixes were made after this red light.

Positive observation: the invalid structured record was rejected at the
`record_cup` state-write boundary with a `ValueError`, so the contradictory
record did not land in session state. This is defense in depth working as
intended: even when instruction-following regressed, the E5-era invariant
protected the trajectory store from pollution.

## Rollback execution and verification

Rollback executed:

- `agents/hello_agent/agent.py` was reverted to the pre-E13-EDD baseline. This
  removed the overshoot reversal rule, noise gate, E13a/E9 boundary rule,
  decision enum line, precedence line, and taste-layer gradient carry rule.
- E13 artifacts, smoke script, dirty-arc docs, eval histories, and REPORT
  history were kept.
- `agents/hello_agent/memory.py` was not modified.

Rollback rationale:

- The hard cap fired on a new-shape failure in previously green territory:
  E3 blade generated `turn_type=seed` together with `decision=停手` and
  `terminate_reason=axis_unreliable`.
- This indicated non-converging instruction interference; per pre-commitment,
  no further instruction fixes were attempted.
- The violating record was rejected by the `record_cup` invariant with
  `ValueError`, so state integrity held during instruction degradation.

Rollback verification status: **STOPPED on E7c failure**. E11/E12/E13 were not
rerun after rollback because the stop rule fired first.

| Gate | Final status | Result file |
|---|---:|---|
| E3/E3b | passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e3_grinder_1783157921.46782.evalset_result.json` |
| E5 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e5_plateau_1783157994.8373802.evalset_result.json` |
| E7c | passed 0 / failed 1 | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158044.789139.evalset_result.json` |
| E11 group | not run after rollback | stopped before this gate |
| E12 | not run after rollback | stopped before this gate |
| E13 | not run after rollback; encoded gate remains a known v1 limitation | prior failing baseline: `agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783152917.9967842.evalset_result.json` |

E7c failing shape:

- Turn 1 correctly called `start_bag(roast_age_status="unknown")`.
- Turn 2 produced a user-facing validation-probe response, but emitted no
  `record_cup` call, so the required `degas_signals_observed` probe was not
  recorded.

E7c turn 2 actual tool calls:

```json
[]
```

No E9 encoding was started after this stop.

## E7c rerun after rollback stop

Requested rerun: E7c only, 2 attempts. Both passed.

| Attempt | Result | Eval history file |
|---|---:|---|
| 1 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158504.4199722.evalset_result.json` |
| 2 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158549.70929.evalset_result.json` |

Observation: the previous rollback verification E7c miss was not reproduced in
two immediate reruns. No code, metric, or gold changes were made.

## E11 continuation after E7c rerun

Requested continuation: run E11, then E12 if E11 is green.

E11 result: **STOPPED on E11b failure**. E12 was not run in this continuation
because the regression stop rule fired at E11.

| Gate | Result | Eval history file |
|---|---:|---|
| E11 group | passed 3 / failed 1 | `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783158773.570782.evalset_result.json` |
| E12 | not run | stopped before this gate |

E11b failing shape:

- Invocation 1 treated the taste-layer clarification as extraction-layer search:
  it called `record_cup` with `turn_type=adjust`, `decision=继续`,
  `direction=finer`, `step=+2格`, and `gradient=没变`.
- Invocation 2 produced a verbal stop/explanation but emitted no `record_cup`
  call.
- This was not a zero-evidence run: `final_response` was present, one tool call
  was emitted, and no error was reported.

E11b invocation 1 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "medium",
  "decision": "继续",
  "direction": "finer",
  "flags_asserted": [
    "absolute_extraction_uncertain"
  ],
  "gradient": "没变",
  "rationale": "用户反馈依然太酸且无改善，需继续磨细。上一杯可能未达充分萃取。",
  "sensory": "太酸了,我不太喜欢",
  "step": "+2格",
  "turn_type": "adjust",
  "vs_prev": "没变",
  "wall_ring": "无"
}
```

E11b invocation 2 actual tool calls:

```json
[]
```

Retrospective status: **invalidated observation**. This run used the
contradictory E11a/E11b seed that was later caught by the seed linter, so it is
not counted as clean behavior evidence.

## Seed integrity root cause

The E11 seed issue was found by comparing the 2026-07-04 E11 result
`hello_agent_e11_taste_twin_1783158773.570782.evalset_result.json` with the
2026-07-02 ab-only result
`hello_agent_e11_taste_twin_ab_only_1782977662.0231612.evalset_result.json`.

Findings:

- The 2026-07-04 full E11 seed had `bag.phase=active` while its last seeded cup
  carried `gradient=已收敛` and `decision=停手`.
- The 2026-07-02 ab-only result ended with `bag.phase=grind_converged`, but the
  ab-only evalset itself was never committed and is not reconstructable from
  repository history. Its evidence strength is therefore limited to the archived
  result file.
- Git history showed the committed full `e11_taste_twin.evalset.json` had
  E11a/E11b `phase=active` from its creation commit; this was not a later edit.
- `memory.py` does not derive `phase` from cups. `start_bag` writes
  `phase=active`; `record_cup(turn_type=terminate)` advances it to
  `grind_converged`. Direct eval seed injection bypassed that write path.

Conclusion: prior full E11 live observations using the polluted committed seed
are invalid as behavior evidence. The seed linter and E11a/E11b seed fix below
create the first valid full E11 observation.

## Seed linter + E11a/b seed fix

Task scope:

- Add a read-only seed linter for evalset `session_input.state`.
- Verify whether an extraction-graduation terminate seed may leave
  `terminate_reason` semantically empty.
- Fix only E11a/E11b seed integrity, then rerun E11 as the first valid
  observation.
- `agents/hello_agent/agent.py` and `agents/hello_agent/memory.py` remain
  frozen for this task.

Step 1 linter, before seed fix: **expected FAIL**. It correctly found only the
E11a/E11b seed contradiction; E11c/E11d and the other evalsets passed.

```text
agents/hello_agent/e11_taste_twin.evalset.json
  E11a_flavor_mismatch: FAIL
    - cup3: record_cup contract violation: decision=停手 或 terminate_reason 非空时,turn_type 必须是 terminate; terminate 记录不能带 direction; terminate 记录不能带 step
  E11b_taste_unaddressable: FAIL
    - cup3: record_cup contract violation: decision=停手 或 terminate_reason 非空时,turn_type 必须是 terminate; terminate 记录不能带 direction; terminate 记录不能带 step
  E11c_not_sweet_underextracted_admission_reject: OK
  E11d_not_sweet_taste_unaddressable_admission_accept: OK
agents/hello_agent/e12_graduation_gate.evalset.json
  E12a_absolute_extraction_probe: OK
  E12b_axis_limit_underextracted: OK
agents/hello_agent/e13_overshoot.evalset.json
  E13a_mid_search_overshoot_reverse_shrink_continue: OK
  E13b_objective_silent_verify_no_reflex_reversal: OK
agents/hello_agent/e3_grinder.evalset.json
  E3_blade_axis_unreliable: OK
  E3b_burr_not_axis_unreliable: OK
agents/hello_agent/e5_plateau.evalset.json
  E5_plateau_ambiguous_terminate_record: OK
agents/hello_agent/e7c_unknown_roast_age.evalset.json
  E7c_unknown_roast_age_low_confidence_probe: OK
```

Linter findings table:

| Evalset | Cases | Findings |
|---|---:|---|
| `e11_taste_twin.evalset.json` | 4 | E11a/E11b cup3 illegal runtime shape: `decision=停手` with `turn_type=adjust`, `direction=finer`, `step=+1格`; E11c/E11d OK |
| `e12_graduation_gate.evalset.json` | 2 | OK |
| `e13_overshoot.evalset.json` | 2 | OK |
| `e3_grinder.evalset.json` | 2 | OK |
| `e5_plateau.evalset.json` | 1 | OK |
| `e7c_unknown_roast_age.evalset.json` | 1 | OK |

Step 2 smoke outcome:

```text
terminate_reason absent: ACCEPTED: {'ok': True, 'recorded_cup_no': 1, 'flags_derived': []}
terminate_reason empty string: ACCEPTED: {'ok': True, 'recorded_cup_no': 1, 'flags_derived': []}
```

Applied seed option:

- E11a/E11b cup3 now uses `turn_type=terminate`, `decision=停手`,
  `gradient=已收敛`, no `direction`, no `step`, and `bag.phase=grind_converged`.
- `terminate_reason` is left semantically empty as `null`, not omitted. Reason:
  the direct tool call may omit the parameter, but the runtime record produced
  by `record_cup` includes a `terminate_reason` key with `None`; seeded state
  must match the stored record shape because `render_trajectory` reads that key.
- Case descriptions note that this is system-inferred extraction graduation,
  not user `satisfied`; enum addition remains deferred under freeze.
- E11c/E11d were not touched.

Post-fix linter: **PASS**.

```text
agents/hello_agent/e11_taste_twin.evalset.json
  E11a_flavor_mismatch: OK
  E11b_taste_unaddressable: OK
  E11c_not_sweet_underextracted_admission_reject: OK
  E11d_not_sweet_taste_unaddressable_admission_accept: OK
agents/hello_agent/e12_graduation_gate.evalset.json
  E12a_absolute_extraction_probe: OK
  E12b_axis_limit_underextracted: OK
agents/hello_agent/e13_overshoot.evalset.json
  E13a_mid_search_overshoot_reverse_shrink_continue: OK
  E13b_objective_silent_verify_no_reflex_reversal: OK
agents/hello_agent/e3_grinder.evalset.json
  E3_blade_axis_unreliable: OK
  E3b_burr_not_axis_unreliable: OK
agents/hello_agent/e5_plateau.evalset.json
  E5_plateau_ambiguous_terminate_record: OK
agents/hello_agent/e7c_unknown_roast_age.evalset.json
  E7c_unknown_roast_age_low_confidence_probe: OK
```

Intermediate invalid run:

- `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783170328.264218.evalset_result.json`
- This run crashed before valid inference for E11a/E11b because the first seed
  edit omitted the `terminate_reason` key entirely and `render_trajectory`
  raised `KeyError: 'terminate_reason'`.
- This is not counted as the first valid E11 observation.

Step 4 E11 rerun after seed integrity passed:

- Label: **first valid E11a/E11b observation (seed integrity verified by linter)**.
- Result file:
  `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783170428.105809.evalset_result.json`
- Result: **passed 2 / failed 2**.
- Passing cases: E11b and E11d.
- Failing cases: E11a and E11c.
- STOP: E12 and E13 were not run after this failure.
- Flake count: 0. This was not a zero-evidence run or a pure tool-call omission
  flake; wrong structured field values were emitted.

Failing records:

E11c invocation 1 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "medium",
  "decision": "探针",
  "flags_asserted": [
    "info_insufficient"
  ],
  "gradient": "没变",
  "rationale": "用户对酸的收尾判断不清，需要探针",
  "sensory": "不甜;酸挺明显",
  "turn_type": "probe",
  "vs_prev": "没变",
  "wall_ring": "无"
}
```

E11c invocation 2 actual tool calls:

```json
[]
```

E11a invocation 1 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "high",
  "decision": "探针",
  "flags_asserted": [
    "preference_unspecified"
  ],
  "gradient": "没变",
  "rationale": "萃取已收敛，转向口味层探针",
  "sensory": "太酸",
  "turn_type": "probe",
  "vs_prev": "没变",
  "wall_ring": "无"
}
```

E11a invocation 2 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "high",
  "decision": "停手",
  "gradient": "已收敛",
  "rationale": "用户明确表示不喜欢该豆子的风味调性，超出冲煮可调节范围",
  "sensory": "不爱这种酸",
  "terminate_reason": "flavor_mismatch",
  "turn_type": "terminate",
  "vs_prev": "没变",
  "wall_ring": "无"
}
```

Current regression table:

| Gate | Status | Result file |
|---|---:|---|
| E3/E3b | passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e3_grinder_1783157921.46782.evalset_result.json` |
| E5 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e5_plateau_1783157994.8373802.evalset_result.json` |
| E7c | rerun passed twice after one prior omission flake | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158504.4199722.evalset_result.json`; `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158549.70929.evalset_result.json` |
| E11 group | first valid observation after seed fix: passed 2 / failed 2 | `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783170428.105809.evalset_result.json` |
| E12 | not run | stopped at E11 |
| E13 | not rerun in this step; encoded known limitation remains | prior failing baseline: `agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783152917.9967842.evalset_result.json` |

Known observations appended:

- Seed injection bypasses `record_cup` invariants in this project's local ADK
  eval setup. Eval `session_input.state` can inject trajectories that runtime
  tools would reject. The seed linter is now the compensating control.
- `record_cup` can accept a terminate call with omitted or empty
  `terminate_reason`, but the stored record shape contains the
  `terminate_reason` key. Eval seeds should mirror stored records, not function
  call kwargs.
- `gradient` is semantically overloaded, and clean-input evidence now confirms
  this as a baseline defect rather than only seed pollution. In
  `hello_agent_e11_taste_twin_1783170428.105809.evalset_result.json`, E11a and
  E11b share the same repaired upstream graduation seed and the same first user
  turn. E11a turn 1 records the taste-layer probe with `gradient=没变`, while
  E11b turn 1 records the same entry shape with `gradient=已收敛`. E11b turn 2
  and E11d turn 2 terminate records also carry `gradient=已收敛`. Meanwhile E11d
  turn 1, an admission probe before taste-layer acceptance, records
  `gradient=没变` and passes. This shows the same field is carrying two meanings:
  extraction-search/current-delta in admission or search contexts, and carried
  upstream graduation state in accepted taste-layer contexts. This is the
  strongest current evidence for a v2 schema split.
- Tool-call omission has a small but real ledger. Observed cases: E7c turn 2
  omitted `record_cup` once after a correct validation-probe response; E11b
  invocation 2 omitted `record_cup` once in run `1783158773` on the later
  invalidated polluted seed; E11c invocation 2 omitted `record_cup` once in the
  first valid E11 run `1783170428`. Pattern note: omissions appeared in later
  turns of multi-turn cases, not in cold single-turn gates. The E11b omission is
  retained with a polluted-seed caveat and should not be counted as clean
  behavior evidence.
- Step sign semantics remain undefined at the contract layer. Across runs,
  `finer` is recorded as `+2格`, while `coarser` appears both as `-2格` in
  failed E13 reversal records and as `+1格` in the passing post-fix E13a run.
  Direction and magnitude are therefore split between `direction` and `step`
  inconsistently. Metrics should continue to judge semantic magnitude rather
  than raw sign until the contract defines step sign.
- `decision` remains contract-layer free text. Two enum-absent baselines
  independently invented the out-of-enum value `反向` (N=2), while the single
  enum-present run recorded the correct `decision=继续` (N=1). Instruction-level
  enumeration appeared effective, but it was rolled back with the E13 route; the
  v1 baseline therefore runs unprotected. If `decision` becomes load-bearing,
  contract-level validation is the durable fix: instruction-level constraints
  may help, but proved non-viable to retain in this build.
- E9 remains a rubric-contract gap. The desired peak-backtrack exit
  `peak_backtracked` was not encoded because the E13 instruction route was
  rolled back before E9 work started. The contract already rejects terminate
  records that carry `direction` or `step`: `record_cup contract violation:
  terminate 记录不能带 direction`. That smoke-test rejection is design evidence
  that a future E9 backtrack termination should record the stop reason, while
  the actual previous-cup target remains recoverable from trajectory rather than
  carried as a new direction on the terminate row.
- Metric aggregation can blur turn-level binary failures. In E11a,
  `taste_gate_state_pass` is `0.0` for turn 1 and `1.0` for turn 2, but the
  overall case score reports `0.5`. When citing E11 results, use per-turn
  sub-scores. A v2 metric could use all-turns-must-pass AND semantics for
  load-bearing binary gates.

Supporting evidence for the `gradient` overload observation:

E11b invocation 1 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "high",
  "decision": "探针",
  "flags_asserted": [
    "preference_unspecified"
  ],
  "gradient": "已收敛",
  "rationale": "萃取已毕业，用户反馈口味不符，启动口味层偏好探针",
  "sensory": "太酸",
  "turn_type": "probe",
  "vs_prev": "没变",
  "wall_ring": "无"
}
```

E11b invocation 2 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "high",
  "decision": "停手",
  "flags_asserted": [
    "limitation_noted"
  ],
  "gradient": "已收敛",
  "rationale": "用户偏好更醇厚、扎实的口感，属于本版本研磨轴无法处理的口味微调，宣布终止。",
  "sensory": "太酸",
  "terminate_reason": "taste_unaddressable",
  "turn_type": "terminate",
  "vs_prev": "没变",
  "wall_ring": "无"
}
```

E11d invocation 1 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "medium",
  "decision": "探针",
  "flags_asserted": [
    "info_insufficient"
  ],
  "gradient": "没变",
  "rationale": "用户对酸的收尾判断模糊，需要探针",
  "sensory": "酸仍明显,甜感不清楚",
  "turn_type": "probe",
  "vs_prev": "没变",
  "wall_ring": "无"
}
```

E11d invocation 2 actual `record_cup` args:

```json
{
  "bed_shape": "平",
  "brew_time": "1分40秒",
  "confidence": "high",
  "decision": "停手",
  "flags_asserted": [
    "limitation_noted"
  ],
  "gradient": "已收敛",
  "rationale": "萃取已到位，用户偏好微调超出研磨轴与本版工具范围",
  "sensory": "有回甘,喜欢这个酸,但酸太亮,甜感被盖住,想要更厚、更圆",
  "terminate_reason": "taste_unaddressable",
  "turn_type": "terminate",
  "vs_prev": "变好",
  "wall_ring": "无"
}
```

Scope notes for this round:

- Added `scripts/lint_evalset_seeds.py`.
- Added `scripts/smoke_terminate_reason.py`.
- Modified only E11a/E11b seed blocks in
  `agents/hello_agent/e11_taste_twin.evalset.json`.
- Updated `REPORT.md`.
- `agents/hello_agent/agent.py` was not modified.
- `agents/hello_agent/memory.py` was not modified.
- No dependencies were added.

## Snapshot E12/E13 archive

Snapshot mode request:

- Run E12 once and E13 once.
- Archive result file paths.
- No stop rule.
- No retries except zero-evidence runs.
- Confirm E11a sub-scores from the result file.

E11a sub-score confirmation from
`agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783170428.105809.evalset_result.json`:

| Level | action_path_pass | taste_gate_state_pass | Notes |
|---|---:|---:|---|
| E11a overall | 1.0 | 0.5 | overall averages both invocations |
| E11a invocation 1 | 1.0 | 0.0 | `gradient` recorded as `没变`; expected carried state `已收敛` |
| E11a invocation 2 | 1.0 | 1.0 | passed |

Snapshot runs:

| Gate | Snapshot status | Result file | Retry count |
|---|---:|---|---:|
| E12 | passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e12_graduation_gate_1783171042.487395.evalset_result.json` | 0 |
| E13 | passed 0 / failed 2 | `agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783171082.880841.evalset_result.json` | 0 |

E13 was not retried because both failing cases produced normal final responses
and `record_cup` calls with wrong structured values; this was not zero-evidence.

E13 snapshot failing shapes:

- E13a emitted `turn_type=adjust`, `direction=coarser`, `gradient=变坏`, but
  `decision=反向`, `step=-2格`, and no `overshoot_observed`; the required
  smaller step was not recorded.
- E13b emitted an adjustment instead of a probe:
  `turn_type=adjust`, `decision=反向`, `direction=coarser`, `step=-2格`,
  `gradient=变坏`.

E13 cross-run comparison:

- Baseline result
  `agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783152917.9967842.evalset_result.json`
  and snapshot result
  `agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783171082.880841.evalset_result.json`
  show the same stable failure mode.
- E13a reproduced as directionally correct but not step-disciplined:
  `direction=coarser` and `gradient=变坏`, but no smaller step and
  `decision=反向` rather than `decision=继续`.
- E13b reproduced as reflex reversal rather than verification:
  `turn_type=adjust`, `direction=coarser`, `step=-2格`, and `gradient=变坏`
  rather than a `probe`.
- This raises E13 from a single archived failure to a reproducible known v1
  limitation (`N=2`). The repeated `decision=反向` also strengthens the existing
  observation that `decision` remains contract-layer free text.

Final snapshot table:

| Gate | Final status | Result file |
|---|---:|---|
| E3/E3b | passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e3_grinder_1783157921.46782.evalset_result.json` |
| E5 | passed 1 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e5_plateau_1783157994.8373802.evalset_result.json` |
| E7c | rerun passed twice after one prior omission flake | `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158504.4199722.evalset_result.json`; `agents/hello_agent/.adk/eval_history/hello_agent_e7c_unknown_roast_age_1783158549.70929.evalset_result.json` |
| E11 group | first valid observation after seed fix: passed 2 / failed 2 | `agents/hello_agent/.adk/eval_history/hello_agent_e11_taste_twin_1783170428.105809.evalset_result.json` |
| E12 | snapshot passed 2 / failed 0 | `agents/hello_agent/.adk/eval_history/hello_agent_e12_graduation_gate_1783171042.487395.evalset_result.json` |
| E13 | encoded gate, failing baseline, known limitation v1: passed 0 / failed 2 | `agents/hello_agent/.adk/eval_history/hello_agent_e13_overshoot_1783171082.880841.evalset_result.json` |

Snapshot scope notes:

- No files were modified for the E12/E13 eval runs except `REPORT.md`.
- `agents/hello_agent/agent.py` was not modified.
- `agents/hello_agent/memory.py` was not modified.
- No retries were performed.
