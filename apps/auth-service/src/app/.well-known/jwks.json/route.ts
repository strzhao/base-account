import { NextResponse } from "next/server";

import { getPublicJwks } from "@/lib/jwt";

export async function GET() {
  const jwks = await getPublicJwks();

  return NextResponse.json(jwks, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=600"
    }
  });
}
