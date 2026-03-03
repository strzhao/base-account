import { Resend } from "resend";

import { getEnv } from "@/lib/env";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }

  return resendClient;
}

export async function sendLoginCodeEmail(email: string, code: string): Promise<void> {
  const env = getEnv();
  const client = getResendClient();

  if (!client) {
    if (env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required in production.");
    }

    // Debug-only fallback to keep local onboarding simple.
    console.info(`[auth] Login code for ${email}: ${code}`);
    return;
  }

  const result = await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: "Your verification code",
    text: `Your verification code is ${code}. It expires in ${Math.floor(env.EMAIL_CODE_TTL_SEC / 60)} minutes.`
  });

  if (result.error) {
    throw new Error(`Resend send failed (${result.error.name}): ${result.error.message}`);
  }

  if (!result.data?.id) {
    throw new Error("Resend send failed: missing email id in response.");
  }
}
