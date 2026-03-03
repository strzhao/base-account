import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { getCurrentUserFromAccessToken } from "@/server/auth/service";

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

    const user = await getCurrentUserFromAccessToken(accessToken);
    return NextResponse.json(user);
  } catch (error) {
    return handleRouteError(error);
  }
}
