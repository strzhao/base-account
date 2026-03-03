import { NextResponse } from "next/server";
import { z } from "zod";

import { buildAuthorizeCallback, parseAuthorizeRequest } from "@/server/auth/authorize";
import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { getCurrentUserFromAccessToken, grantServiceConsent } from "@/server/auth/service";

const approveSchema = z.object({
  service: z.string().trim().min(1),
  return_to: z.string().trim().min(1),
  state: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = approveSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid authorize approval payload."
        },
        { status: 400 }
      );
    }

    const authorizeRequest = parseAuthorizeRequest(parsed.data);
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

    const currentUser = await getCurrentUserFromAccessToken(accessToken);
    await grantServiceConsent({
      userId: currentUser.id,
      serviceId: authorizeRequest.serviceId
    });

    return NextResponse.json({
      success: true,
      redirectTo: buildAuthorizeCallback(authorizeRequest.returnTo, authorizeRequest.state)
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

