import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { revokeInvitationCode } from "@/server/auth/invitation";
import { resolveUserFromRequest } from "@/server/auth/request";

const schema = z.object({
  codeId: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const user = await resolveUserFromRequest(request);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "codeId is required." },
        { status: 400 }
      );
    }

    await revokeInvitationCode({
      codeId: parsed.data.codeId,
      userId: user.id
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
