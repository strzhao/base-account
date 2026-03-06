import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { resolveAdminFromRequest } from "@/server/auth/request";
import { suggestAuthServicesFromAllowlist } from "@/server/auth/service-registry";

export async function POST(request: Request) {
  try {
    await resolveAdminFromRequest(request);

    const suggestions = await suggestAuthServicesFromAllowlist();
    return NextResponse.json({ suggestions });
  } catch (error) {
    return handleRouteError(error);
  }
}
