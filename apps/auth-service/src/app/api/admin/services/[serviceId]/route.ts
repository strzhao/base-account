import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import { requireAdminFromAccessToken } from "@/server/auth/service";
import { updateAuthServiceForAdmin } from "@/server/auth/service-registry";

const updateServiceSchema = z
  .object({
    origin: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
    iconUrl: z.string().optional(),
    consentSummary: z.string().trim().min(1).optional()
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required."
  });

type Params = {
  params: Promise<{
    serviceId: string;
  }>;
};

export async function PATCH(request: Request, context: Params) {
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
    const parsed = updateServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid update payload."
        },
        { status: 400 }
      );
    }

    const service = await updateAuthServiceForAdmin({
      actorId: adminUser.id,
      id: serviceId,
      ...parsed.data
    });

    return NextResponse.json({ service });
  } catch (error) {
    return handleRouteError(error);
  }
}
