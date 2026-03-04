import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { suggestAuthServicesFromAllowlist } from "@/server/auth/service-registry";
import { requireAdminFromAccessToken } from "@/server/auth/service";

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

    const suggestions = await suggestAuthServicesFromAllowlist();
    return NextResponse.json({ suggestions });
  } catch (error) {
    return handleRouteError(error);
  }
}
