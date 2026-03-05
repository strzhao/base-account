import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { createInvitationCode } from "@/server/auth/invitation";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { getCurrentUserFromAccessToken } from "@/server/auth/service";

const schema = z.object({
  serviceKey: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const accessToken = readBearerOrAccessCookie(request);
    if (!accessToken) {
      return NextResponse.json(
        { error: "missing_access_token", message: "Access token is required." },
        { status: 401 }
      );
    }

    const user = await getCurrentUserFromAccessToken(accessToken);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "serviceKey is required." },
        { status: 400 }
      );
    }

    const invitationCode = await createInvitationCode({
      userId: user.id,
      serviceKey: parsed.data.serviceKey
    });

    return NextResponse.json({ success: true, invitationCode }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
