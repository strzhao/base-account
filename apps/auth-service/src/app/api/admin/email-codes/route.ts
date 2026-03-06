import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { resolveAdminFromRequest } from "@/server/auth/request";
import { listEmailCodeLogsForAdmin } from "@/server/auth/service";

export async function GET(request: Request) {
  try {
    await resolveAdminFromRequest(request);

    const { searchParams } = new URL(request.url);
    const limitRaw = searchParams.get("limit");
    const limit = limitRaw ? Number(limitRaw) : 30;

    const logs = await listEmailCodeLogsForAdmin(Number.isFinite(limit) ? limit : 30);
    return NextResponse.json({ logs });
  } catch (error) {
    return handleRouteError(error);
  }
}
