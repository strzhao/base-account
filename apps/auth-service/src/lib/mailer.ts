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

async function sendCodeEmail(
  email: string,
  code: string,
  opts: { subject: string; text: string; logLabel: string }
): Promise<void> {
  const env = getEnv();
  const client = getResendClient();

  if (!client) {
    if (env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is required in production.");
    }

    console.info(`[auth] ${opts.logLabel} for ${email}: ${code}`);
    return;
  }

  const result = await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: email,
    subject: opts.subject,
    text: opts.text
  });

  if (result.error) {
    throw new Error(`Resend send failed (${result.error.name}): ${result.error.message}`);
  }

  if (!result.data?.id) {
    throw new Error("Resend send failed: missing email id in response.");
  }
}

export async function sendLoginCodeEmail(email: string, code: string): Promise<void> {
  const env = getEnv();
  await sendCodeEmail(email, code, {
    subject: "Your verification code",
    text: `Your verification code is ${code}. It expires in ${Math.floor(env.EMAIL_CODE_TTL_SEC / 60)} minutes.`,
    logLabel: "Login code"
  });
}

export async function sendLinkEmailCodeEmail(email: string, code: string): Promise<void> {
  const env = getEnv();
  await sendCodeEmail(email, code, {
    subject: "Verify your backup email",
    text: `Your verification code is ${code}. It expires in ${Math.floor(env.EMAIL_CODE_TTL_SEC / 60)} minutes. This code is used to link this email as a backup email to your account.`,
    logLabel: "Link email code"
  });
}
