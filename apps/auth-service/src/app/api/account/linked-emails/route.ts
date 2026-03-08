import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/auth/errors";
import { resolveUserFromRequest } from "@/server/auth/request";
import { listLinkedEmails } from "@/server/auth/service";

export async function GET(request: Request) {
  try {
    const user = await resolveUserFromRequest(request);
    const linkedEmails = await listLinkedEmails(user.id);
    return NextResponse.json({ linkedEmails });
  } catch (error) {
    return handleRouteError(error);
  }
}
