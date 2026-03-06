import type { EndpointSpec, QuickStep, TemplateSpec } from "@/app/docs/content-base";
import { AUDIENCE, DOC_VERSION, ISSUER, JWKS_URL } from "@/app/docs/content-base";

export const quickStartSteps: QuickStep[] = [
  {
    title: "准备环境变量",
    detail:
      "下游服务至少配置 AUTH_ISSUER、AUTH_AUDIENCE、AUTH_JWKS_URL；账号中心配置 AUTH_ALLOWED_RETURN_ORIGINS、AUTH_ALLOWED_RETURN_SUFFIXES。"
  },
  {
    title: "接入统一授权入口",
    detail: "外部服务统一跳转 /authorize?return_to&state（service 可传但会被忽略），禁止直接跳 /login。"
  },
  {
    title: "登记服务域名",
    detail: "推荐通过 CLI 注册服务：ba admin services create --origin https://your-app.example.com（也可在 Admin Console 的 Services 区域手动登记）。需先登记/启用 origin，再让外部服务发起授权。"
  },
  {
    title: "处理回跳并建立应用会话",
    detail: "回跳后在服务端读取共享 access_token cookie 验签 JWT，提取用户 email，然后创建应用自有的 gateway session cookie（HMAC 签名的 email + 过期时间）。重要：不要直接依赖共享 access_token cookie 作为日常登录态，否则跨应用切换账号会导致身份污染。"
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
    purpose: "统一授权入口。后端基于 return_to 的 origin 识别服务，未登录跳转登录页，已登录则按 consent 状态决定是否直接回跳。",
    requestExample: `?return_to=https%3A%2F%2Fai-todo.stringzhao.life%2Fauth%2Fcallback&state=opaque-state`,
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
  "?return_to=" + returnTo +
  "&state=" + encodeURIComponent(state);`
  },
  {
    id: "frontend-authorize-callback",
    title: "回跳校验 + 获取用户态（简易版）",
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

// 注意：此方式直接依赖共享 access_token cookie，
// 跨应用切换账号时会导致身份污染。
// 生产环境推荐使用下方的 "Gateway Session 模式"。
const me = await fetch("https://user.stringzhao.life/api/auth/me", {
  credentials: "include"
}).then((r) => r.json());

console.log("authorized user:", me.email);`
  },
  {
    id: "next-gateway-session",
    title: "Next.js Gateway Session 模式（推荐）",
    runtime: "Next.js App Router",
    code: `// ============================================================
// 推荐模式：每个应用创建自己的 gateway session cookie，
// 不直接依赖共享的 access_token cookie 作为日常登录态。
//
// 原因：access_token cookie 在 .stringzhao.life 域共享，
// 任一子域应用的登录/切换会覆盖其他应用的登录态。
// ============================================================

// --- 1. lib/auth-gateway-session.ts ---
// HMAC-SHA256 签名的 cookie，存储 email + 过期时间

import crypto from "node:crypto";
import { NextResponse } from "next/server";

const COOKIE_NAME = "my_app_gateway_session"; // 每个应用使用不同名称

function secret(): string {
  return process.env.AUTH_GATEWAY_SESSION_SECRET || "dev-secret";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret())
    .update(payload).digest("base64url");
}

export function createSession(email: string, ttl = 43_200): string {
  const now = Date.now();
  const data = JSON.stringify({
    email: email.trim().toLowerCase(),
    issuedAt: now,
    expiresAt: now + ttl * 1000,
  });
  const encoded = Buffer.from(data).toString("base64url");
  return encoded + "." + sign(encoded);
}

export function verifySession(raw: string) {
  const [encoded, sig] = raw.split(".", 2);
  if (!encoded || !sig) return null;
  const expected = sign(encoded);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)))
      return null;
  } catch { return null; }
  const parsed = JSON.parse(
    Buffer.from(encoded, "base64url").toString()
  );
  if (Date.now() > parsed.expiresAt) return null;
  return { email: parsed.email };
}

export function applySessionCookie(res: NextResponse, value: string) {
  res.cookies.set({
    name: COOKIE_NAME, value, path: "/",
    httpOnly: true, secure: true, sameSite: "lax",
    maxAge: 43_200,
  });
}

// --- 2. app/api/auth/session/finalize/route.ts ---
// 回跳后调用此接口：读取共享 access_token → 验签 JWT → 创建本地会话

import { jwtVerify } from "jose";

export async function POST(request: Request) {
  // 从 cookie 中读取共享 access_token（一次性使用）
  const cookies = request.headers.get("cookie") || "";
  const match = cookies.match(/access_token=([^;]+)/);
  const accessToken = match ? decodeURIComponent(match[1]) : "";

  if (!accessToken) {
    return Response.json({ error: "missing_access_token" }, { status: 401 });
  }

  // JWT 验签
  const { payload } = await jwtVerify(accessToken, jwksResolver, {
    issuer: process.env.AUTH_ISSUER,
    audience: process.env.AUTH_AUDIENCE,
  });

  // 创建应用自有的 gateway session cookie
  const res = NextResponse.json({ ok: true, email: payload.email });
  applySessionCookie(res, createSession(payload.email as string));
  return res;
}

// --- 3. 中间件或页面：检查 gateway session ---

export async function middleware(request: NextRequest) {
  const raw = request.cookies.get(COOKIE_NAME)?.value;
  const session = raw ? verifySession(raw) : null;
  if (!session) {
    return NextResponse.redirect(new URL("/auth/start", request.url));
  }
  return NextResponse.next();
}`
  }
];

