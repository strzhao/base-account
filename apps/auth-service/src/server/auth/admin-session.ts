import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { requireAdminFromAccessToken } from "@/server/auth/service";
import { readAccessFromCookieStore } from "@/server/auth/token-cookie";

export async function requireAdminFromCookies() {
  const cookieStore = await cookies();
  const accessToken = readAccessFromCookieStore(cookieStore);

  if (!accessToken) {
    redirect("/login");
  }

  try {
    return await requireAdminFromAccessToken(accessToken);
  } catch {
    redirect("/login");
  }
}
