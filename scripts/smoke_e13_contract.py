"""Smoke-test E13 record_cup shapes against the existing memory contract.

This script calls memory.record_cup directly. It does not invoke the agent or
any LLM, and it does not mutate persistent session storage.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agents"))

from hello_agent.memory import record_cup  # noqa: E402


def _try_record(label: str, expect_accept: bool, **kwargs: Any) -> bool:
    try:
        record_cup(**kwargs)
    except Exception as exc:  # noqa: BLE001 - exact rejection is the point here.
        if expect_accept:
            print(f"FAIL {label}: {exc}")
            return False
        print(f"PASS {label}: rejected as expected: {exc}")
        return True

    if expect_accept:
        print(f"PASS {label}: accepted")
        return True

    print(f"FAIL {label}: expected rejection, but record_cup accepted it")
    return False


def main() -> int:
    ok_adjust = _try_record(
        "a) overshoot reversal adjust",
        True,
        turn_type="adjust",
        sensory="发苦、口腔发干、流速慢",
        vs_prev="变坏",
        brew_time="2分55秒",
        bed_shape="偏厚下陷不足",
        gradient="变坏",
        decision="继续",
        direction="coarser",
        step="1格",
        flags_asserted=["overshoot_observed"],
    )

    ok_probe = _try_record(
        "b) uncertain-gradient probe",
        True,
        turn_type="probe",
        sensory="一点点苦但说不准",
        vs_prev="不确定",
        brew_time="2分10秒左右",
        bed_shape="平",
        gradient="info_insufficient",
        decision="探针",
        flags_asserted=["gradient_uncertain"],
    )

    ok_invariant = _try_record(
        "c) terminate cannot co-occur with direction",
        False,
        turn_type="terminate",
        sensory="满意",
        gradient="已收敛",
        decision="停手",
        direction="coarser",
        terminate_reason="satisfied",
    )

    if not ok_adjust or not ok_probe:
        print("STOP: required E13 record shape was rejected by memory.record_cup.")
        return 1
    if not ok_invariant:
        print("STOP: existing terminate/direction invariant is not enforced.")
        return 1

    print("E13 contract smoke: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
