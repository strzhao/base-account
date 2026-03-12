import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { redeemInvitationCode } from "@/server/auth/invitation";
import { resolveUserFromRequest } from "@/server/auth/request";

const schema = z.object({
  code: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const user = await resolveUserFromRequest(request);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "code is required." },
        { status: 400 }
      );
    }

    const result = await redeemInvitationCode({
      code: parsed.data.code,
      userId: user.id,
      userEmail: user.email
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return handleRouteError(error);
  }
}
