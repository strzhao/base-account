import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { listEmailCodeLogsForAdmin, requireAdminFromAccessToken } from "@/server/auth/service";

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
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 30;

    const logs = await listEmailCodeLogsForAdmin(Number.isFinite(limit) ? limit : 30);
    return NextResponse.json({ logs });
  } catch (error) {
    return handleRouteError(error);
  }
}
