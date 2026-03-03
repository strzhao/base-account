import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { sendLoginCode } from "@/server/auth/service";

const sendCodeSchema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = sendCodeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid email format."
        },
        { status: 400 }
      );
    }

    const result = await sendLoginCode({
      email: parsed.data.email
    });

    return NextResponse.json({
      success: true,
      requestId: result.requestId,
      ...(result.debugCode ? { debugCode: result.debugCode } : {})
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
