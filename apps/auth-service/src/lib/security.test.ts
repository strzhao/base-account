import { describe, expect, it } from "vitest";

import { compareHash, generateNumericCode, hashValue, normalizeEmail } from "@/lib/security";

describe("security helpers", () => {
  it("normalizes email", () => {
    expect(normalizeEmail("  Admin@Example.COM ")).toBe("admin@example.com");
  });

  it("hashes and compares values with pepper", () => {
    const pepper = "very-strong-pepper-value";
    const hashed = hashValue("123456", pepper);

    expect(compareHash("123456", hashed, pepper)).toBe(true);
    expect(compareHash("999999", hashed, pepper)).toBe(false);
  });

  it("creates fixed-length numeric code", () => {
    const code = generateNumericCode(6);

    expect(code).toHaveLength(6);
    expect(/^\d+$/.test(code)).toBe(true);
  });
});
