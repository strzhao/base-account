import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { resolveAdminFromRequest } from "@/server/auth/request";
import { suggestAuthServiceFromReturnTo } from "@/server/auth/service-registry";

const suggestSchema = z.object({
  return_to: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    await resolveAdminFromRequest(request);

    const body = await request.json().catch(() => ({}));
    const parsed = suggestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid suggest payload."
        },
        { status: 400 }
      );
    }

    const suggestion = await suggestAuthServiceFromReturnTo(parsed.data.return_to);
    return NextResponse.json({ suggestion });
  } catch (error) {
    return handleRouteError(error);
  }
}
