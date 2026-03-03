export const DOC_VERSION = "2026-03-03.2";
export const ISSUER = "https://user.stringzhao.life";
export const AUDIENCE = "base-account-client";
export const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;

export type QuickStep = {
  title: string;
  detail: string;
};

export type EndpointSpec = {
  method: "GET" | "POST";
  path: string;
  auth: "none" | "access_token" | "refresh_token";
  purpose: string;
  requestExample?: string;
  responseExample: string;
  errorNotes: string[];
};

export type TemplateSpec = {
  id: string;
  title: string;
  runtime: string;
  code: string;
};

export const quickStartSteps: QuickStep[] = [
  {
    title: "准备环境变量",
    detail: "下游服务至少配置 AUTH_ISSUER、AUTH_AUDIENCE、AUTH_JWKS_URL。"
  },
  {
    title: "接入统一授权入口",
    detail: "外部服务统一跳转 /authorize?service&return_to&state，禁止直接跳 /login。"
  },
  {
    title: "处理回跳并拉取用户态",
    detail: "回跳后先校验 state，再调用 /api/auth/me（credentials: include）获取当前用户。"
  },
  {
    title: "按需接入 JWT 校验",
    detail: "如果你的服务需要在后端验签 access token，再接入 auth-sdk 的 JWKS 验签。"
  }
];

export const endpointSpecs: EndpointSpec[] = [
  {
    method: "GET",
    path: "/authorize",
    auth: "none",
    purpose: "统一授权入口。未登录跳转登录页，已登录则按 consent 状态决定是否直接回跳。",
    requestExample: `?service=base-account-client&return_to=https%3A%2F%2Fuser.stringzhao.life%2Fapp&state=opaque-state`,
    responseExample: `302 -> /login?... 或 302 -> return_to?authorized=1&state=opaque-state`,
    errorNotes: ["400 invalid_authorize_request", "400 invalid_return_to", "400 invalid_service", "400 invalid_state"]
  },
  {
    method: "POST",
    path: "/api/auth/send-code",
    auth: "none",
    purpose: "发送邮箱验证码，返回 requestId。",
    requestExample: `{
  "email": "user@example.com"
}`,
    responseExample: `{
  "success": true,
  "requestId": "8e8531eb-5ca9-4b89-a4a5-57bbe5cc526e"
}`,
    errorNotes: ["400 invalid_input", "429 rate_limited", "502 email_delivery_failed"]
  },
  {
    method: "POST",
    path: "/api/auth/verify-code",
    auth: "none",
    purpose: "校验验证码并签发 access/refresh token（同时写入 cookie）。",
    requestExample: `{
  "email": "user@example.com",
  "code": "123456"
}`,
    responseExample: `{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "user": {
    "id": "usr_xxx",
    "email": "user@example.com",
    "status": "ACTIVE"
  }
}`,
    errorNotes: ["400 invalid_code", "429 too_many_attempts", "403 account_disabled"]
  },
  {
    method: "POST",
    path: "/api/auth/authorize/approve",
    auth: "access_token",
    purpose: "用户在首次授权页点击同意后写入 consent 记录并返回回跳地址。",
    requestExample: `{
  "service": "base-account-client",
  "return_to": "https://user.stringzhao.life/app",
  "state": "opaque-state"
}`,
    responseExample: `{
  "success": true,
  "redirectTo": "https://user.stringzhao.life/app?authorized=1&state=opaque-state"
}`,
    errorNotes: ["401 missing_access_token", "400 invalid_input", "400 invalid_return_to", "400 invalid_service"]
  },
  {
    method: "POST",
    path: "/api/auth/refresh",
    auth: "refresh_token",
    purpose: "刷新 access token 和 refresh token。",
    responseExample: `{
  "accessToken": "<new-jwt>",
  "refreshToken": "<new-opaque>",
  "expiresIn": 900
}`,
    errorNotes: ["401 invalid_refresh_token", "400 missing_refresh_token"]
  },
  {
    method: "POST",
    path: "/api/auth/logout",
    auth: "refresh_token",
    purpose: "注销当前会话并清理 cookie。",
    responseExample: `{
  "success": true
}`,
    errorNotes: ["200 幂等，refresh token 失效也可安全调用"]
  },
  {
    method: "GET",
    path: "/api/auth/me",
    auth: "access_token",
    purpose: "获取当前 access token 对应用户信息。",
    responseExample: `{
  "id": "usr_xxx",
  "email": "user@example.com",
  "status": "ACTIVE",
  "createdAt": "2026-03-03T07:00:00.000Z",
  "updatedAt": "2026-03-03T07:00:00.000Z",
  "lastLoginAt": "2026-03-03T07:10:00.000Z"
}`,
    errorNotes: ["401 missing_access_token", "401 invalid_access_token"]
  },
  {
    method: "GET",
    path: "/.well-known/jwks.json",
    auth: "none",
    purpose: "下游服务用于验证 JWT 的公钥集合。",
    responseExample: `{
  "keys": [
    {
      "kty": "RSA",
      "kid": "auth-key-1",
      "alg": "RS256"
    }
  ]
}`,
    errorNotes: ["必须公网可访问，且与 AUTH_ISSUER 保持同源策略"]
  }
];

