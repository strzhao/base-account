import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { suggestAuthServiceFromReturnTo } from "@/server/auth/service-registry";
import { requireAdminFromAccessToken } from "@/server/auth/service";

const suggestSchema = z.object({
  return_to: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const accessToken = readBearerOrAccessCookie(request);
    if (!accessToken) {
      return NextResponse.json(
        {
          error: "missing_access_token",
          message: "Access token is required."
        },
        { status: 401 }
      );
    }

    await requireAdminFromAccessToken(accessToken);

    const body = await request.json().catch(() => ({}));
    const parsed = suggestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid suggest payload."
        },
        { status: 400 }
      );
    }

    const suggestion = await suggestAuthServiceFromReturnTo(parsed.data.return_to);
    return NextResponse.json({ suggestion });
  } catch (error) {
    return handleRouteError(error);
  }
}
