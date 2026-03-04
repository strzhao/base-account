import { machineReadableSpec } from "@/app/docs/content";

export async function GET() {
  try {
    return Response.json(machineReadableSpec, {
      status: 200,
      headers: {
        "cache-control": "no-store"
      }
    });
  } catch {
    return new Response("Failed to generate docs machine spec.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
}
