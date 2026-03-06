import { buildAiFeedText } from "@/app/docs/content";
import { buildAuthFeedText } from "@/app/docs/content-auth";
import { buildCliFeedText } from "@/app/docs/content-cli";
import { buildInvitationCodesFeedText } from "@/app/docs/content-invitation";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const topic = url.searchParams.get("topic");

    let payload: string;
    if (topic === "auth") {
      payload = buildAuthFeedText();
    } else if (topic === "invitation-codes") {
      payload = buildInvitationCodesFeedText();
    } else if (topic === "cli") {
      payload = buildCliFeedText();
    } else {
      payload = buildAiFeedText();
    }

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
