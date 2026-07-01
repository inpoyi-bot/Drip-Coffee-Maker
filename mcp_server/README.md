# Coffee MCP Server

这个目录是本项目的最小 MCP Server 证据层。

它只承接 SPEC §6.5 的非 agent 边界:静态 seed 匹配和开方前自检。ADK agent 仍然负责 SPEC §3 的收敛回路:读上一杯反馈梯度、决定下一步、判断何时停手。换句话说,MCP 是商品化静态规则/外部工具层;ADK agent 是收敛推理/编排层。

本版本中 MCP **没有接入 ADK runtime**。这是刻意的架构边界:我们实现了一个 standalone MCP server 来证明静态工具层,但不声称 ADK agent 在运行时调用 MCP,也不让 MCP 承担收敛循环。

## Tools

| Tool | 作用 | SPEC 对应 |
|---|---|---|
| `get_seed_recipe` | 按烘焙度、粉量、磨豆机和研磨基准返回 V60 起点配方 | §6.5 Seed 匹配 |
| `precheck_bag` | 检查豆龄和砍豆机风险,返回需要转告用户的 advice | §6.5 开方前自检 |

MCP Server 本身用于覆盖 SPEC §6.4 的课程关键概念 `MCP Server`。

## Run

先安装依赖:

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

启动 server:

```bash
./.venv/bin/python mcp_server/coffee_server.py
```

这个 server 使用 MCP stdio 传输。正常使用时由 MCP client 启动并调用,不需要手动在终端输入 HTTP 请求。

## Smoke Test

下面这段会通过 MCP stdio client 启动 server、列工具、调用两个 tool。它测试的是 MCP code artifact 本身,不是 ADK agent runtime。

```bash
./.venv/bin/python - <<'PY'
import asyncio
import json

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client


async def main():
    params = StdioServerParameters(
        command="./.venv/bin/python",
        args=["mcp_server/coffee_server.py"],
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            tools = await session.list_tools()
            print("tools:", [tool.name for tool in tools.tools])

            seed = await session.call_tool(
                "get_seed_recipe",
                {
                    "roast": "浅",
                    "dose_g": 15,
                    "grinder_type": "锥刀",
                    "baseline_grind": "粗砂糖",
                },
            )
            print("seed:", seed.content[0].text)

            precheck = await session.call_tool(
                "precheck_bag",
                {
                    "roast": "浅",
                    "roast_days_ago": 2,
                    "grinder_type": "砍豆机",
                },
            )
            print("precheck:", precheck.content[0].text)


asyncio.run(main())
PY
```

预期输出应包含:

```text
tools: ['get_seed_recipe', 'precheck_bag']
```

`seed` 输出应包含 `1:15~1:16`、`225~240g`、`93`;`precheck` 输出应包含 `under_rested`、`blade_unreliable` 和对应 advice。

## Verified Examples

本轮已用 MCP client 做过最小验证:

- `list_tools` 返回 `get_seed_recipe` 和 `precheck_bag`
- `get_seed_recipe` 输入 `浅 / 15g / 锥刀 / 粗砂糖`,返回 `1:15~1:16`、`225~240g`、`93°C`
- `precheck_bag` 输入 `浅 / 2天 / 砍豆机`,返回 `under_rested`、`blade_unreliable` 和两条 advice
- 相同输入重复调用,输出稳定

## Intentionally Separate From ADK

当前没有把 MCP 接入 `agents/hello_agent/agent.py`。这是刻意保留的边界:本步只证明 MCP Server 独立能启动、能列工具、能稳定返回结果。

可以准确 claim:
- We implemented a standalone MCP server for static seed recipe and precheck tools.
- MCP demonstrates the external static-tool boundary.
- MCP is separate by design in this version.

不应 claim:
- The ADK agent uses MCP tools at runtime.
- MCP powers the convergence loop.
- MCP is integrated into the ADK agent.
