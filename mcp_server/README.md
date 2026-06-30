# Coffee MCP Server

这个目录是本项目的最小 MCP Server 证据层。

它只承接 SPEC §6.5 的非 agent 边界:静态 seed 匹配和开方前自检。ADK agent 仍然负责 SPEC §3 的收敛回路:读上一杯反馈梯度、决定下一步、判断何时停手。换句话说,MCP 是商品化静态规则/外部工具层;ADK agent 是收敛推理/编排层。

## Tools

| Tool | 作用 | SPEC 对应 |
|---|---|---|
| `get_seed_recipe` | 按烘焙度、粉量、磨豆机和研磨基准返回 V60 起点配方 | §6.5 Seed 匹配 |
| `precheck_bag` | 检查豆龄和砍豆机风险,返回需要转告用户的 advice | §6.5 开方前自检 |

MCP Server 本身用于覆盖 SPEC §6.4 的课程关键概念 `MCP Server`。

## Run

先安装依赖:

```bash
python3 -m pip install -r requirements.txt
```

启动 server:

```bash
python3 mcp_server/coffee_server.py
```

这个 server 使用 MCP stdio 传输。正常使用时由 MCP client 启动并调用,不需要手动在终端输入 HTTP 请求。

## Verified Examples

本轮已用 MCP client 做过最小验证:

- `list_tools` 返回 `get_seed_recipe` 和 `precheck_bag`
- `get_seed_recipe` 输入 `浅 / 15g / 锥刀 / 粗砂糖`,返回 `1:15~1:16`、`225~240g`、`93°C`
- `precheck_bag` 输入 `浅 / 2天 / 砍豆机`,返回 `under_rested`、`blade_unreliable` 和两条 advice
- 相同输入重复调用,输出稳定

## Not Connected To ADK Yet

当前没有把 MCP 接入 `agents/hello_agent/agent.py`。这是刻意保留的边界:本步只证明 MCP Server 独立能启动、能列工具、能稳定返回结果。下一步如果要接入 ADK,应只让 agent 调用这些静态工具拿 seed/checklist,不要把 `record_cup` 或 §3 的梯度判断迁到 MCP。
