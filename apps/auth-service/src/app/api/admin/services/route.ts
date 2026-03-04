import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { readBearerOrAccessCookie } from "@/server/auth/request";
import {
  createAuthServiceForAdmin,
  listAuthServicesForAdmin
} from "@/server/auth/service-registry";
import { requireAdminFromAccessToken } from "@/server/auth/service";

const createServiceSchema = z.object({
  origin: z.string().trim().min(1),
  displayName: z.string().trim().min(1).optional(),
  serviceKey: z.string().trim().min(1).optional(),
  iconUrl: z.string().optional(),
  consentSummary: z.string().trim().min(1).optional(),
  enabled: z.boolean().optional()
});

export async function GET(request: Request) {
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

    await requireAdminFromAccessToken(accessToken);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? undefined;
    const services = await listAuthServicesForAdmin(query);
    return NextResponse.json({ services });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}));
    const parsed = createServiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_input",
          message: "Invalid service payload."
        },
        { status: 400 }
      );
    }

    const service = await createAuthServiceForAdmin({
      actorId: adminUser.id,
      ...parsed.data
    });

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
