import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@/lib/env";
import { buildAuthorizeCallback, buildAuthorizeQuery, buildLoginRedirectPath, parseAuthorizeRequest } from "@/server/auth/authorize";
import { AuthError } from "@/server/auth/errors";
import { resolveAuthorizeServiceByReturnTo } from "@/server/auth/service-registry";

vi.mock("@/server/auth/service-registry", () => ({
  resolveAuthorizeServiceByReturnTo: vi.fn()
}));

const resolveServiceByReturnToMock = vi.mocked(resolveAuthorizeServiceByReturnTo);

describe("authorize helpers", () => {
  beforeEach(() => {
    resetEnvCacheForTests();
    resolveServiceByReturnToMock.mockReset();
    resolveServiceByReturnToMock.mockResolvedValue({
      serviceId: "svc-user",
      serviceName: "统一账号服务",
      consentSummary: "该服务将使用你的统一账号登录状态并读取基础资料。",
      serviceIconUrl: "https://user.stringzhao.life/favicon.ico"
    });
  });

  it("parses valid authorize request and ignores incoming service value", async () => {
    const parsed = await parseAuthorizeRequest({
      service: "forged-client-id",
      return_to: "https://user.stringzhao.life/app/home?tab=main",
      state: "state-token-123456"
    });

    expect(resolveServiceByReturnToMock).toHaveBeenCalledWith(
      "https://user.stringzhao.life/app/home?tab=main"
    );
    expect(parsed.serviceId).toBe("svc-user");
    expect(parsed.serviceName).toBe("统一账号服务");
    expect(parsed.serviceIconUrl).toBe("https://user.stringzhao.life/favicon.ico");
    expect(parsed.returnTo).toContain("/app/home");
    expect(parsed.state).toBe("state-token-123456");
  });

  it("allows vercel app callback origins", async () => {
    const parsed = await parseAuthorizeRequest({
      service: "base-account-client",
      return_to: "https://ai-news-gkqip33v3-daniel21436-9089s-projects.vercel.app/callback",
      state: "state-token-123456"
    });

    expect(parsed.returnTo).toContain("vercel.app/callback");
  });

  it("allows localhost callback in development flow", async () => {
    const parsed = await parseAuthorizeRequest({
      service: "base-account-client",
      return_to: "http://localhost:5173/auth/callback",
      state: "state-token-123456"
    });

    expect(parsed.returnTo).toContain("localhost:5173");
  });

  it("rejects unregistered return_to origin", async () => {
    resolveServiceByReturnToMock.mockRejectedValueOnce(
      new AuthError("invalid_service", "当前回跳域名未开通授权服务，请联系管理员。", 400)
    );

    await expect(
      parseAuthorizeRequest({
        service: "anything",
        return_to: "https://new-app.stringzhao.life/callback",
        state: "state-token-123456"
      })
    ).rejects.toThrowError(AuthError);
  });

  it("rejects return_to outside allowlist", async () => {
    await expect(
      parseAuthorizeRequest({
        service: "base-account-client",
        return_to: "https://evil.example.com/callback",
        state: "state-token-123456"
      })
    ).rejects.toThrowError(AuthError);
  });

  it("rejects non-localhost http callback origin", async () => {
    await expect(
      parseAuthorizeRequest({
        service: "base-account-client",
        return_to: "http://ai-news.stringzhao.life/callback",
        state: "state-token-123456"
      })
    ).rejects.toThrowError(AuthError);
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
      serviceId: "svc-user",
      returnTo: "https://user.stringzhao.life/callback",
      state: "state-token-123456"
    });

    const url = new URL(path, "https://user.stringzhao.life");
    expect(url.pathname).toBe("/login");
    expect(url.searchParams.get("service")).toBe("svc-user");
    expect(url.searchParams.get("return_to")).toBe("https://user.stringzhao.life/callback");
  });

  it("creates stable authorize query string", () => {
    const query = buildAuthorizeQuery({
      serviceId: "svc-user",
      returnTo: "http://localhost:3000/admin",
      state: "state-token-123456"
    });

    const parsed = new URLSearchParams(query);
    expect(parsed.get("service")).toBe("svc-user");
    expect(parsed.get("return_to")).toBe("http://localhost:3000/admin");
    expect(parsed.get("state")).toBe("state-token-123456");
  });
});
