import { buildAiFeedText } from "@/app/docs/content";

export async function GET() {
  try {
    const payload = buildAiFeedText();
    return new Response(payload, {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  } catch {
    return new Response("Failed to generate docs AI payload.", {
      status: 500,
      headers: {
        "content-type": "text/plain; charset=utf-8"
      }
    });
  }
}
