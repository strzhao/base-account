import { ActorType, Prisma, type AuthServiceApp } from "@prisma/client";

import { getAuthorizeReturnPolicy } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { AuthError } from "@/server/auth/errors";
import type { AdminServiceDTO, AdminServiceSuggestionDTO } from "@/types/auth";

const DEFAULT_CONSENT_SUMMARY = "该服务将使用你的统一账号登录状态并读取基础资料。";
const SERVICE_KEY_MAX_LENGTH = 48;

type AdminServiceRecord = Pick<
  AuthServiceApp,
  | "id"
  | "serviceKey"
  | "displayName"
  | "origin"
  | "hostname"
  | "iconUrl"
  | "iconMode"
  | "consentSummary"
  | "enabled"
  | "createdAt"
  | "updatedAt"
>;

type SuggestionBase = {
  origin: string;
  hostname: string;
  serviceKey: string;
  displayName: string;
  iconUrl: string;
  consentSummary: string;
};

type ParseUrlErrorCode = "invalid_input" | "invalid_return_to";

type ParseUrlInput = {
  raw: string;
  fieldName: string;
  errorCode: ParseUrlErrorCode;
};

type CreateAuthServiceInput = {
  actorId: string;
  origin: string;
  displayName?: string;
  serviceKey?: string;
  iconUrl?: string;
  consentSummary?: string;
  enabled?: boolean;
};

type UpdateAuthServiceInput = {
  actorId: string;
  id: string;
  origin?: string;
  displayName?: string;
  iconUrl?: string;
  consentSummary?: string;
};

type ToggleAuthServiceInput = {
  actorId: string;
  id: string;
  enabled: boolean;
};

type ResolveAuthorizeServiceResult = {
  serviceId: string;
  serviceName: string;
  consentSummary: string;
  serviceIconUrl: string | null;
};

function parseAbsoluteHttpUrl(input: ParseUrlInput): URL {
  let parsed: URL;
  try {
    parsed = new URL(input.raw);
  } catch {
    throw new AuthError(input.errorCode, `${input.fieldName} 必须是绝对 URL。`, 400);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new AuthError(input.errorCode, `${input.fieldName} 仅支持 http 或 https 协议。`, 400);
  }

  if (parsed.username || parsed.password) {
    throw new AuthError(input.errorCode, `${input.fieldName} 不能包含用户名或密码。`, 400);
  }

  return parsed;
}

function normalizeOrigin(url: URL): string {
  return url.origin.toLowerCase();
}

function normalizeHostname(url: URL): string {
  return url.hostname.toLowerCase();
}

function formatTitleCase(raw: string): string {
  return raw
    .split(/[^a-z0-9]+/i)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function simplifyVercelLabel(hostname: string): string {
  const firstLabel = hostname.split(".")[0] ?? "";
  const parts = firstLabel.split("-").filter(Boolean);

  if (parts.length <= 3) {
    return firstLabel;
  }

  // Vercel preview hosts frequently append branch/hash/user tokens at the tail.
  const trimmed = parts.slice(0, Math.max(1, parts.length - 3)).join("-");
  return trimmed || firstLabel;
}

function buildDisplayNameFromHostname(hostname: string): string {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "Localhost App";
  }

  const normalized = hostname.replace(/^www\./, "");
  const vercelBase = normalized.endsWith(".vercel.app")
    ? simplifyVercelLabel(normalized)
    : normalized.split(".")[0] ?? normalized;
  const displayName = formatTitleCase(vercelBase);
  return displayName || "External Service";
}

function sanitizeServiceKeySeed(seed: string): string {
  const normalized = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalized) {
    return "service";
  }

  return normalized.slice(0, SERVICE_KEY_MAX_LENGTH - 4);
}

function buildDefaultServiceKeySeed(hostname: string): string {
  const normalized = hostname.replace(/^www\./, "");
  if (normalized.endsWith(".vercel.app")) {
    return simplifyVercelLabel(normalized);
  }
  return normalized.split(".")[0] ?? normalized;
}

