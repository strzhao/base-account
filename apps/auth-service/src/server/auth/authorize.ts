import { AuthError } from "@/server/auth/errors";

export type AuthorizeQueryInput = {
  service: string | string[] | undefined;
  return_to: string | string[] | undefined;
  state: string | string[] | undefined;
};

export type AuthorizeService = {
  id: string;
  displayName: string;
  consentSummary: string;
  allowedOrigins: string[];
};

export type AuthorizeRequest = {
  serviceId: string;
  serviceName: string;
  consentSummary: string;
  returnTo: string;
  state: string;
};

const SHARED_SERVICE_ORIGINS = ["http://localhost:3000", "https://user.stringzhao.life"];

const SERVICE_REGISTRY: Record<string, AuthorizeService> = {
  "base-account-client": {
    id: "base-account-client",
    displayName: "Base Account Client",
    consentSummary: "Sign you in and access your base account profile.",
    allowedOrigins: SHARED_SERVICE_ORIGINS
  },
  "admin-console": {
    id: "admin-console",
    displayName: "Admin Console",
    consentSummary: "Access your admin privileges and account management dashboard.",
    allowedOrigins: SHARED_SERVICE_ORIGINS
  },
  "integration-docs": {
    id: "integration-docs",
    displayName: "Integration Docs",
    consentSummary: "Sign you in for personalized integration guides and examples.",
    allowedOrigins: SHARED_SERVICE_ORIGINS
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
    throw new AuthError("invalid_authorize_request", `Missing required query: ${name}.`, 400);
  }

  return value;
}

function validateReturnTo(returnTo: string, service: AuthorizeService): string {
  let parsed: URL;
  try {
    parsed = new URL(returnTo);
  } catch {
    throw new AuthError("invalid_return_to", "return_to must be an absolute URL.", 400);
  }

  if (!service.allowedOrigins.includes(parsed.origin)) {
    throw new AuthError("invalid_return_to", "return_to origin is not allowed for this service.", 400, {
      service: service.id,
      allowedOrigins: service.allowedOrigins
    });
  }

  if (parsed.username || parsed.password) {
    throw new AuthError("invalid_return_to", "return_to must not include credentials.", 400);
  }

  return parsed.toString();
}

function validateState(rawState: string): string {
  if (rawState.length < 6 || rawState.length > 512) {
    throw new AuthError("invalid_state", "state length must be between 6 and 512 characters.", 400);
  }

  return rawState;
}

export function parseAuthorizeRequest(input: AuthorizeQueryInput): AuthorizeRequest {
  const serviceId = requireQueryValue("service", input.service);
  const returnToRaw = requireQueryValue("return_to", input.return_to);
  const stateRaw = requireQueryValue("state", input.state);

  const service = SERVICE_REGISTRY[serviceId];
  if (!service) {
    throw new AuthError("invalid_service", "Unknown service id.", 400, {
      service: serviceId,
      availableServices: Object.keys(SERVICE_REGISTRY)
    });
  }

  return {
    serviceId: service.id,
    serviceName: service.displayName,
    consentSummary: service.consentSummary,
    returnTo: validateReturnTo(returnToRaw, service),
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

