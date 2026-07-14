# 日常启动测试指南

这是一份已经完成首次部署后的日常操作清单。每次要让试用者使用，或自己测试线上闭环时，按顺序完成即可。

## 固定地址

- 前端（Production）：<https://drip-coffee-maker.vercel.app>
- 后端（Cloudflare Tunnel）：<https://api.coffee-maker.fun>
- 生产分支：`frontend-replit-v1`

> 这套 v1 的后端仍在本机。只有前端在 Vercel；电脑休眠、断网，或任一进程退出时，Agent 都会不可用。

## 首次部署验收记录（2026-07-14）

- 已从 Vercel Production 前端通过 Cloudflare Tunnel 向本机 ADK 发起并完成一轮浏览器交互。
- 这条记录证明部署链路可用：公网前端 → Tunnel → 本机 ADK → 模型凭证；不是 24/7 可用性、托管后端、安全、性能或扩缩容测试。
- 因此 README / writeup 只能称其为 **limited live demo**，不能称为 production deployment。

## 每次启动

需要打开两个终端，并保持它们都在运行。

### 终端 A：启动 Cloudflare Tunnel

在任意目录运行。每次从密码管理器取出 tunnel token；不要把 token 写进仓库、`.env` 或聊天记录。

```sh
read -s "TUNNEL_TOKEN?Paste Cloudflare tunnel token: "
echo
cloudflared tunnel --edge-ip-version 4 --protocol http2 run --token "$TUNNEL_TOKEN"
```

成功标志：终端出现已注册 connection 的信息；Cloudflare Dashboard 的 **Networking > Tunnels** 显示 **Healthy**。

### 终端 B：启动 ADK 后端

进入项目根目录：

```sh
cd "/Users/yue/Documents/Drip Coffee Maker"

set -a
source agents/hello_agent/.env
set +a

./.venv/bin/adk api_server agents \
  --host 127.0.0.1 \
  --port 8000 \
  --allow_origins 'https://drip-coffee-maker.vercel.app' \
  --session_service_uri 'sqlite+aiosqlite:///./sessions.db'
```

成功标志：终端显示 ADK server 已在 `127.0.0.1:8000` 启动。

`agents/hello_agent/.env` 是本机私有文件，包含模型 API key 或 Vertex 凭证；不要提交它。

## 30 秒健康检查

1. Cloudflare Dashboard 中 tunnel 是 **Healthy**。
2. 浏览器打开 <https://api.coffee-maker.fun/docs>，能看到 ADK API 页面。
3. 打开 <https://drip-coffee-maker.vercel.app>。
4. 新开一包豆，确认能得到冷启动建议。

若第 4 步成功，说明 Vercel 前端 → Cloudflare Tunnel → 本机 ADK → 模型凭证这条链路已通。

## 完整验收（每次发布后至少一次）

在前端完成：

1. 冷启动建议。
2. 提交一杯反馈。
3. 提交 probe / 下一杯反馈。
4. 打开轨迹，确认能读到前一杯并给出后续单变量调整或停止判断。

这验证的是 SPEC §3 的收敛回路，而不只是页面能打开。

## 结束测试

在两个终端分别按 `Ctrl+C`。

- 先停 ADK：前端会保留，但无法与 Agent 对话。
- 再停 Tunnel：公网 API URL 失效。

## 快速排障

| 现象 | 先检查什么 |
| --- | --- |
| 前端能打开，但冷启动失败 | 两个终端是否仍在运行；后端终端是否有认证或模型错误。 |
| 浏览器报 CORS | ADK 命令的 `--allow_origins` 是否精确为 `https://drip-coffee-maker.vercel.app`（没有末尾 `/`）。 |
| `api.coffee-maker.fun` 打不开 | tunnel 是否 Healthy；后端是否在 8000 端口运行。 |
| Tunnel 连不上 | 保留 `--edge-ip-version 4 --protocol http2`；公司网络可能拦截 IPv6 或 QUIC。 |
| Vercel 重新部署后无法连后端 | Vercel 的 Production 变量 `VITE_API_BASE_URL` 必须是 `https://api.coffee-maker.fun`；改完变量需重新部署。 |

## 什么时候需要改这份指南

- 更换 Vercel 项目域名：更新 `--allow_origins` 中的前端 origin。
- 更换 API 子域名：更新 Vercel 的 `VITE_API_BASE_URL`，重新部署前端，再更新本指南。
- 不再依赖本机：后端迁移 Cloud Run 后，改写本机 ADK 与 Tunnel 两节。

首次部署、域名配置与 Vercel 分支设置详见 [DEPLOY.md](DEPLOY.md)。
