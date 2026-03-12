import type { EndpointSpec, QuickStep, TemplateSpec } from "@/app/docs/content-base";
import { DOC_VERSION, ISSUER } from "@/app/docs/content-base";

export const invitationCodeSteps: QuickStep[] = [
  {
    title: "生成邀请码",
    detail:
      "已登录用户调用 POST /api/auth/invitation-codes/generate，传入 serviceKey，获得 8 位邀请码。每用户每应用默认可生成 3 个。serviceKey 需先通过 CLI 注册服务：ba admin services create --origin https://your-app.example.com。"
  },
  {
    title: "分享邀请码",
    detail: "将邀请码通过任意渠道（聊天、邮件、社交媒体等）发送给受邀人。"
  },
  {
    title: "受邀人兑换",
    detail:
      "受邀人登录后调用 POST /api/auth/invitation-codes/redeem，仅需传入 code（不需要 serviceKey）。系统自动从邀请码记录中读取 serviceKey，记录邀请关系并返回 serviceKey 和邀请者 ID。"
  },
  {
    title: "下游业务处理",
    detail:
      "下游服务根据 redeem 返回的 serviceKey + creatorId 决定后续动作（如：解锁功能、发放奖励、建立推荐关系等）。"
  }
];

export const invitationCodeEndpoints: EndpointSpec[] = [
  {
    method: "POST",
    path: "/api/auth/invitation-codes/generate",
    auth: "access_token",
    purpose: "为当前用户在指定应用下生成一个一次性邀请码。每用户每应用有配额限制（默认 3）。serviceKey 需先通过 CLI 注册：ba admin services create --origin <url>。",
    requestExample: `{
  "serviceKey": "my-app"
}`,
    responseExample: `{
  "success": true,
  "invitationCode": {
    "id": "clxxx...",
    "code": "ABCD1234",
    "serviceKey": "my-app",
    "status": "ACTIVE",
    "redeemedBy": null,
    "redeemedAt": null,
    "createdAt": "2026-03-06T10:00:00.000Z"
  }
}`,
    errorNotes: [
      "401 missing_access_token",
      "400 invalid_input",
      "400 invalid_service",
      "403 invitation_quota_exceeded"
    ]
  },
  {
    method: "POST",
    path: "/api/auth/invitation-codes/redeem",
    auth: "access_token",
    purpose:
      "兑换邀请码。仅需传入 code，无需 serviceKey（系统自动从邀请码记录中读取）。一次性使用，兑换后记录邀请关系（谁邀请了谁）。普通用户不能兑换自己生成的邀请码；管理员账号可用于自助开通。",
    requestExample: `{
  "code": "ABCD1234"
}`,
    responseExample: `{
  "success": true,
  "serviceKey": "my-app",
  "creatorId": "usr_xxx"
}`,
    errorNotes: [
      "401 missing_access_token",
      "400 invalid_invitation_code",
      "400 self_redeem_not_allowed",
      "409 invitation_code_already_redeemed"
    ]
  },
  {
    method: "POST",
    path: "/api/auth/invitation-codes/validate",
    auth: "access_token",
    purpose: "仅校验邀请码有效性，不消费。仅需传入 code，无需 serviceKey。适用于前端实时校验场景。",
    requestExample: `{
  "code": "ABCD1234"
}`,
    responseExample: `{
  "valid": true,
  "serviceKey": "my-app",
  "creatorId": "usr_xxx"
}`,
    errorNotes: ["401 missing_access_token", "400 invalid_input"]
  },
  {
    method: "GET",
    path: "/api/auth/invitation-codes?serviceKey=my-app",
    auth: "access_token",
    purpose: "列出当前用户在指定应用下生成的所有邀请码及配额信息。",
    responseExample: `{
  "codes": [
    {
      "id": "clxxx...",
      "code": "ABCD1234",
      "serviceKey": "my-app",
      "status": "REDEEMED",
      "redeemedBy": "usr_yyy",
      "redeemedAt": "2026-03-06T12:00:00.000Z",
      "createdAt": "2026-03-06T10:00:00.000Z"
    }
  ],
  "quota": { "used": 1, "total": 3 }
}`,
    errorNotes: ["401 missing_access_token", "400 invalid_input"]
  },
  {
    method: "POST",
    path: "/api/auth/invitation-codes/revoke",
    auth: "access_token",
    purpose: "撤销自己生成的 ACTIVE 状态邀请码。已兑换的码不可撤销。",
    requestExample: `{
  "codeId": "clxxx..."
}`,
    responseExample: `{
  "success": true
}`,
    errorNotes: [
      "401 missing_access_token",
      "404 invitation_code_not_found",
      "403 forbidden",
      "400 invalid_invitation_code"
    ]
  }
];

