import { z } from "zod";

const DEFAULT_ALLOWED_RETURN_ORIGINS =
  "http://localhost:3000,https://user.stringzhao.life,https://stringzhao.life";
const DEFAULT_ALLOWED_RETURN_SUFFIXES = ".stringzhao.life,.vercel.app";

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
  ADMIN_EMAILS: z.string().optional().default(""),
  AUTH_ALLOWED_RETURN_ORIGINS: z.string().optional().default(DEFAULT_ALLOWED_RETURN_ORIGINS),
  AUTH_ALLOWED_RETURN_SUFFIXES: z.string().optional().default(DEFAULT_ALLOWED_RETURN_SUFFIXES)
});

export type RuntimeEnv = z.infer<typeof envSchema> & {
  adminEmailSet: Set<string>;
};

const authorizeEnvSchema = z.object({
  AUTH_ALLOWED_RETURN_ORIGINS: z.string().optional().default(DEFAULT_ALLOWED_RETURN_ORIGINS),
  AUTH_ALLOWED_RETURN_SUFFIXES: z.string().optional().default(DEFAULT_ALLOWED_RETURN_SUFFIXES)
});

export type AuthorizeReturnPolicy = {
  allowedReturnOrigins: Set<string>;
  allowedReturnSuffixes: string[];
};

let cachedEnv: RuntimeEnv | null = null;
let cachedAuthorizeReturnPolicy: AuthorizeReturnPolicy | null = null;

function parseMultilinePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function splitCsv(input: string): string[] {
  return input
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeOrigin(input: string): string {
  try {
    const parsed = new URL(input);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.origin.toLowerCase();
  } catch {
    return "";
  }
}

function normalizeDomainSuffix(input: string): string {
  const normalized = input.trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized.startsWith(".") ? normalized.slice(1) : normalized;
}

function isValidCookieDomain(input: string): boolean {
  const normalized = normalizeDomainSuffix(input);
  if (!normalized) return false;
  if (normalized.includes("://") || normalized.includes("/") || normalized.includes(" ")) {
    return false;
  }
  if (!normalized.includes(".")) return false;
  if (normalized.endsWith(".")) return false;
  if (normalized === "localhost") return false;
  return /^[a-z0-9.-]+$/.test(normalized);
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
  const cookieDomain = parsed.data.AUTH_COOKIE_DOMAIN.trim();

  if (parsed.data.NODE_ENV === "production") {
    if (!cookieDomain) {
      throw new Error(
        "Invalid environment variables: AUTH_COOKIE_DOMAIN: required in production (expected .stringzhao.life)"
      );
    }
    if (!isValidCookieDomain(cookieDomain)) {
      throw new Error(
        "Invalid environment variables: AUTH_COOKIE_DOMAIN: must be a valid domain (for example .stringzhao.life)"
      );
    }
  }

  cachedEnv = {
    ...parsed.data,
    AUTH_COOKIE_DOMAIN: cookieDomain,
    AUTH_PRIVATE_KEY_PEM: parseMultilinePem(parsed.data.AUTH_PRIVATE_KEY_PEM),
    AUTH_PUBLIC_KEY_PEM: parseMultilinePem(parsed.data.AUTH_PUBLIC_KEY_PEM),
    adminEmailSet
  };

  return cachedEnv;
}

export function getAuthorizeReturnPolicy(): AuthorizeReturnPolicy {
  if (cachedAuthorizeReturnPolicy) {
    return cachedAuthorizeReturnPolicy;
  }

  const parsed = authorizeEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid authorize return policy env: ${issues}`);
  }

  const allowedReturnOrigins = new Set(
    splitCsv(parsed.data.AUTH_ALLOWED_RETURN_ORIGINS)
      .map(normalizeOrigin)
      .filter(Boolean)
  );

  const allowedReturnSuffixes = splitCsv(parsed.data.AUTH_ALLOWED_RETURN_SUFFIXES)
    .map(normalizeDomainSuffix)
    .filter(Boolean);

  cachedAuthorizeReturnPolicy = {
    allowedReturnOrigins,
    allowedReturnSuffixes
  };

  return cachedAuthorizeReturnPolicy;
}

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
  cachedAuthorizeReturnPolicy = null;
}
