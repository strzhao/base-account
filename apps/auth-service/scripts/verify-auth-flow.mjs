#!/usr/bin/env node

import { randomUUID } from "node:crypto";

const DEFAULT_BASE_URL = "https://user.stringzhao.life";
const DEFAULT_RETURN_TO = "https://user.stringzhao.life/app";
const DEFAULT_VERCEL_RETURN_TO = "https://smoke-demo.vercel.app/callback";
const DEFAULT_INVALID_RETURN_TO = "https://evil.example.com/callback";

function printHelp() {
  console.log(`
最小授权流程验收脚本

用法:
  node apps/auth-service/scripts/verify-auth-flow.mjs [options]

选项:
  --base-url <url>     账号服务地址（默认: ${DEFAULT_BASE_URL}）
  --service <id>       兼容参数（已弃用，可不传）
  --return-to <url>    白名单回跳地址（默认: ${DEFAULT_RETURN_TO}）
  --state <value>      state 参数（默认随机 UUID）
  --strict             严格模式（告警也会导致退出码为 1）
  --help               查看帮助

示例:
  npm run verify:auth-flow
  npm run verify:auth-flow -- --base-url https://user.stringzhao.life --strict
`);
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    service: "",
    returnTo: DEFAULT_RETURN_TO,
    state: randomUUID(),
    strict: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--strict") {
      options.strict = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      throw new Error(`不支持的参数: ${arg}`);
    }

    const [key, valueFromEq] = arg.slice(2).split("=");
    const nextValue = valueFromEq ?? argv[i + 1];
    if (!valueFromEq) {
      i += 1;
    }
    if (!nextValue) {
      throw new Error(`参数缺少值: --${key}`);
    }

    if (key === "base-url") {
      options.baseUrl = nextValue;
    } else if (key === "service") {
      options.service = nextValue;
    } else if (key === "return-to") {
      options.returnTo = nextValue;
    } else if (key === "state") {
      options.state = nextValue;
    } else {
      throw new Error(`未知参数: --${key}`);
    }
  }

  return options;
}

