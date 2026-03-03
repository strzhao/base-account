import { z } from "zod";

const intFromEnv = (defaultValue: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }

    const num = Number(value);
    return Number.isNaN(num) ? value : num;
  }, z.number().int().positive());

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  AUTH_ISSUER: z.string().url().default("http://localhost:3000"),
  AUTH_AUDIENCE: z.string().min(1).default("base-account-client"),
  AUTH_JWT_KID: z.string().min(1).default("auth-key-1"),
  AUTH_PRIVATE_KEY_PEM: z.string().min(1),
  AUTH_PUBLIC_KEY_PEM: z.string().min(1),
  AUTH_HASH_PEPPER: z.string().min(16),
  AUTH_COOKIE_DOMAIN: z.string().optional().default(""),
  ACCESS_TOKEN_EXPIRES_IN_SEC: intFromEnv(900),
  REFRESH_TOKEN_EXPIRES_IN_SEC: intFromEnv(60 * 60 * 24 * 30),
  EMAIL_CODE_TTL_SEC: intFromEnv(600),
  EMAIL_CODE_COOLDOWN_SEC: intFromEnv(60),
  EMAIL_CODE_MAX_ATTEMPTS: intFromEnv(5),
  RESEND_API_KEY: z.string().optional().default(""),
  RESEND_FROM_EMAIL: z.string().default("auth@example.com"),
  ADMIN_EMAILS: z.string().optional().default("")
});

export type RuntimeEnv = z.infer<typeof envSchema> & {
  adminEmailSet: Set<string>;
};

let cachedEnv: RuntimeEnv | null = null;

function parseMultilinePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

export function getEnv(): RuntimeEnv {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${issues}`);
  }

  const adminEmailSet = new Set(
    parsed.data.ADMIN_EMAILS.split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );

  cachedEnv = {
    ...parsed.data,
    AUTH_PRIVATE_KEY_PEM: parseMultilinePem(parsed.data.AUTH_PRIVATE_KEY_PEM),
    AUTH_PUBLIC_KEY_PEM: parseMultilinePem(parsed.data.AUTH_PUBLIC_KEY_PEM),
    adminEmailSet
  };

  return cachedEnv;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}
