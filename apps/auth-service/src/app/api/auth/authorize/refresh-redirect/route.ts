import { NextResponse } from "next/server";

import { setAuthCookies, setAccessCookieOnly } from "@/server/auth/cookies";
import { readRefreshFromCookieHeader } from "@/server/auth/token-cookie";
import { refreshSession, extractClientMeta } from "@/server/auth/service";

/**
 * GET /api/auth/authorize/refresh-redirect
 *
 * 当 /authorize 页面检测到 access_token 缺失但 refresh_token 存在时，
 * redirect 到此 route 完成 token 刷新（Server Component 不能写 cookie）。
 *
 * 成功：设置新 cookie → redirect 回 /authorize（保留原始参数）
 * 失败：redirect 回 /authorize?_refreshed=1 → 显示登录页
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("return_to") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const service = url.searchParams.get("service") ?? "";
  const prompt = url.searchParams.get("prompt") ?? "";

  // 构建回到 /authorize 的 URL
  const authorizeUrl = new URL("/authorize", url.origin);
  if (service) authorizeUrl.searchParams.set("service", service);
  if (returnTo) authorizeUrl.searchParams.set("return_to", returnTo);
  if (state) authorizeUrl.searchParams.set("state", state);
  if (prompt) authorizeUrl.searchParams.set("prompt", prompt);

  const cookieHeader = request.headers.get("cookie") ?? "";
  const refreshToken = readRefreshFromCookieHeader(cookieHeader);

  if (!refreshToken) {
    console.warn("[authorize:refresh] no_refresh_token");
    authorizeUrl.searchParams.set("_refreshed", "1");
    return NextResponse.redirect(authorizeUrl);
  }

  try {
    console.log("[authorize:refresh] attempt", { service, returnTo });

    const result = await refreshSession({
      refreshToken,
      client: extractClientMeta(request),
    });

    const response = NextResponse.redirect(authorizeUrl);

    if (result.isGraceHit) {
      setAccessCookieOnly(response, result.accessToken);
    } else {
      setAuthCookies(response, result.accessToken, result.refreshToken!);
    }

    console.log("[authorize:refresh] success");
    return response;
  } catch (error) {
    console.warn("[authorize:refresh] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    authorizeUrl.searchParams.set("_refreshed", "1");
    return NextResponse.redirect(authorizeUrl);
  }
}
