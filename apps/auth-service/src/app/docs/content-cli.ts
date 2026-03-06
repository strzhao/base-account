export type CliSection = {
  title: string;
  content: string;
};

export const cliSections: CliSection[] = [
  {
    title: "安装",
    content: `npm install -g @stringzhao/base-account-cli

安装后可使用 \`ba\` 命令。要求 Node.js >= 22。`
  },
  {
    title: "认证方式",
    content: `支持两种认证方式：

**1. API Key（推荐 AI Agent 使用）**
在 Admin Console 或通过已登录 CLI 创建 API Key：
\`\`\`bash
ba admin api-keys create --name "my-agent"
\`\`\`

然后通过环境变量或配置使用：
\`\`\`bash
# 方式 A: 环境变量（推荐）
export BA_API_KEY=ba_k_xxxxxxxx

# 方式 B: 持久化配置
ba config set api-key ba_k_xxxxxxxx
\`\`\`

**2. 交互式登录（人类用户）**
\`\`\`bash
ba login
# 输入 email → 收到验证码 → 输入验证码 → 完成
\`\`\`

认证优先级：BA_API_KEY 环境变量 > 配置文件 apiKey > 已登录的 accessToken`
  },
  {
    title: "动态命令发现",
    content: `CLI 命令不是硬编码的，而是通过 GET /api/cli/manifest 从服务端动态获取。

认证后执行任意命令时，CLI 会自动拉取 manifest 并缓存到 ~/.ba/manifest-cache.json（1 小时 TTL）。

强制刷新：
\`\`\`bash
ba manifest
\`\`\`

这意味着服务端新增能力后，CLI 无需升级即可获得新命令。`
  },
  {
    title: "核心命令",
    content: `**认证**
\`\`\`bash
ba login                           # 交互式登录
ba logout                          # 清除本地凭证
ba whoami                          # 查看当前用户
ba config set api-key <key>        # 设置 API Key
ba config set base-url <url>       # 设置服务端地址
\`\`\`

**用户管理**
\`\`\`bash
ba admin users list                # 列出所有用户
ba admin users list -q "foo@"      # 按邮箱搜索
ba admin users detail <userId>     # 用户详情（含会话和审计日志）
ba admin users set-status <userId> -s DISABLED   # 禁用用户
\`\`\`

**服务管理**
\`\`\`bash
ba admin services list             # 列出所有服务
ba admin services create --origin https://app.example.com
ba admin services toggle <serviceId> --enabled
\`\`\`

**API Key 管理**
\`\`\`bash
ba admin api-keys list             # 列出所有 API Key
ba admin api-keys create --name "ci-bot"   # 创建（仅显示一次）
ba admin api-keys revoke <id>      # 吊销
\`\`\``
  },
  {
    title: "环境变量",
    content: `| 变量 | 说明 | 默认值 |
|------|------|--------|
| BA_API_KEY | API Key（优先级最高） | — |
| BA_BASE_URL | 服务端地址 | https://user.stringzhao.life |`
  },
  {
    title: "输出格式",
    content: `所有命令输出 JSON 格式，方便 AI Agent 解析。

\`\`\`bash
ba admin users list | jq '.users[].email'
\`\`\``
  },
  {
    title: "配置文件",
    content: `CLI 配置存储在 ~/.ba/ 目录：

| 文件 | 用途 |
|------|------|
| credentials.json | 存储 accessToken / refreshToken / apiKey |
| manifest-cache.json | 命令 manifest 缓存 |

文件权限自动设置为 0600（仅 owner 可读写）。`
  }
];

export function buildCliFeedText(): string {
  const lines: string[] = [];
  lines.push("# CLI Tool (@stringzhao/base-account-cli)");
  lines.push("");
  lines.push("bin name: ba");
  lines.push("npm: npm install -g @stringzhao/base-account-cli");
  lines.push("");

  for (const section of cliSections) {
    lines.push(`## ${section.title}`);
    lines.push(section.content);
    lines.push("");
  }

  return lines.join("\n");
}
