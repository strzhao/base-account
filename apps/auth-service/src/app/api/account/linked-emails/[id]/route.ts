import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { resolveUserFromRequest } from "@/server/auth/request";
import { removeLinkedEmail } from "@/server/auth/service";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await resolveUserFromRequest(request);
    const { id } = await params;

    await removeLinkedEmail({ userId: user.id, linkedEmailId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
