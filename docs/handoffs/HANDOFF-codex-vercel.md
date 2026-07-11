# Handoff · Codex:前端 Vercel 部署配置(选项 B)

> **背景**:v1 要发给少量试用者(A 收反馈 + C 作品集)。方案:后端走 Cloudflare **命名隧道**(固定 URL,用户正在接入域名到 Cloudflare)+ 前端上 **Vercel**(稳定 URL)。
> **你现在做的**:准备好 Vercel 部署的**全部配置**,只留"后端 URL"这一个值待用户填(命名隧道 URL 要等域名接入 Cloudflare 后才有)。
> **⚠️ 分工红线**:Vercel 账号连接/授权、环境变量填值、真正触发部署 = **用户手动**(凭证操作)。你只准备配置 + 文档,不连账号、不代部署。
> **工作位置**:分支 `frontend-replit-v1`,前端在 `frontend/`(pnpm monorepo,coffee-coach 在 `frontend/artifacts/coffee-coach/`)。

---

## 核心挑战:pnpm monorepo + catalog 协议在 Vercel

前端是 pnpm workspace,用了 `catalog:` 协议(用户本地已确认 npm 不认 catalog,只能 pnpm)。Vercel 默认构建可能不认 catalog / 不会正确处理 workspace 子包。**这是这次配置的主要难点。**

### C1 · 让 Vercel 能 build coffee-coach 这个 workspace 子包
- 配置 Vercel 从 monorepo 根安装(pnpm workspace),但只 build 并输出 coffee-coach。
- 确认 Vercel 用的 **pnpm 版本够新**(支持 catalog:协议)。若 Vercel 默认 pnpm 太旧,指定版本(如通过 `packageManager` 字段或 Vercel 设置)。
- 可能需要的配置(择需产出):
  - `vercel.json`(在 monorepo 根或 coffee-coach):指定 buildCommand、outputDirectory、installCommand
  - Root Directory 设置:指向 coffee-coach 或根 + filter
  - build command 类似:`pnpm --filter @workspace/coffee-coach build`(包名以实际 package.json name 为准)
  - install command:`pnpm install`(在根,装整个 workspace)
  - output:coffee-coach 的 `dist`

### C2 · 后端 URL 作为构建时环境变量(留占位)
- 前端读 `VITE_API_BASE_URL`(构建时打进产物)。
- 在 Vercel 配置里,这个值走 **Vercel 环境变量**(用户在 Vercel dashboard 填,值 = 命名隧道 URL `https://api.用户域名.com`,现在还没有,留占位说明)。
- **不要**硬编码任何后端 URL。确认前端所有后端地址都来自这个环境变量。
- ⚠️ 提醒:VITE_ 前缀的环境变量是**构建时**注入的,后端 URL 变了要**重新部署**前端才生效。命名隧道是固定 URL,所以配好一次长期有效——但要在 runbook 里写明"若后端 URL 变了需重新部署"。

### C3 · 剔除本地平台特有的东西
- 用户本地为跑 dev 补了 darwin-x64 原生模块(esbuild/rollup/lightningcss/oxide)。**这些不该进 Vercel 构建**——Vercel 是 Linux,会装 linux 的原生模块。
- 确认 `pnpm-lock.yaml` 不含强制 darwin 平台的锁定(用户已 restore 过 lock,复核)。确认 Vercel 构建时能装 Linux 原生模块。
- 若 lock 里有 darwin optionalDependencies 残留导致 Vercel 装错平台,处理掉。

### C4 · CORS(前端 Vercel 域名 → 后端隧道)
- 前端最终是 Vercel 域名(`xxx.vercel.app`),后端是命名隧道域名。跨域。
- 后端 ADK 启动的 `--allow_origins` 要放行 Vercel 前端域名(或试用期 `*`)。
- 在 runbook 里写明:后端启动命令要带前端 Vercel 域名到 allow_origins。

### C5 · 产出 `docs/DEPLOY.md` Runbook
把完整部署流程写成清单,区分**用户手动**和**已配好**:

用户手动步骤(写进 runbook 供参照):
1. 域名接入 Cloudflare(改 nameserver,等 DNS 生效)
2. 创建命名隧道(one.dash.cloudflare.com → Tunnels → 加 public hostname `api.域名` → service `http://localhost:8000`),拿到固定后端 URL
3. 本机跑命名隧道(替代 quick tunnel)+ 起后端(带 CORS 放行 Vercel 域名 + service account 凭证)+ 起前端 dev(本地验证)
4. Vercel:连账号、导入 repo(分支 frontend-replit-v1)、按 C1 配置、填环境变量 VITE_API_BASE_URL=命名隧道 URL、部署
5. 验证:访问 Vercel URL,走冷启动→反馈→probe→轨迹,确认通过隧道连后端

已知坑(写进 runbook):
- 隧道命令本机网络需 `--edge-ip-version 4 --protocol http2`(IPv6/QUIC 被挡)—— 但命名隧道走 dashboard token 方式,复核是否仍需
- 后端 + 隧道要用户机器开着(即使命名隧道 URL 固定,服务仍在本地)
- 每次试用消耗用户 Vertex 配额(billing)
- catalog/monorepo 的 Vercel 构建注意点

---

## 验收
- [ ] C1 Vercel 能 build monorepo 子包(catalog 兼容,pnpm 版本够新)
- [ ] C2 后端 URL 走环境变量,无硬编码,留占位待填
- [ ] C3 无 darwin 平台锁定污染 Vercel 构建
- [ ] C4 CORS 方案给出
- [ ] C5 `docs/DEPLOY.md` runbook 完整,分清用户手动 vs 已配好
- [ ] 未连 Vercel 账号、未代填凭证、未代部署

## 边界
- 这是 A+C 试用部署:后端仍在用户本机(命名隧道给固定 URL,但服务本地),非后端上云。
- 若将来要真正 24/7 不依赖用户机器 → 后端上 Cloud Run(另议)。
