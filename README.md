# Base Account

独立账号系统（可供多个 Vercel 产品复用）。

## 统一接入文档入口

- 本地开发：`http://localhost:3000/docs`
- 生产环境：`https://user.stringzhao.life/docs`

下游系统接入请优先使用 `/docs`，该页面包含：

1. 稳定 API 契约
2. JWT/JWKS 校验规则
3. Node/Next.js 快速模板
4. AI 可直接读取的结构化 JSON 规范

## Monorepo 结构

- `apps/auth-service`: Next.js App Router + Prisma + PostgreSQL + Resend
- `packages/auth-sdk`: Token 验证 SDK（下游服务使用）

## 本地启动

1. 安装依赖

```bash
npm install
```

2. 生成 RSA 密钥

```bash
npm run keys:generate --workspace @base-account/auth-service
```

3. 准备环境变量

```bash
cp apps/auth-service/.env.example apps/auth-service/.env.local
```

4. 把生成的 `AUTH_PRIVATE_KEY_PEM`、`AUTH_PUBLIC_KEY_PEM` 写入 `.env.local`
5. 生成 Prisma Client 并同步 schema

```bash
cd apps/auth-service
npx prisma generate
npx prisma db push
```

6. 启动服务

```bash
npm run dev
```

## 持续验收（最小 Demo）

```bash
npm run verify:auth-flow
```

该命令会对生产域名授权链路做最小冒烟验收（`/authorize` 跳转参数、`/api/auth/me` 未登录行为、非法 `return_to` 拦截）。

## 持续验收（GitHub Actions）

仓库已包含工作流：`.github/workflows/auth-flow-verify.yml`

- 手动触发：`Actions -> Auth Flow Verify -> Run workflow`
- 定时巡检：每 6 小时自动执行一次
- 默认目标：`https://user.stringzhao.life`

## 稳定核心接口

- `POST /api/auth/send-code`
- `POST /api/auth/verify-code`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /.well-known/jwks.json`

## 快速接入（下游服务）

1. 安装并使用 `@stringzhao/auth-sdk`
2. 配置：
   - `AUTH_ISSUER=https://user.stringzhao.life`
   - `AUTH_AUDIENCE=base-account-client`
   - `AUTH_JWKS_URL=https://user.stringzhao.life/.well-known/jwks.json`
   - 在账号服务 `/admin` -> `Services` 先登记并启用业务回跳域名（`return_to` origin）
3. 在业务网关或中间件统一校验 Bearer token

详细可复制代码见 `/docs` 页面。
