import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRouteError } from "@/server/auth/errors";
import { resolveAdminFromRequest } from "@/server/auth/request";
import {
  createAuthServiceForAdmin,
  listAuthServicesForAdmin
} from "@/server/auth/service-registry";

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
    await resolveAdminFromRequest(request);

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
    const adminUser = await resolveAdminFromRequest(request);

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
