import { NextResponse } from "next/server";
import { z } from "zod";

import { exchangeCliAuthCode } from "@/server/auth/cli-auth";
import { handleRouteError } from "@/server/auth/errors";

const schema = z.object({
  code: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "code is required." },
        { status: 400 }
      );
    }

    const result = await exchangeCliAuthCode(parsed.data.code);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
