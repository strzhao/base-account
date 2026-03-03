import { UserStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { requireAdminFromAccessToken, setUserStatusForAdmin } from "@/server/auth/service";

const statusSchema = z.object({
  status: z.nativeEnum(UserStatus)
});

async function parseBody(request: Request): Promise<{ status?: string }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await request.json().catch(() => ({}))) as { status?: string };
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const status = formData.get("status");
    return {
      status: typeof status === "string" ? status : undefined
    };
  }

  return {};
}

export async function POST(request: Request, context: { params: Promise<{ userId: string }> }) {
  try {
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

    const adminUser = await requireAdminFromAccessToken(accessToken);

    const body = await parseBody(request);
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "status must be ACTIVE or DISABLED."
        },
        { status: 400 }
      );
    }

    const { userId } = await context.params;
    const user = await setUserStatusForAdmin({
      actorId: adminUser.id,
      userId,
      status: parsed.data.status
    });

    return NextResponse.json({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
