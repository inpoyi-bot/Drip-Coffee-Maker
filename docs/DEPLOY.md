# 试用部署 Runbook：Cloudflare Tunnel + Vercel

本 runbook 把 coffee-coach 前端部署到 Vercel，并通过 Cloudflare **命名隧道**访问仍运行在本机的 ADK 后端。

这是少量试用者的 v1 方案，不是 24/7 后端托管：你的电脑、ADK 进程和 `cloudflared` 进程都必须保持运行。

## 已经配好

- `frontend/` 是 Vercel Project Root；它使用 pnpm workspace 和固定的 `pnpm@11.7.0`。
- `frontend/vercel.json` 会冻结安装依赖、只构建 `@workspace/coffee-coach`，并发布 `artifacts/coffee-coach/dist/public`。
- Vercel production build 缺少 `VITE_API_BASE_URL` 会失败，避免发布后静默连向 `localhost`。
- 原生依赖按平台作为 optional dependencies 解析：本机使用 darwin，Vercel 使用 Linux，不再有直接绑定 macOS 的依赖。

## 你需要准备的值

| 名称 | 示例 | 用在何处 |
| --- | --- | --- |
| API 主机名 | `api.example.com` | Cloudflare Tunnel public hostname |
| 固定 API URL | `https://api.example.com` | Vercel 的 `VITE_API_BASE_URL` |
| Vercel 前端 URL | `https://coffee-coach.vercel.app` | ADK 的 CORS allowlist |
| Tunnel token | Cloudflare Dashboard 生成的 `eyJ...` | 只在本机运行 `cloudflared` |

不要把 token、service-account JSON、`.env` 或真实 API URL 提交到 Git。

## 1. 把域名接入 Cloudflare（手动）

1. 在域名注册商处，将 nameserver 改为 Cloudflare 提供的值。
2. 在 Cloudflare Dashboard 确认 zone 为 Active；DNS 传播可能需要等待。
3. 决定 API 子域名，例如 `api.example.com`。

## 2. 创建远程托管的命名隧道（手动）

Cloudflare 推荐远程托管 tunnel：路由配置保存在 Dashboard，本机只需要 token 来运行连接器。

1. 在 Cloudflare Dashboard 打开 **Networking > Tunnels**，创建 tunnel，例如 `coffee-adk`。
2. 为 tunnel 添加 public hostname：
   - Hostname：`api.example.com`
   - Service type：`HTTP`
   - Service URL：`http://localhost:8000`
3. 保存后复制该 tunnel 的运行 token；把它只保存在本机的安全位置。
4. 另开一个终端，在本机启动 tunnel：

   ```sh
   export TUNNEL_TOKEN='在这里粘贴 Cloudflare token'
   cloudflared tunnel --edge-ip-version 4 --protocol http2 run
   ```

`--edge-ip-version 4 --protocol http2` 是这台机器网络阻断 IPv6/QUIC 时的兼容参数；网络正常时也可以省略，让 `cloudflared` 自动选择。看到 tunnel 显示 Healthy 后，`https://api.example.com` 才会转发到本机 8000 端口。

## 3. 启动本机 ADK 后端并设置 CORS（手动）

先创建并填写本机凭证文件：

```sh
cp .env.example agents/hello_agent/.env
```

按实际模型提供商填写 `agents/hello_agent/.env`。若使用 Vertex AI，按 `.env.example` 设置 `GOOGLE_GENAI_USE_VERTEXAI`、项目、地区和 `GOOGLE_APPLICATION_CREDENTIALS`；该 service-account 文件必须只留在本机。

启动后端时只绑定 loopback，由 Tunnel 访问；将 Vercel **production** URL 放进 CORS allowlist：

```sh
set -a
source agents/hello_agent/.env
set +a

./.venv/bin/adk api_server agents \
  --host 127.0.0.1 \
  --port 8000 \
  --allow_origins 'https://coffee-coach.vercel.app' \
  --session_service_uri 'sqlite+aiosqlite:///./sessions.db'
```

