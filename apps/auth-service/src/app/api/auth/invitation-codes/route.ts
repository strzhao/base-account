import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { listMyInvitationCodes } from "@/server/auth/invitation";
import { resolveUserFromRequest } from "@/server/auth/request";

export async function GET(request: Request) {
  try {
    const user = await resolveUserFromRequest(request);

    const url = new URL(request.url);
    const serviceKey = url.searchParams.get("serviceKey");
    if (!serviceKey) {
      return NextResponse.json(
        { error: "invalid_input", message: "serviceKey query parameter is required." },
        { status: 400 }
      );
    }

    const result = await listMyInvitationCodes({ userId: user.id, serviceKey });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
