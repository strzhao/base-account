import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { resolveUserFromRequest } from "@/server/auth/request";
import { verifyAndLinkEmail } from "@/server/auth/service";

const schema = z.object({
  email: z.string().email(),
  code: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const user = await resolveUserFromRequest(request);

    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "Invalid input." },
        { status: 400 }
      );
    }

    const linked = await verifyAndLinkEmail({
      userId: user.id,
      email: parsed.data.email,
      code: parsed.data.code
    });

    return NextResponse.json({ success: true, linkedEmail: linked });
  } catch (error) {
    return handleRouteError(error);
  }
}