export const invitationCodeTemplate: TemplateSpec = {
  id: "invitation-code-integration",
  title: "邀请码接入流程",
  runtime: "Browser / Web App",
  code: `const BASE = "https://user.stringzhao.life";
// SERVICE_KEY 需先通过 CLI 注册服务获得：
//   npm install -g @stringzhao/base-account-cli
//   ba admin services create --origin https://your-app.example.com
// 注册后会返回 serviceKey（格式：svc-xxx）
const SERVICE_KEY = "my-app";

// 1) 生成邀请码（邀请者操作）
const genRes = await fetch(BASE + "/api/auth/invitation-codes/generate", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ serviceKey: SERVICE_KEY }),
  credentials: "include"
}).then((r) => r.json());

console.log("邀请码:", genRes.invitationCode.code); // e.g. "ABCD1234"

// 2) 校验邀请码（受邀人输入时实时校验）
const valRes = await fetch(BASE + "/api/auth/invitation-codes/validate", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: "ABCD1234" }),
  credentials: "include"
}).then((r) => r.json());

if (!valRes.valid) {
  console.error("邀请码无效");
}

// 3) 兑换邀请码（受邀人确认后）
const redeemRes = await fetch(BASE + "/api/auth/invitation-codes/redeem", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: "ABCD1234" }),
  credentials: "include"
}).then((r) => r.json());

console.log("邀请者:", redeemRes.creatorId);

// 4) 查看我的邀请码和配额
const listRes = await fetch(
  BASE + "/api/auth/invitation-codes?serviceKey=" + SERVICE_KEY,
  { credentials: "include" }
).then((r) => r.json());

console.log("已用/总配额:", listRes.quota.used, "/", listRes.quota.total);`
};

export function buildInvitationCodesFeedText(): string {
  const lines: string[] = [];

  lines.push("# Base Account Invitation Codes (AI Feed)");
  lines.push(`docVersion: ${DOC_VERSION}`);
  lines.push(`issuer: ${ISSUER}`);
  lines.push("每用户每应用可生成 N 个一次性邀请码（默认 3），兑换后记录邀请关系。");
  lines.push("");
  lines.push("## 推荐工具");
  lines.push("优先使用 CLI 工具 `ba` 完成服务注册和邀请码管理，无需访问 Admin Console。");
  lines.push("安装：npm install -g @stringzhao/base-account-cli");
  lines.push("注册服务：ba admin services create --origin https://your-app.example.com");
  lines.push("生成邀请码：ba invitation-codes generate -s <serviceKey>");
  lines.push("兑换邀请码：ba invitation-codes redeem -c <code>（仅需 code，无需 serviceKey）");
  lines.push("");

  lines.push("## Integration Steps");
  invitationCodeSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}: ${step.detail}`);
  });
  lines.push("");

  lines.push("## API Endpoints");
  invitationCodeEndpoints.forEach((endpoint) => {
    lines.push(`- ${endpoint.method} ${endpoint.path}`);
    lines.push(`  auth: ${endpoint.auth}`);
    lines.push(`  purpose: ${endpoint.purpose}`);
    if (endpoint.requestExample) {
      lines.push("  request_example:");
      lines.push(endpoint.requestExample);
    }
    lines.push("  response_example:");
    lines.push(endpoint.responseExample);
    lines.push(`  errors: ${endpoint.errorNotes.join(" | ")}`);
    lines.push("");
  });

  lines.push("## Template");
  lines.push(`### ${invitationCodeTemplate.title} (${invitationCodeTemplate.runtime})`);
  lines.push(invitationCodeTemplate.code);

  return lines.join("\n");
}
