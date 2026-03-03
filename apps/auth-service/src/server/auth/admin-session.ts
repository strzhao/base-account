import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authCookieNames } from "@/server/auth/cookies";
import { requireAdminFromAccessToken } from "@/server/auth/service";

export async function requireAdminFromCookies() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(authCookieNames.access)?.value;

  if (!accessToken) {
    redirect("/login");
  }

  try {
    return await requireAdminFromAccessToken(accessToken);
  } catch {
    redirect("/login");
  }
}
