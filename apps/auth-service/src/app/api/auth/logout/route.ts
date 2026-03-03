import { NextResponse } from "next/server";
import { z } from "zod";

import { clearAuthCookies } from "@/server/auth/cookies";
import { handleRouteError } from "@/server/auth/errors";
import { readRefreshFromBodyOrCookie } from "@/server/auth/request";
import { logoutSession } from "@/server/auth/service";

const logoutSchema = z.object({
  refreshToken: z.string().optional()
});

async function handleLogout(request: Request, refreshTokenFromBody?: string) {
  try {
    const refreshToken = readRefreshFromBodyOrCookie(request, refreshTokenFromBody);
    if (refreshToken) {
      await logoutSession(refreshToken);
    }

    const response = NextResponse.json({ success: true });
    clearAuthCookies(response);

    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = logoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_input",
        message: "Invalid logout payload."
      },
      { status: 400 }
    );
  }

  return handleLogout(request, parsed.data.refreshToken);
}

export async function GET(request: Request) {
  return handleLogout(request);
}
