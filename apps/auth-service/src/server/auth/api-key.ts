import { ActorType, UserStatus } from "@prisma/client";

import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken, hashValue } from "@/lib/security";
import type { UserDTO } from "@/types/auth";

import { AuthError } from "@/server/auth/errors";

const API_KEY_PREFIX = "ba_k_";

function toUserDTO(user: { id: string; email: string; status: UserStatus; createdAt: Date; updatedAt: Date; lastLoginAt: Date | null }): UserDTO {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null
  };
}

export async function createApiKey(userId: string, name: string): Promise<{ id: string; name: string; key: string; keyPrefix: string; createdAt: string }> {
  const env = getEnv();
  const rawToken = generateOpaqueToken(32);
  const fullKey = `${API_KEY_PREFIX}${rawToken}`;
  const keyHash = hashValue(fullKey, env.AUTH_HASH_PEPPER);
  const keyPrefix = fullKey.slice(0, 12);

  const apiKey = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      keyPrefix,
      userId
    }
  });

  await prisma.auditLog.create({
    data: {
      actorType: ActorType.ADMIN,
      actorId: userId,
      action: "API_KEY_CREATED",
      targetType: "ApiKey",
      targetId: apiKey.id,
      metadata: { name, keyPrefix }
    }
  });

  return {
    id: apiKey.id,
    name: apiKey.name,
    key: fullKey,
    keyPrefix,
    createdAt: apiKey.createdAt.toISOString()
  };
}

export async function verifyApiKeyAndGetUser(rawKey: string): Promise<UserDTO> {
  const env = getEnv();
  const keyHash = hashValue(rawKey, env.AUTH_HASH_PEPPER);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: true }
  });

  if (!apiKey) {
    throw new AuthError("invalid_api_key", "Invalid API key.", 401);
  }

  if (apiKey.revokedAt) {
    throw new AuthError("api_key_revoked", "This API key has been revoked.", 401);
  }

  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    throw new AuthError("api_key_expired", "This API key has expired.", 401);
  }

  if (apiKey.user.status === UserStatus.DISABLED) {
    throw new AuthError("account_disabled", "Your account has been disabled.", 403);
  }

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() }
  });

  return toUserDTO(apiKey.user);
}

export async function listApiKeys(userId: string): Promise<Array<{
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}>> {
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });

  return keys.map((k) => ({
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    expiresAt: k.expiresAt?.toISOString() ?? null,
    revokedAt: k.revokedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString()
  }));
}

export async function revokeApiKey(id: string, actorId: string): Promise<void> {
  const apiKey = await prisma.apiKey.findUnique({ where: { id } });

  if (!apiKey) {
    throw new AuthError("api_key_not_found", "API key not found.", 404);
  }

  if (apiKey.revokedAt) {
    return;
  }

  await prisma.apiKey.update({
    where: { id },
    data: { revokedAt: new Date() }
  });

  await prisma.auditLog.create({
    data: {
      actorType: ActorType.ADMIN,
      actorId,
      action: "API_KEY_REVOKED",
      targetType: "ApiKey",
      targetId: id,
      metadata: { name: apiKey.name, keyPrefix: apiKey.keyPrefix }
    }
  });
}
