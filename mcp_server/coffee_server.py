"""Minimal MCP server for static coffee rules.

This server is the non-agent layer from SPEC §6.5:
- seed recipe matching
- pre-recipe bag checks

It intentionally does not read or write ADK session state. The ADK agent owns
the convergence loop; this MCP server only exposes stable static tools.
"""

from __future__ import annotations

from mcp.server.fastmcp import FastMCP


mcp = FastMCP("coffee-static-rules")


SEED_RECIPES = {
    "浅": {"ratio": "1:15~1:16", "water_temp_c": 93},
    "中": {"ratio": "1:15", "water_temp_c": 91},
    "深": {"ratio": "1:15", "water_temp_c": 89},
}

POUR_METHOD = (
    "闷蒸:注入约2倍粉重的水,轻轻 swirl 让粉全湿,等约45秒。"
    "主注水:连续平稳注到目标克重,保持水位,不戳不大力搅。"
    "收尾:轻轻 swirl 找平床面,等滴尽。整包照抄、绝不改。"
)


def _seed_for_roast(roast: str) -> dict:
    """Return the static seed recipe for a roast level."""
    return SEED_RECIPES.get(roast, SEED_RECIPES["中"])


def _bean_age_band(roast: str, roast_days_ago: int) -> str:
    """Classify bean age into the three bands used by the static checklist."""
    rest_days = 7 if roast == "浅" else 5
    if roast_days_ago < rest_days:
        return "under_rested"
    if roast_days_ago > 35:
        return "stale"
    return "fresh"


def _is_blade_grinder(grinder_type: str) -> bool:
    """Detect blade grinders from either Chinese or English user wording."""
    return "砍豆" in grinder_type or "blade" in grinder_type.lower()


@mcp.tool()
def get_seed_recipe(
    roast: str,
    dose_g: float,
    grinder_type: str,
    baseline_grind: str,
) -> dict:
    """Return a static V60 starting recipe from roast level and setup."""
    seed = _seed_for_roast(roast)
    is_blade = _is_blade_grinder(grinder_type)

    return {
        "roast": roast,
        "dose_g": dose_g,
        "ratio": seed["ratio"],
        "target_water_g": f"{dose_g * 15:.0f}~{dose_g * 16:.0f}g"
        if roast == "浅"
        else f"{dose_g * 15:.0f}g",
        "water_temp_c": seed["water_temp_c"],
        "grinder_type": grinder_type,
        "baseline_grind": None if is_blade else baseline_grind,
        "baseline_grind_note": "砍豆机无稳定刻度,不把它当作可量化基准。"
        if is_blade
        else "把这个研磨描述记作本包豆的起点基准。",
        "pour_method": POUR_METHOD,
    }


@mcp.tool()
def precheck_bag(roast: str, roast_days_ago: int, grinder_type: str) -> dict:
    """Return static pre-recipe checks for bean age and grinder risk."""
    age = max(0, int(roast_days_ago))
    band = _bean_age_band(roast, age)
    is_blade = _is_blade_grinder(grinder_type)
    advice = []

    if band == "under_rested":
        advice.append(
            f"豆龄约{age}天,养豆可能不足。前几杯萃取信号会抖,先别急着怪手法。"
        )
    elif band == "stale":
        advice.append(
            f"豆龄约{age}天偏老,风味可能衰减或变平。这个问题不一定靠调研磨解决。"
        )

    if is_blade:
        advice.append(
            "砍豆机颗粒分布不稳,研磨轴不可靠。可以继续练闭环,但要降低收敛预期。"
        )

    if not advice:
        advice.append("豆龄和磨豆机没有命中高风险静态检查,可以从 seed recipe 开始。")

    return {
        "roast": roast,
        "bean_age_days": age,
        "bean_age_band": band,
        "grinder_type": grinder_type,
        "grinder_risk": "blade_unreliable" if is_blade else "standard",
        "advice": advice,
    }


if __name__ == "__main__":
    mcp.run()