export const rolloutChecklist: string[] = [
  "AUTH_ISSUER 与账号服务域名保持一致（当前: https://user.stringzhao.life）。",
  "AUTH_AUDIENCE 在账号服务和下游服务严格一致（当前: base-account-client）。",
  "AUTH_JWKS_URL 配置为 https://user.stringzhao.life/.well-known/jwks.json。",
  "新接入服务需要先登记并启用 origin。推荐使用 CLI：ba admin services create --origin <url>（也可在 Admin Console -> Services 手动操作）。",
  "/authorize 的 service 参数已弃用（兼容保留，但后端不再依赖该参数判定服务）。",
  "AUTH_ALLOWED_RETURN_ORIGINS 建议至少包含 http://localhost:3000, https://user.stringzhao.life, https://stringzhao.life。",
  "AUTH_ALLOWED_RETURN_SUFFIXES 建议配置为 .stringzhao.life,.vercel.app（一次覆盖你全部 Vercel 服务）。",
  "外部服务统一从 /authorize 进入登录授权流程，不直接拼接 /login。",
  "业务接口对 401/403/429 做显式处理，不把鉴权失败当系统异常。",
  "access_token / refresh_token cookie 在 .stringzhao.life 域共享，任一子域的登录/切换会覆盖所有子域的登录态。接入方应创建应用自有的 gateway session cookie（参考模板），避免跨应用账号污染。",
  "上线后至少做一次 send-code / verify-code / me 全链路回归。"
];

export const externalIntegrationChecklist: string[] = [
  "授权入口统一改为 /authorize?return_to=<absolute_url>&state=<opaque_state>。",
  "service 参数可传可不传（兼容保留），但不能再用于服务身份判定。",
  "发起授权前生成并持久化 state（建议 randomUUID + sessionStorage）。",
  "回跳后必须校验 authorized=1 且 returned state 与本地 state 完全一致。",
  "每个业务回跳域名（return_to origin）需先开通并启用。推荐使用 CLI：ba admin services create --origin <url>（也可在 /admin -> Services 手动操作）。",
  "回跳后在服务端读取共享 access_token cookie 并验签 JWT（避免前端 CORS），然后创建应用自有的 gateway session cookie 作为日常登录态。不建议直接依赖共享 access_token cookie（跨应用账号污染风险）。",
  "后端 JWT 验签配置保持一致：AUTH_ISSUER、AUTH_AUDIENCE、AUTH_JWKS_URL。",
  "业务侧显式处理 400 invalid_service / 400 invalid_return_to / 401 invalid_access_token。",
  "上线前至少完成首次授权、重复授权直跳、停用服务拦截、icon 展示回退四项回归。"
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
    fix: "检查 AUTH_ALLOWED_RETURN_ORIGINS / AUTH_ALLOWED_RETURN_SUFFIXES，确认 return_to 域名在放行范围内。"
  },
  {
    title: "400 invalid_service",
    fix: "当前 return_to origin 尚未开通。推荐使用 CLI 注册：ba admin services create --origin <url>（也可在 Admin Console -> Services 手动登记并启用）。"
  },
  {
    title: "回跳后 state mismatch",
    fix: "确认发起授权前本地持久化 state，并在回跳时严格比对 returned state。"
  },
  {
    title: "跨应用账号被覆盖",
    fix: "access_token cookie 在 .stringzhao.life 域共享，任一子域的登录/切换会影响所有子域。解决方案：每个应用创建自己的 gateway session cookie（如 ai_todo_gateway_session），回跳后一次性读取 access_token 验签 JWT 建立本地会话，后续不再依赖共享 cookie。"
  }
];

function appendEndpointsFeed(lines: string[], endpoints: EndpointSpec[]): void {
  endpoints.forEach((endpoint) => {
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
}

export function buildAuthFeedText(): string {
  const lines: string[] = [];

  lines.push("# Base Account Auth Integration (AI Feed)");
  lines.push(`docVersion: ${DOC_VERSION}`);
  lines.push(`issuer: ${ISSUER}`);
  lines.push(`audience: ${AUDIENCE}`);
  lines.push(`jwksUrl: ${JWKS_URL}`);
  lines.push("");

  lines.push("## 推荐工具");
  lines.push("优先使用 CLI 工具 `ba` 完成服务注册和管理操作，无需访问 Admin Console。");
  lines.push("安装：npm install -g @stringzhao/base-account-cli");
  lines.push("注册服务：ba admin services create --origin https://your-app.example.com");
  lines.push("");
  lines.push("## Integration Steps");
  quickStartSteps.forEach((step, index) => {
    lines.push(`${index + 1}. ${step.title}: ${step.detail}`);
  });
  lines.push("");

  lines.push("## API Contract");
  appendEndpointsFeed(lines, endpointSpecs);

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

  lines.push("## External Integration Checklist");
  externalIntegrationChecklist.forEach((item, index) => {
    lines.push(`${index + 1}. ${item}`);
  });
  lines.push("");

  lines.push("## Troubleshooting");
  troubleshooting.forEach((item) => {
    lines.push(`- ${item.title}: ${item.fix}`);
  });

  return lines.join("\n");
}
