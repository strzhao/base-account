import { NextResponse } from "next/server";

import { revokeApiKey } from "@/server/auth/api-key";
import { handleRouteError } from "@/server/auth/errors";
import { resolveAdminFromRequest } from "@/server/auth/request";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await resolveAdminFromRequest(request);
    const { id } = await params;
    await revokeApiKey(id, admin.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