export const templateSpecs: TemplateSpec[] = [
  {
    id: "node-middleware",
    title: "Node / Express 鉴权中间件",
    runtime: "Node 20+ / Express",
    code: `import express from "express";
import { createRemoteJwksVerifier } from "@stringzhao/auth-sdk";

const app = express();

const verifier = createRemoteJwksVerifier({
  jwksUrl: process.env.AUTH_JWKS_URL!,
  config: {
    issuer: process.env.AUTH_ISSUER!,
    audience: process.env.AUTH_AUDIENCE!
  }
});

async function authGuard(req, res, next) {
  try {
    const raw = req.headers.authorization ?? "";
    const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
    if (!token) {
      return res.status(401).json({ error: "missing_access_token" });
    }

    const user = await verifier.verifyAccessToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: "invalid_access_token",
      message: error instanceof Error ? error.message : "unknown"
    });
  }
}

app.get("/api/private", authGuard, (req, res) => {
  res.json({ ok: true, user: req.user });
});`
  },
  {
    id: "next-route-handler",
    title: "Next.js Route Handler 保护接口",
    runtime: "Next.js App Router",
    code: `import { NextResponse } from "next/server";
import { createRemoteJwksVerifier } from "@stringzhao/auth-sdk";

const verifier = createRemoteJwksVerifier({
  jwksUrl: process.env.AUTH_JWKS_URL!,
  config: {
    issuer: process.env.AUTH_ISSUER!,
    audience: process.env.AUTH_AUDIENCE!
  }
});

export async function GET(request: Request) {
  const raw = request.headers.get("authorization") ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice(7) : "";
  if (!token) {
    return NextResponse.json(
      { error: "missing_access_token" },
      { status: 401 }
    );
  }

  try {
    const user = await verifier.verifyAccessToken(token);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      {
        error: "invalid_access_token",
        message: error instanceof Error ? error.message : "unknown"
      },
      { status: 401 }
    );
  }
}`
  },
  {
    id: "frontend-login-flow",
    title: "前端最小登录流程",
    runtime: "Browser / SPA",
    code: `// 1) 发送验证码
await fetch("https://user.stringzhao.life/api/auth/send-code", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "user@example.com" }),
  credentials: "include"
});

// 2) 校验验证码
await fetch("https://user.stringzhao.life/api/auth/verify-code", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ email: "user@example.com", code: "123456" }),
  credentials: "include"
});

// 3) 获取当前用户（/me 直接返回 user DTO）
const me = await fetch("https://user.stringzhao.life/api/auth/me", {
  credentials: "include"
}).then((r) => r.json());

console.log(me.id, me.email);`
  },
  {
    id: "frontend-authorize-entry",
    title: "外部服务统一授权入口",
    runtime: "Browser / Web App",
    code: `const state = crypto.randomUUID();
const returnTo = encodeURIComponent("https://user.stringzhao.life/app");

window.location.href =
  "https://user.stringzhao.life/authorize" +
  "?service=base-account-client" +
  "&return_to=" + returnTo +
  "&state=" + encodeURIComponent(state);`
  },
  {
    id: "frontend-authorize-callback",
    title: "回跳校验 + 获取用户态",
    runtime: "Browser / Web App",
    code: `// 发起授权前保存 state
const state = crypto.randomUUID();
sessionStorage.setItem("auth_state", state);

// ...跳转 /authorize 后，用户会回到 return_to
const callback = new URL(window.location.href);
const returnedState = callback.searchParams.get("state");
const authorized = callback.searchParams.get("authorized");

if (returnedState !== sessionStorage.getItem("auth_state")) {
  throw new Error("state mismatch");
}
if (authorized !== "1") {
  throw new Error("authorization not completed");
}

const me = await fetch("https://user.stringzhao.life/api/auth/me", {
  credentials: "include"
}).then((r) => r.json());

console.log("authorized user:", me.email);`
  }
];

