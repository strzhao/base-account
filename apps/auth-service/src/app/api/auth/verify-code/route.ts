import { NextResponse } from "next/server";
import { z } from "zod";

import { setAuthCookies } from "@/server/auth/cookies";
import { handleRouteError } from "@/server/auth/errors";
import { extractClientMeta, verifyLoginCode } from "@/server/auth/service";

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().trim().min(4).max(8)
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = verifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid email or verification code format."
        },
        { status: 400 }
      );
    }

    const authResult = await verifyLoginCode({
      email: parsed.data.email,
      code: parsed.data.code,
      client: extractClientMeta(request)
    });

    console.log("[auth:login] success", { email: parsed.data.email });

    const response = NextResponse.json(authResult);
    setAuthCookies(response, authResult.accessToken, authResult.refreshToken);

    return response;
  } catch (error) {
    console.warn("[auth:login] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return handleRouteError(error);
  }
}
