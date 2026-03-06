import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { validateInvitationCode } from "@/server/auth/invitation";
import { resolveUserFromRequest } from "@/server/auth/request";

const schema = z.object({
  code: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    await resolveUserFromRequest(request);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "code is required." },
        { status: 400 }
      );
    }

    const result = await validateInvitationCode(parsed.data.code);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
