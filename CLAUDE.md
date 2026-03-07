## 部署

- Vercel 工程名：**base-account-auth**（不是 base-account）
- 生产域名：https://user.stringzhao.life
- 部署命令：`vercel --prod`

## CLI Manifest 设计原则

- CLI（@stringzhao/base-account-cli）的所有业务命令通过 GET /api/cli/manifest 动态获取
- Manifest 是 CLI 命令的唯一来源，新增 CLI 命令只需在 `src/server/cli/manifest.ts` 中注册
- CLI 侧不硬编码业务命令，保持薄执行器角色
