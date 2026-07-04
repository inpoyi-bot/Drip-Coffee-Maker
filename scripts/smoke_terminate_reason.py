"""Smoke-test terminate records with an empty terminate_reason.

This calls memory.record_cup directly. It does not invoke the agent or mutate
persistent session storage.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "agents"))

from hello_agent.memory import record_cup  # noqa: E402


def _try_record(label: str, **kwargs: Any) -> bool:
    try:
        result = record_cup(**kwargs)
    except Exception as exc:  # noqa: BLE001 - exact rejection is the point.
        print(f"{label}: REJECTED: {exc}")
        return False

    print(f"{label}: ACCEPTED: {result}")
    return True


def main() -> int:
    absent_ok = _try_record(
        "terminate_reason absent",
        turn_type="terminate",
        sensory="收尾化甜、有回甘",
        vs_prev="没变",
        brew_time="1分40秒",
        bed_shape="平",
        wall_ring="无",
        gradient="已收敛",
        decision="停手",
        confidence="high",
    )
    empty_ok = _try_record(
        "terminate_reason empty string",
        turn_type="terminate",
        sensory="收尾化甜、有回甘",
        vs_prev="没变",
        brew_time="1分40秒",
        bed_shape="平",
        wall_ring="无",
        gradient="已收敛",
        decision="停手",
        confidence="high",
        terminate_reason="",
    )
    return 0 if absent_ok and empty_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