把示例 Vercel URL 换成部署后实际得到的 URL。若之后绑定前端自定义域名，也将该 origin 加入 allowlist。只为临时 Preview 测试时，可以使用 ADK 支持的正则形式 `regex:https://.*\\.vercel\\.app`；不要长期使用 `*`。

## 4. 本机端到端预检（建议）

在后端和 tunnel 都运行时：

1. 打开 `https://api.example.com/docs`，确认 ADK OpenAPI 页面能通过 tunnel 访问。
2. 在另一个终端运行前端开发服务器：

   ```sh
   cd frontend
   VITE_API_BASE_URL=https://api.example.com \
     pnpm --filter @workspace/coffee-coach run dev
   ```

3. 在浏览器完成一次冷启动 → 反馈 → probe → 轨迹。若浏览器报 CORS，先核对第 3 步的前端 origin 是否精确匹配。

## 5. 导入并部署 Vercel 前端（手动）

账号连接、Git 授权、环境变量填值和 Deploy 都由你在 Vercel Dashboard 完成。

1. Import repository，并选择分支 `frontend-replit-v1`。
2. 在 Build and Deployment 中把 **Root Directory** 设为 `frontend`。
3. `frontend/vercel.json` 已提供 install、build 与 output 配置；不需要改为 npm，也不要用 npm 安装，因为 workspace 使用 `catalog:`。
4. 在 Environment Variables 为 Production 添加：

   ```text
   VITE_API_BASE_URL=https://api.example.com
   ```

   这是构建时变量，会被打进前端静态文件。API URL 改变时，必须更新变量并重新部署。
5. 部署后记下 Vercel 给出的 `https://...vercel.app` URL。若它与第 3 步预先填写的 URL 不同，停止后端，更新 `--allow_origins`，然后重新启动后端。

## 6. 上线验收

从 Vercel production URL 完成以下闭环：

1. 新建一包豆并取得冷启动建议。
2. 提交一杯反馈，确认出现单变量的下一步调整。
3. 再提交 probe / 后续反馈，确认轨迹能读取上一杯并继续收敛。
4. 在浏览器 Network 面板确认请求目标是 `https://api.example.com`，不是 `localhost`。

这验证的是 SPEC §3 的跨杯收敛回路在真实跨域路径上仍成立，不只是静态前端页面能打开。

## 常见故障

| 症状 | 检查顺序 |
| --- | --- |
| Vercel build 报缺少 `VITE_API_BASE_URL` | 这是保护正常生效；在 Vercel Production 环境变量填固定 API URL 后重新部署。 |
| Vercel 不认识 `catalog:` 或 workspace | Root Directory 必须是 `frontend`；确认 `frontend/package.json` 的 `packageManager` 仍是 pnpm，并保留 `pnpm-lock.yaml`。 |
| 输出目录不存在 | 不要覆盖 `frontend/vercel.json` 的 build/output 配置；本地可运行 `VITE_API_BASE_URL=https://api.example.com NODE_ENV=production pnpm --filter @workspace/coffee-coach build` 复现。 |
| 前端请求被 CORS 拦截 | ADK 的 `--allow_origins` 必须包含**实际** Vercel origin，协议、主机名和端口都要一致。 |
| `api.example.com` 无响应 | 检查 ADK 是否仍在 8000 端口运行、Cloudflare tunnel 是否 Healthy、`cloudflared` 是否仍在运行。 |
| Tunnel 连不上 Cloudflare | 这台机器网络可能阻断 IPv6 或 QUIC；使用第 2 步的 `--edge-ip-version 4 --protocol http2`。 |

## 运营边界

- Tunnel URL 固定不代表后端已上云：电脑休眠、关机、断网或进程退出都会让试用者无法使用服务。
- 每次试用会消耗你的 Vertex / 模型配额与 billing。
- 若需要 24/7、无需个人电脑在线，下一阶段应将 ADK 后端迁移到 Cloud Run；这不在当前 v1 部署范围内。
