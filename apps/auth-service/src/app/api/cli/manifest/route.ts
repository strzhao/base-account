import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { resolveAdminFromRequest } from "@/server/auth/request";
import { buildCliManifest } from "@/server/cli/manifest";

export async function GET(request: Request) {
  try {
    await resolveAdminFromRequest(request);
    const manifest = buildCliManifest();
    return NextResponse.json(manifest);
  } catch (error) {
    return handleRouteError(error);
  }
}
