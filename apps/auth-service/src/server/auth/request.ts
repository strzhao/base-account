import type { UserDTO } from "@/types/auth";

import { verifyApiKeyAndGetUser } from "@/server/auth/api-key";
import { AuthError } from "@/server/auth/errors";
import { isAdminEmail, requireAdminFromAccessToken } from "@/server/auth/service";
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

export async function resolveAdminFromRequest(request: Request): Promise<UserDTO> {
  const token = readBearerOrAccessCookie(request);
  if (!token) {
    throw new AuthError("missing_credentials", "Authentication required.", 401);
  }

  if (token.startsWith("ba_k_")) {
    const user = await verifyApiKeyAndGetUser(token);
    if (!isAdminEmail(user.email)) {
      throw new AuthError("forbidden", "Admin access required.", 403);
    }
    return user;
  }

  return requireAdminFromAccessToken(token);
}
