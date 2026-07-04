"""Validate evalset session seeds against the runtime record_cup contract.

Evalset seeds are injected directly into session state, so they bypass
memory.record_cup. This linter is the compensating control: every seeded cup
must be a shape that the runtime contract could have produced, and bag.phase
must agree with whether the seeded trajectory has already terminated.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agents"))

from hello_agent.memory import _validate_record_contract  # noqa: E402


def _has_value(value: Any) -> bool:
    return value is not None and str(value).strip() != ""


def _cup_field(cup: dict[str, Any], name: str) -> Any:
    if name in cup:
        return cup.get(name)
    if name in {"sensory", "vs_prev", "brew_time", "bed_shape", "wall_ring"}:
        return (cup.get("report") or {}).get(name)
    return None


def _validate_cup(cup: dict[str, Any], index: int) -> list[str]:
    turn_type = _cup_field(cup, "turn_type") or ""
    decision = _cup_field(cup, "decision") or ""
    direction = _cup_field(cup, "direction") or ""
    step = _cup_field(cup, "step") or ""
    terminate_reason = _cup_field(cup, "terminate_reason") or ""

    try:
        _validate_record_contract(
            turn_type=str(turn_type),
            decision=str(decision),
            direction=str(direction),
            step=str(step),
            terminate_reason=str(terminate_reason),
        )
    except Exception as exc:  # noqa: BLE001 - report exact contract rejection.
        return [f"cup{cup.get('cup_no', index)}: {exc}"]
    return []


def _validate_phase(state: dict[str, Any]) -> list[str]:
    bag = state.get("bag") or {}
    cups = state.get("cups") or []
    phase = bag.get("phase")
    has_terminate = any((cup.get("turn_type") or "") == "terminate" for cup in cups)
    expected = "grind_converged" if has_terminate else "active"
    if phase != expected:
        return [f"bag.phase={phase!r} but expected {expected!r} from seeded cups"]
    return []


def _validate_case(case: dict[str, Any]) -> list[str]:
    state = ((case.get("session_input") or {}).get("state") or {})
    if not state:
        return []

    violations: list[str] = []
    for index, cup in enumerate(state.get("cups") or [], start=1):
        violations.extend(_validate_cup(cup, index))
    violations.extend(_validate_phase(state))
    return violations


def main() -> int:
    evalsets = sorted((ROOT / "agents" / "hello_agent").glob("*.evalset.json"))
    any_violations = False

    for path in evalsets:
        rel = path.relative_to(ROOT)
        print(rel)
        try:
            data = json.loads(path.read_text())
        except Exception as exc:  # noqa: BLE001 - malformed evalset should fail lint.
            any_violations = True
            print(f"  <file>: FAIL: could not parse JSON: {exc}")
            continue

        for case in data.get("eval_cases") or []:
            case_id = case.get("eval_id") or "<missing eval_id>"
            violations = _validate_case(case)
            if violations:
                any_violations = True
                print(f"  {case_id}: FAIL")
                for violation in violations:
                    print(f"    - {violation}")
            else:
                print(f"  {case_id}: OK")

    return 1 if any_violations else 0


if __name__ == "__main__":
    raise SystemExit(main())
