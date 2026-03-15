import { NextResponse } from "next/server";
import { z } from "zod";

import { setAccessCookieOnly, setAuthCookies } from "@/server/auth/cookies";
import { handleRouteError } from "@/server/auth/errors";
import { readRefreshFromBodyOrCookie } from "@/server/auth/request";
import { extractClientMeta, refreshSession } from "@/server/auth/service";

const refreshSchema = z.object({
  refreshToken: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = refreshSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid refresh token payload."
        },
        { status: 400 }
      );
    }

    const refreshToken = readRefreshFromBodyOrCookie(request, parsed.data.refreshToken);
    if (!refreshToken) {
      return NextResponse.json(
        {
          error: "missing_refresh_token",
          message: "Refresh token is required."
        },
        { status: 401 }
      );
    }

    const result = await refreshSession({
      refreshToken,
      client: extractClientMeta(request)
    });

    console.log("[auth:refresh] success", { isGraceHit: result.isGraceHit });

    const response = NextResponse.json(result);

    if (result.isGraceHit) {
      // Grace period hit: only set access_token cookie.
      // The first concurrent request already set the new refresh_token.
      setAccessCookieOnly(response, result.accessToken);
    } else {
      setAuthCookies(response, result.accessToken, result.refreshToken!);
    }

    return response;
  } catch (error) {
    console.warn("[auth:refresh] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleRouteError(error);
  }
}
