import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { listUsersForAdmin, requireAdminFromAccessToken } from "@/server/auth/service";

export async function GET(request: Request) {
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
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? undefined;

    const users = await listUsersForAdmin(query);
    return NextResponse.json({ users });
  } catch (error) {
    return handleRouteError(error);
  }
}