function normalizeAbsoluteUrl(raw, fieldName) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${fieldName} 必须是绝对 URL: ${raw}`);
  }
  return url.toString();
}

function buildAuthorizeUrl(baseUrl, service, returnTo, state) {
  const url = new URL("/authorize", baseUrl);
  if (service) {
    url.searchParams.set("service", service);
  }
  url.searchParams.set("return_to", returnTo);
  url.searchParams.set("state", state);
  return url;
}

async function fetchWithTimeout(input, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      headers: {
        "user-agent": "base-account-auth-flow-verifier/1.0",
        ...(init.headers ?? {})
      },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function isRedirectStatus(status) {
  return status >= 300 && status < 400;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function checkAuthorizeRedirect({
  baseUrl,
  service,
  returnTo,
  state
}) {
  const authorizeUrl = buildAuthorizeUrl(baseUrl, service, returnTo, state);
  const response = await fetchWithTimeout(authorizeUrl, { redirect: "manual" });

  assert(
    isRedirectStatus(response.status),
    `预期 /authorize 返回 3xx，实际 ${response.status}`
  );

  const location = response.headers.get("location");
  assert(location, "缺少 location 头");

  const loginUrl = new URL(location, baseUrl);
  assert(loginUrl.pathname === "/login", `预期跳转 /login，实际 ${loginUrl.pathname}`);

  const resolvedService = loginUrl.searchParams.get("service");
  assert(resolvedService, "跳转参数缺少 service（应由后端按域名解析后回填）");

  const returnedState = loginUrl.searchParams.get("state");
  assert(returnedState === state, "跳转参数 state 不一致");

  const expectedReturnTo = normalizeAbsoluteUrl(returnTo, "return_to");
  const returnedReturnTo = normalizeAbsoluteUrl(
    loginUrl.searchParams.get("return_to") ?? "",
    "location.return_to"
  );
  assert(returnedReturnTo === expectedReturnTo, "跳转参数 return_to 不一致");

  return `status=${response.status}, location=${loginUrl.pathname}`;
}

async function checkVercelAllowlist({
  baseUrl,
  service,
  state
}) {
  const authorizeUrl = buildAuthorizeUrl(baseUrl, service, DEFAULT_VERCEL_RETURN_TO, state);
  const response = await fetchWithTimeout(authorizeUrl, { redirect: "manual" });

  if (isRedirectStatus(response.status)) {
    return `status=${response.status}, vercel callback accepted`;
  }

  const body = await response.text();
  const blockedByReturnTo = body.includes("invalid_return_to") || body.includes("return_to origin");
  if (blockedByReturnTo) {
    throw new Error("vercel.app 回跳地址被当作非法 return_to 拒绝");
  }

  const blockedByService =
    body.includes("invalid_service") ||
    body.includes("未开通授权服务") ||
    body.includes("请求已拦截");
  if (blockedByService) {
    return "vercel.app 域名已通过白名单校验（Services 未开通，属预期）";
  }

  return {
    warning: `vercel.app 校验返回 ${response.status}，请人工确认`
  };
}

async function checkMeUnauthorized(baseUrl) {
  const meUrl = new URL("/api/auth/me", baseUrl);
  const response = await fetchWithTimeout(meUrl, { redirect: "manual" });
  assert(response.status === 401, `预期 /api/auth/me 返回 401，实际 ${response.status}`);

  const payload = await response.json().catch(() => null);
  assert(
    payload?.error === "missing_access_token",
    `预期 error=missing_access_token，实际 ${JSON.stringify(payload)}`
  );

  return "status=401, error=missing_access_token";
}

async function checkInvalidReturnTo({
  baseUrl,
  service,
  state
}) {
  const authorizeUrl = buildAuthorizeUrl(baseUrl, service, DEFAULT_INVALID_RETURN_TO, state);
  const response = await fetchWithTimeout(authorizeUrl, { redirect: "manual" });

  const location = response.headers.get("location");
  if (isRedirectStatus(response.status) && location) {
    const redirectUrl = new URL(location, baseUrl);
    assert(
      redirectUrl.pathname !== "/login",
      `非法 return_to 不应跳到 /login，实际 location=${redirectUrl.toString()}`
    );
  }

  const body = await response.text();
  const hasExpectedHint =
    body.includes("请求已拦截") ||
    body.includes("invalid_return_to") ||
    body.includes("return_to origin");

  if (!hasExpectedHint) {
    return {
      warning: "非法 return_to 已被阻断，但响应文案未命中预期关键字"
    };
  }

  return `status=${response.status}, invalid return_to blocked`;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  options.baseUrl = normalizeAbsoluteUrl(options.baseUrl, "base-url");
  options.returnTo = normalizeAbsoluteUrl(options.returnTo, "return-to");

  const checks = [];
  const startTime = Date.now();

  function record(status, name, detail) {
    checks.push({ status, name, detail });
    const marker = status === "pass" ? "PASS" : status === "warn" ? "WARN" : "FAIL";
    console.log(`[${marker}] ${name}${detail ? ` - ${detail}` : ""}`);
  }

  async function runCheck(name, fn) {
    try {
      const result = await fn();
      if (result && typeof result === "object" && "warning" in result) {
        record("warn", name, result.warning);
      } else {
        record("pass", name, typeof result === "string" ? result : "");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      record("fail", name, message);
    }
  }

  console.log("=== Base Account 授权链路验收 ===");
  console.log(`baseUrl:  ${options.baseUrl}`);
  console.log(`service:  ${options.service || "(not set, deprecated)"}`);
  console.log(`returnTo: ${options.returnTo}`);
  console.log(`state:    ${options.state}`);
  console.log("");

  await runCheck("白名单域名 /authorize 跳转校验", () =>
    checkAuthorizeRedirect({
      baseUrl: options.baseUrl,
      service: options.service,
      returnTo: options.returnTo,
      state: options.state
    })
  );

  await runCheck("vercel.app 白名单校验", () =>
    checkVercelAllowlist({
      baseUrl: options.baseUrl,
      service: options.service,
      state: `${options.state}-vercel`
    })
  );

  await runCheck("未登录 /api/auth/me 校验", () => checkMeUnauthorized(options.baseUrl));

  await runCheck("非法 return_to 拦截校验", () =>
    checkInvalidReturnTo({
      baseUrl: options.baseUrl,
      service: options.service,
      state: `${options.state}-blocked`
    })
  );

  const passCount = checks.filter((item) => item.status === "pass").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;
  const failCount = checks.filter((item) => item.status === "fail").length;
  const durationMs = Date.now() - startTime;
  const shouldFail = failCount > 0 || (options.strict && warnCount > 0);

  console.log("");
  console.log("=== 验收结果 ===");
  console.log(`PASS: ${passCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log(`FAIL: ${failCount}`);
  console.log(`耗时: ${durationMs}ms`);

  if (warnCount > 0 && !options.strict) {
    console.log("存在告警（非严格模式不会使脚本失败）。");
  }

  if (shouldFail) {
    console.error("授权链路验收失败，请检查上方失败项。");
    process.exitCode = 1;
    return;
  }

  console.log("授权链路验收通过。");
}

run().catch((error) => {
  console.error("脚本执行异常:", error);
  process.exitCode = 1;
});