function normalizeServiceKey(input?: string): string {
  const trimmed = (input ?? "").trim().toLowerCase();
  const withoutPrefix = trimmed.startsWith("svc-") ? trimmed.slice(4) : trimmed;
  return sanitizeServiceKeySeed(withoutPrefix);
}

function buildFaviconUrl(origin: string): string {
  const url = new URL("/favicon.ico", origin);
  return url.toString();
}

function toAdminServiceDTO(record: AdminServiceRecord): AdminServiceDTO {
  return {
    id: record.id,
    serviceKey: record.serviceKey,
    displayName: record.displayName,
    origin: record.origin,
    hostname: record.hostname,
    iconUrl: record.iconUrl,
    iconMode: record.iconMode,
    consentSummary: record.consentSummary,
    enabled: record.enabled,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  return error.code === "P2002";
}

async function createAuditLog(input: {
  actorId: string;
  action: string;
  targetId: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorType: ActorType.ADMIN,
      actorId: input.actorId,
      action: input.action,
      targetType: "AuthServiceApp",
      targetId: input.targetId,
      metadata: input.metadata
    }
  });
}

async function ensureUniqueServiceKey(baseKey: string, excludeId?: string): Promise<string> {
  const normalizedBase = normalizeServiceKey(baseKey);
  let candidate = `svc-${normalizedBase}`;

  for (let index = 2; index < 200; index += 1) {
    const existing = await prisma.authServiceApp.findFirst({
      where: {
        serviceKey: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      select: {
        id: true
      }
    });

    if (!existing) {
      return candidate;
    }

    candidate = `svc-${normalizedBase}-${index}`;
  }

  throw new AuthError("invalid_input", "服务标识冲突次数过多，请手动指定 serviceKey。", 409);
}

async function buildSuggestionFromUrl(url: URL): Promise<SuggestionBase> {
  const origin = normalizeOrigin(url);
  const hostname = normalizeHostname(url);
  const displayName = buildDisplayNameFromHostname(hostname);
  const keySeed = buildDefaultServiceKeySeed(hostname);
  const serviceKey = await ensureUniqueServiceKey(keySeed);

  return {
    origin,
    hostname,
    serviceKey,
    displayName,
    iconUrl: buildFaviconUrl(origin),
    consentSummary: DEFAULT_CONSENT_SUMMARY
  };
}

async function findServiceByOrigin(origin: string): Promise<AdminServiceRecord | null> {
  return prisma.authServiceApp.findUnique({
    where: {
      origin
    },
    select: {
      id: true,
      serviceKey: true,
      displayName: true,
      origin: true,
      hostname: true,
      iconUrl: true,
      iconMode: true,
      consentSummary: true,
      enabled: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export function deriveServiceSuggestionFromReturnTo(returnTo: string): Promise<SuggestionBase> {
  const url = parseAbsoluteHttpUrl({
    raw: returnTo,
    fieldName: "return_to",
    errorCode: "invalid_input"
  });

  return buildSuggestionFromUrl(url);
}

export async function resolveAuthorizeServiceByReturnTo(returnTo: string): Promise<ResolveAuthorizeServiceResult> {
  const url = parseAbsoluteHttpUrl({
    raw: returnTo,
    fieldName: "return_to",
    errorCode: "invalid_return_to"
  });
  const origin = normalizeOrigin(url);

  const service = await prisma.authServiceApp.findFirst({
    where: {
      origin,
      enabled: true
    },
    select: {
      serviceKey: true,
      displayName: true,
      consentSummary: true,
      iconUrl: true
    }
  });

  if (!service) {
    throw new AuthError("invalid_service", "当前回跳域名未开通授权服务，请联系管理员。", 400, {
      origin
    });
  }

  return {
    serviceId: service.serviceKey,
    serviceName: service.displayName,
    consentSummary: service.consentSummary,
    serviceIconUrl: service.iconUrl
  };
}

export async function listAuthServicesForAdmin(query?: string): Promise<AdminServiceDTO[]> {
  const keyword = query?.trim();
  const services = await prisma.authServiceApp.findMany({
    where: keyword
      ? {
          OR: [
            {
              displayName: {
                contains: keyword,
                mode: "insensitive"
              }
            },
            {
              serviceKey: {
                contains: keyword,
                mode: "insensitive"
              }
            },
            {
              origin: {
                contains: keyword,
                mode: "insensitive"
              }
            },
            {
              hostname: {
                contains: keyword,
                mode: "insensitive"
              }
            }
          ]
        }
      : undefined,
    orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      serviceKey: true,
      displayName: true,
      origin: true,
      hostname: true,
      iconUrl: true,
      iconMode: true,
      consentSummary: true,
      enabled: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return services.map(toAdminServiceDTO);
}

export async function suggestAuthServiceFromReturnTo(returnTo: string): Promise<AdminServiceSuggestionDTO> {
  const url = parseAbsoluteHttpUrl({
    raw: returnTo,
    fieldName: "return_to",
    errorCode: "invalid_input"
  });
  const origin = normalizeOrigin(url);

  const existing = await findServiceByOrigin(origin);
  if (existing) {
    return {
      origin: existing.origin,
      hostname: existing.hostname,
      serviceKey: existing.serviceKey,
      displayName: existing.displayName,
      iconUrl: existing.iconUrl,
      consentSummary: existing.consentSummary,
      existingService: toAdminServiceDTO(existing)
    };
  }

  const suggestion = await buildSuggestionFromUrl(url);
  return {
    ...suggestion,
    existingService: null
  };
}

export async function suggestAuthServicesFromAllowlist(): Promise<AdminServiceSuggestionDTO[]> {
  const allowlist = Array.from(getAuthorizeReturnPolicy().allowedReturnOrigins);
  const suggestions = await Promise.all(
    allowlist.map(async (origin) => {
      const existing = await findServiceByOrigin(origin);
      if (existing) {
        return {
          origin: existing.origin,
          hostname: existing.hostname,
          serviceKey: existing.serviceKey,
          displayName: existing.displayName,
          iconUrl: existing.iconUrl,
          consentSummary: existing.consentSummary,
          existingService: toAdminServiceDTO(existing)
        } satisfies AdminServiceSuggestionDTO;
      }

      const suggestion = await buildSuggestionFromUrl(
        parseAbsoluteHttpUrl({
          raw: origin,
          fieldName: "origin",
          errorCode: "invalid_input"
        })
      );
      return {
        ...suggestion,
        existingService: null
      } satisfies AdminServiceSuggestionDTO;
    })
  );

  return suggestions.sort((a, b) => a.origin.localeCompare(b.origin));
}

export async function createAuthServiceForAdmin(input: CreateAuthServiceInput): Promise<AdminServiceDTO> {
  const url = parseAbsoluteHttpUrl({
    raw: input.origin,
    fieldName: "origin",
    errorCode: "invalid_input"
  });
  const origin = normalizeOrigin(url);
  const hostname = normalizeHostname(url);

  const serviceKey =
    input.serviceKey && input.serviceKey.trim()
      ? await ensureUniqueServiceKey(input.serviceKey)
      : await ensureUniqueServiceKey(buildDefaultServiceKeySeed(hostname));
  const displayName = input.displayName?.trim() || buildDisplayNameFromHostname(hostname);
  const consentSummary = input.consentSummary?.trim() || DEFAULT_CONSENT_SUMMARY;
  const iconUrlValue = input.iconUrl?.trim();
  const iconUrl = iconUrlValue
    ? parseAbsoluteHttpUrl({
        raw: iconUrlValue,
        fieldName: "iconUrl",
        errorCode: "invalid_input"
      }).toString()
    : buildFaviconUrl(origin);

  try {
    const created = await prisma.authServiceApp.create({
      data: {
        serviceKey,
        displayName,
        origin,
        hostname,
        iconUrl,
        iconMode: iconUrlValue ? "CUSTOM" : "FAVICON",
        consentSummary,
        enabled: input.enabled ?? true
      },
      select: {
        id: true,
        serviceKey: true,
        displayName: true,
        origin: true,
        hostname: true,
        iconUrl: true,
        iconMode: true,
        consentSummary: true,
        enabled: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await createAuditLog({
      actorId: input.actorId,
      action: "ADMIN_SERVICE_CREATED",
      targetId: created.id,
      metadata: {
        serviceKey: created.serviceKey,
        origin: created.origin
      }
    });

    return toAdminServiceDTO(created);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthError("invalid_input", "服务域名或服务标识已存在。", 409);
    }
    throw error;
  }
}

export async function updateAuthServiceForAdmin(input: UpdateAuthServiceInput): Promise<AdminServiceDTO> {
  const existing = await prisma.authServiceApp.findUnique({
    where: {
      id: input.id
    },
    select: {
      id: true,
      origin: true,
      hostname: true,
      iconMode: true
    }
  });

  if (!existing) {
    throw new AuthError("service_not_found", "服务不存在。", 404);
  }

  const nextOrigin = input.origin?.trim()
    ? normalizeOrigin(
        parseAbsoluteHttpUrl({
          raw: input.origin,
          fieldName: "origin",
          errorCode: "invalid_input"
        })
      )
    : existing.origin;
  const nextHostname = input.origin?.trim()
    ? normalizeHostname(
        parseAbsoluteHttpUrl({
          raw: input.origin,
          fieldName: "origin",
          errorCode: "invalid_input"
        })
      )
    : existing.hostname;

  const displayName = input.displayName?.trim();
  const consentSummary = input.consentSummary?.trim();
  const iconUrlRaw = input.iconUrl?.trim();
  const iconUrl = iconUrlRaw
    ? parseAbsoluteHttpUrl({
        raw: iconUrlRaw,
        fieldName: "iconUrl",
        errorCode: "invalid_input"
      }).toString()
    : undefined;
  const resetToFavicon = input.iconUrl !== undefined && !iconUrlRaw;
  const keepFaviconWithOriginChange =
    input.origin !== undefined && input.iconUrl === undefined && existing.iconMode === "FAVICON";

  try {
    const updated = await prisma.authServiceApp.update({
      where: {
        id: input.id
      },
      data: {
        ...(input.origin !== undefined
          ? {
              origin: nextOrigin,
              hostname: nextHostname
            }
          : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(consentSummary !== undefined ? { consentSummary } : {}),
        ...(iconUrl !== undefined
          ? {
              iconUrl,
              iconMode: "CUSTOM"
            }
          : {}),
        ...(resetToFavicon
          ? {
              iconUrl: buildFaviconUrl(nextOrigin),
              iconMode: "FAVICON"
            }
          : {}),
        ...(keepFaviconWithOriginChange
          ? {
              iconUrl: buildFaviconUrl(nextOrigin),
              iconMode: "FAVICON"
            }
          : {})
      },
      select: {
        id: true,
        serviceKey: true,
        displayName: true,
        origin: true,
        hostname: true,
        iconUrl: true,
        iconMode: true,
        consentSummary: true,
        enabled: true,
        createdAt: true,
        updatedAt: true
      }
    });

    await createAuditLog({
      actorId: input.actorId,
      action: "ADMIN_SERVICE_UPDATED",
      targetId: updated.id,
      metadata: {
        origin: updated.origin
      }
    });

    return toAdminServiceDTO(updated);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AuthError("invalid_input", "服务域名冲突，请检查 origin。", 409);
    }
    throw error;
  }
}

export async function toggleAuthServiceForAdmin(input: ToggleAuthServiceInput): Promise<AdminServiceDTO> {
  const existing = await prisma.authServiceApp.findUnique({
    where: {
      id: input.id
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new AuthError("service_not_found", "服务不存在。", 404);
  }

  const updated = await prisma.authServiceApp.update({
    where: {
      id: input.id
    },
    data: {
      enabled: input.enabled
    },
    select: {
      id: true,
      serviceKey: true,
      displayName: true,
      origin: true,
      hostname: true,
      iconUrl: true,
      iconMode: true,
      consentSummary: true,
      enabled: true,
      createdAt: true,
      updatedAt: true
    }
  });

  await createAuditLog({
    actorId: input.actorId,
    action: "ADMIN_SERVICE_TOGGLED",
    targetId: updated.id,
    metadata: {
      enabled: updated.enabled
    }
  });

  return toAdminServiceDTO(updated);
}