export const rolloutChecklist: string[] = [
  "AUTH_ISSUER 与账号服务域名保持一致（当前: https://user.stringzhao.life）。",
  "AUTH_AUDIENCE 在账号服务和下游服务严格一致（当前: base-account-client）。",
  "AUTH_JWKS_URL 配置为 https://user.stringzhao.life/.well-known/jwks.json。",
  "接入前确认 serviceId 与 return_to origin 已在账号中心白名单注册。",
  "外部服务统一从 /authorize 进入登录授权流程，不直接拼接 /login。",
  "业务接口对 401/403/429 做显式处理，不把鉴权失败当系统异常。",
  "上线后至少做一次 send-code / verify-code / me 全链路回归。"
];

export const troubleshooting: Array<{ title: string; fix: string }> = [
  {
    title: "401 invalid_access_token",
    fix: "优先检查 issuer、audience 是否与账号服务完全一致。"
  },
  {
    title: "429 rate_limited",
    fix: "验证码发送命中冷却窗口，前端按 retryAfterSeconds 控制重试。"
  },
  {
    title: "502 email_delivery_failed",
    fix: "检查 RESEND_API_KEY、RESEND_FROM_EMAIL、Resend 域名验证状态。"
  },
  {
    title: "400 invalid_return_to",
    fix: "当前 return_to 的 origin 未进入服务白名单，联系账号服务维护 serviceId -> allowedOrigins。"
  },
  {
    title: "回跳后 state mismatch",
    fix: "确认发起授权前本地持久化 state，并在回跳时严格比对 returned state。"
  }
];

export const machineReadableSpec = {
  docVersion: DOC_VERSION,
  generatedAt: "2026-03-03",
  service: "base-account-auth",
  issuer: ISSUER,
  audience: AUDIENCE,
  jwksUrl: JWKS_URL,
  authorizeContract: {
    entryPath: "/authorize",
    requiredQuery: ["service", "return_to", "state"],
    callbackQuery: ["authorized", "state"]
  },
  endpoints: endpointSpecs.map((item) => ({
    method: item.method,
    path: item.path,
    auth: item.auth,
    purpose: item.purpose,
    errors: item.errorNotes
  })),
  integrationSteps: quickStartSteps,
  templates: templateSpecs.map((item) => ({
    id: item.id,
    title: item.title,
    runtime: item.runtime
  })),
  checklist: rolloutChecklist
};

export function buildAiFeedText(): string {
  const lines: string[] = [];

  lines.push("# Base Account Integration Pack (AI Feed)");
  lines.push(`docVersion: ${DOC_VERSION}`);
  lines.push(`issuer: ${ISSUER}`);
  lines.push(`audience: ${AUDIENCE}`);
  lines.push(`jwksUrl: ${JWKS_URL}`);
  lines.push("");
  lines.push("## Integration Steps");
  quickStartSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}: ${step.detail}`);
  });
  lines.push("");
  lines.push("## API Contract");
  endpointSpecs.forEach((endpoint) => {
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

  lines.push("## Templates");
  templateSpecs.forEach((template) => {
    lines.push(`### ${template.title} (${template.runtime})`);
    lines.push(template.code);
    lines.push("");
  });

  lines.push("## Deployment Checklist");
  rolloutChecklist.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });
  lines.push("");

  lines.push("## Machine Readable JSON");
  lines.push(JSON.stringify(machineReadableSpec, null, 2));

  return lines.join("\n");
}
