import { NextResponse } from "next/server";
import { z } from "zod";

import { setAuthCookies } from "@/server/auth/cookies";
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

    const response = NextResponse.json(result);
    setAuthCookies(response, result.accessToken, result.refreshToken);

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
