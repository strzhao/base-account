import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { listMyInvitationCodes } from "@/server/auth/invitation";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { getCurrentUserFromAccessToken } from "@/server/auth/service";

export async function GET(request: Request) {
  try {
    const accessToken = readBearerOrAccessCookie(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "missing_access_token", message: "Access token is required." },
        { status: 401 }
      );
    }

    const user = await getCurrentUserFromAccessToken(accessToken);

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
