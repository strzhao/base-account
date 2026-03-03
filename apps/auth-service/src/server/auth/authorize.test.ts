import { describe, expect, it } from "vitest";

import { AuthError } from "@/server/auth/errors";
import { buildAuthorizeCallback, buildAuthorizeQuery, buildLoginRedirectPath, parseAuthorizeRequest } from "@/server/auth/authorize";

describe("authorize helpers", () => {
  it("parses valid authorize request", () => {
    const parsed = parseAuthorizeRequest({
      service: "base-account-client",
      return_to: "https://user.stringzhao.life/app/home?tab=main",
      state: "state-token-123456"
    });

    expect(parsed.serviceId).toBe("base-account-client");
    expect(parsed.serviceName).toBe("Base Account Client");
    expect(parsed.returnTo).toContain("/app/home");
    expect(parsed.state).toBe("state-token-123456");
  });

  it("rejects unknown service", () => {
    expect(() =>
      parseAuthorizeRequest({
        service: "unknown-service",
        return_to: "https://user.stringzhao.life/anywhere",
        state: "state-token-123456"
      })
    ).toThrowError(AuthError);
  });

  it("rejects return_to outside service origin allowlist", () => {
    expect(() =>
      parseAuthorizeRequest({
        service: "base-account-client",
        return_to: "https://evil.example.com/callback",
        state: "state-token-123456"
      })
    ).toThrowError(AuthError);
  });

  it("builds authorize callback while preserving existing query", () => {
    const callback = buildAuthorizeCallback(
      "https://user.stringzhao.life/callback?source=external",
      "state-token-123456"
    );

    const parsed = new URL(callback);
    expect(parsed.searchParams.get("source")).toBe("external");
    expect(parsed.searchParams.get("authorized")).toBe("1");
    expect(parsed.searchParams.get("state")).toBe("state-token-123456");
  });

  it("builds login redirect path with authorize context", () => {
    const path = buildLoginRedirectPath({
      serviceId: "base-account-client",
      returnTo: "https://user.stringzhao.life/callback",
      state: "state-token-123456"
    });

    const url = new URL(path, "https://user.stringzhao.life");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("service")).toBe("base-account-client");
    expect(url.searchParams.get("return_to")).toBe("https://user.stringzhao.life/callback");
  });

  it("creates stable authorize query string", () => {
    const query = buildAuthorizeQuery({
      serviceId: "admin-console",
      returnTo: "http://localhost:3000/admin",
      state: "state-token-123456"
    });

    const parsed = new URLSearchParams(query);
    expect(parsed.get("service")).toBe("admin-console");
    expect(parsed.get("return_to")).toBe("http://localhost:3000/admin");
    expect(parsed.get("state")).toBe("state-token-123456");
  });
});

