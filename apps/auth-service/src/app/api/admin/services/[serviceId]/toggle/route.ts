import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { requireAdminFromAccessToken } from "@/server/auth/service";
import { toggleAuthServiceForAdmin } from "@/server/auth/service-registry";

const toggleSchema = z.object({
  enabled: z.boolean()
});

type Params = {
  params: Promise<{
    serviceId: string;
  }>;
};

export async function POST(request: Request, context: Params) {
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
    const { serviceId } = await context.params;

    const body = await request.json().catch(() => ({}));
    const parsed = toggleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid toggle payload."
        },
        { status: 400 }
      );
    }

    const service = await toggleAuthServiceForAdmin({
      actorId: adminUser.id,
      id: serviceId,
      enabled: parsed.data.enabled
    });

    return NextResponse.json({ service });
  } catch (error) {
    return handleRouteError(error);
  }
}
