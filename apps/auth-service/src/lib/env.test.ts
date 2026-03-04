import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getEnv, resetEnvCacheForTests } from "@/lib/env";

const ORIGINAL_ENV = process.env;

const BASE_ENV = {
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/base_account",
  AUTH_ISSUER: "https://user.stringzhao.life",
  AUTH_AUDIENCE: "base-account-client",
  AUTH_JWT_KID: "auth-key-1",
  AUTH_PRIVATE_KEY_PEM: "-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----",
  AUTH_PUBLIC_KEY_PEM: "-----BEGIN PUBLIC KEY-----\\nTEST\\n-----END PUBLIC KEY-----",
  AUTH_HASH_PEPPER: "1234567890abcdef",
} as const;

describe("getEnv", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    resetEnvCacheForTests();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    resetEnvCacheForTests();
  });

  it("rejects empty AUTH_COOKIE_DOMAIN in production", () => {
    process.env = {
      ...process.env,
      ...BASE_ENV,
      NODE_ENV: "production",
      AUTH_COOKIE_DOMAIN: "",
    };

    expect(() => getEnv()).toThrowError(/AUTH_COOKIE_DOMAIN: required in production/i);
  });

  it("rejects invalid AUTH_COOKIE_DOMAIN in production", () => {
    process.env = {
      ...process.env,
      ...BASE_ENV,
      NODE_ENV: "production",
      AUTH_COOKIE_DOMAIN: "https://user.stringzhao.life",
    };

    expect(() => getEnv()).toThrowError(/AUTH_COOKIE_DOMAIN: must be a valid domain/i);
  });

  it("accepts and normalizes AUTH_COOKIE_DOMAIN in production", () => {
    process.env = {
      ...process.env,
      ...BASE_ENV,
      NODE_ENV: "production",
      AUTH_COOKIE_DOMAIN: "  .stringzhao.life  ",
    };

    const env = getEnv();
    expect(env.AUTH_COOKIE_DOMAIN).toBe(".stringzhao.life");
  });
});
