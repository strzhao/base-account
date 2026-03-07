import { NextResponse } from "next/server";
import { z } from "zod";

import { createCliAuthCode } from "@/server/auth/cli-auth";
import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { getCurrentUserFromAccessToken } from "@/server/auth/service";

const schema = z.object({
  state: z.string().trim().min(6).max(512),
  port: z.number().int().min(1024).max(65535)
});

export async function POST(request: Request) {
  try {
    const accessToken = readBearerOrAccessCookie(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "missing_access_token", message: "Access token is required." },
        { status: 401 }
      );
    }

    const user = await getCurrentUserFromAccessToken(accessToken);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "state and port are required." },
        { status: 400 }
      );
    }

    const code = await createCliAuthCode(user.id);

    return NextResponse.json({
      code,
      state: parsed.data.state,
      redirectTo: `http://127.0.0.1:${parsed.data.port}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(parsed.data.state)}`
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
