import { NextResponse } from "next/server";
import { z } from "zod";

import { createApiKey, listApiKeys } from "@/server/auth/api-key";
import { handleRouteError } from "@/server/auth/errors";
import { resolveAdminFromRequest } from "@/server/auth/request";

const createSchema = z.object({
  name: z.string().trim().min(1).max(100)
});

export async function GET(request: Request) {
  try {
    const admin = await resolveAdminFromRequest(request);
    const keys = await listApiKeys(admin.id);
    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await resolveAdminFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_input", message: "A valid name is required." },
        { status: 400 }
      );
    }

    const result = await createApiKey(admin.id, parsed.data.name);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
