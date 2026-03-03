import { readAccessFromCookieHeader, readRefreshFromCookieHeader } from "@/server/auth/token-cookie";

export function readBearerOrAccessCookie(request: Request): string | undefined {
  const authorization = request.headers.get("authorization");
  if (authorization) {
    const [prefix, token] = authorization.split(" ");
    if (prefix === "Bearer" && token) {
      return token;
    }
  }

  return readAccessFromCookieHeader(request.headers.get("cookie") ?? "");
}

export function readRefreshFromBodyOrCookie(request: Request, bodyRefresh?: string): string | undefined {
  if (bodyRefresh) {
    return bodyRefresh;
  }

  return readRefreshFromCookieHeader(request.headers.get("cookie") ?? "");
}
