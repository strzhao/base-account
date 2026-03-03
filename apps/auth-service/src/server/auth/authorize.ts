import { AuthError } from "@/server/auth/errors";
import { getAuthorizeReturnPolicy } from "@/lib/env";

export type AuthorizeQueryInput = {
  service: string | string[] | undefined;
  return_to: string | string[] | undefined;
  state: string | string[] | undefined;
};

export type AuthorizeService = {
  id: string;
  displayName: string;
  consentSummary: string;
};

export type AuthorizeRequest = {
  serviceId: string;
  serviceName: string;
  consentSummary: string;
  returnTo: string;
  state: string;
};

const SERVICE_REGISTRY: Record<string, AuthorizeService> = {
  "base-account-client": {
    id: "base-account-client",
    displayName: "统一账号服务",
    consentSummary: "该服务将使用你的统一账号登录状态并读取基础资料。"
  },
  "admin-console": {
    id: "admin-console",
    displayName: "管理控制台",
    consentSummary: "该服务将使用你的统一账号登录状态并读取基础资料。"
  },
  "integration-docs": {
    id: "integration-docs",
    displayName: "接入文档中心",
    consentSummary: "该服务将使用你的统一账号登录状态并读取基础资料。"
  }
};

function getSingleValue(raw: string | string[] | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  if (Array.isArray(raw)) {
    return raw[0]?.trim() || undefined;
  }

  const value = raw.trim();
  return value.length > 0 ? value : undefined;
}

function requireQueryValue(name: string, raw: string | string[] | undefined): string {
  const value = getSingleValue(raw);
  if (!value) {
    throw new AuthError("invalid_authorize_request", `缺少必要参数：${name}。`, 400);
  }

  return value;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function matchesDomainSuffix(hostname: string, suffixes: string[]): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return suffixes.some((suffix) => normalizedHostname === suffix || normalizedHostname.endsWith(`.${suffix}`));
}

function validateReturnTo(returnTo: string, serviceId: string): string {
  let parsed: URL;
  try {
    parsed = new URL(returnTo);
  } catch {
    throw new AuthError("invalid_return_to", "return_to 必须是绝对 URL。", 400);
  }

  if (parsed.username || parsed.password) {
    throw new AuthError("invalid_return_to", "return_to 不能包含用户名或密码。", 400);
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const origin = parsed.origin.toLowerCase();
  const policy = getAuthorizeReturnPolicy();

  const exactMatchAllowed = policy.allowedReturnOrigins.has(origin);
  const isLoopbackAllowed = protocol === "http:" && isLoopbackHost(hostname);
  const httpsSuffixAllowed = protocol === "https:" && matchesDomainSuffix(hostname, policy.allowedReturnSuffixes);

  if (protocol !== "http:" && protocol !== "https:") {
    throw new AuthError("invalid_return_to", "仅支持 http 或 https 协议。", 400);
  }

  if (!exactMatchAllowed && !isLoopbackAllowed && !httpsSuffixAllowed) {
    throw new AuthError("invalid_return_to", "return_to origin 不在授权白名单内。", 400, {
      service: serviceId,
      origin,
      allowedReturnOrigins: Array.from(policy.allowedReturnOrigins),
      allowedReturnSuffixes: policy.allowedReturnSuffixes.map((suffix) => `*.${suffix}`)
    });
  }

  if (protocol === "http:" && !isLoopbackAllowed) {
    throw new AuthError("invalid_return_to", "非本地环境回跳地址必须使用 https。", 400);
  }

  return parsed.toString();
}

function validateState(rawState: string): string {
  if (rawState.length < 6 || rawState.length > 512) {
    throw new AuthError("invalid_state", "state 长度必须在 6 到 512 个字符之间。", 400);
  }

  return rawState;
}

export function parseAuthorizeRequest(input: AuthorizeQueryInput): AuthorizeRequest {
  const serviceId = requireQueryValue("service", input.service);
  const returnToRaw = requireQueryValue("return_to", input.return_to);
  const stateRaw = requireQueryValue("state", input.state);

  const service = SERVICE_REGISTRY[serviceId];
  if (!service) {
    throw new AuthError("invalid_service", "未知的 service 参数。", 400, {
      service: serviceId,
      availableServices: Object.keys(SERVICE_REGISTRY)
    });
  }

  return {
    serviceId: service.id,
    serviceName: service.displayName,
    consentSummary: service.consentSummary,
    returnTo: validateReturnTo(returnToRaw, service.id),
    state: validateState(stateRaw)
  };
}

export function buildAuthorizeQuery(input: Pick<AuthorizeRequest, "serviceId" | "returnTo" | "state">): string {
  const searchParams = new URLSearchParams();
  searchParams.set("service", input.serviceId);
  searchParams.set("return_to", input.returnTo);
  searchParams.set("state", input.state);
  return searchParams.toString();
}

export function buildLoginRedirectPath(input: Pick<AuthorizeRequest, "serviceId" | "returnTo" | "state">): string {
  return `/login?${buildAuthorizeQuery(input)}`;
}

export function buildAuthorizeCallback(returnTo: string, state: string): string {
  const callbackUrl = new URL(returnTo);
  callbackUrl.searchParams.set("authorized", "1");
  callbackUrl.searchParams.set("state", state);
  return callbackUrl.toString();
}
