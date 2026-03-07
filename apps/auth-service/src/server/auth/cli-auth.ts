import { UserStatus } from "@prisma/client";

import { getEnv } from "@/lib/env";
import { signAccessToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { generateOpaqueToken, hashValue } from "@/lib/security";
import type { AuthSuccessResponse, UserDTO } from "@/types/auth";

import { AuthError } from "@/server/auth/errors";

const CLI_AUTH_CODE_TTL_SEC = 5 * 60; // 5 minutes

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

export async function createCliAuthCode(userId: string): Promise<string> {
  const env = getEnv();
  const rawCode = generateOpaqueToken(48);
  const codeHash = hashValue(rawCode, env.AUTH_HASH_PEPPER);
  const now = new Date();

  await prisma.cliAuthCode.create({
    data: {
      codeHash,
      userId,
      expiresAt: new Date(now.getTime() + CLI_AUTH_CODE_TTL_SEC * 1000)
    }
  });

  return rawCode;
}

export async function exchangeCliAuthCode(code: string): Promise<AuthSuccessResponse> {
  const env = getEnv();
  const codeHash = hashValue(code, env.AUTH_HASH_PEPPER);
  const now = new Date();

  const record = await prisma.cliAuthCode.findUnique({
    where: { codeHash }
  });

  if (!record) {
    throw new AuthError("invalid_code", "Invalid or expired CLI authorization code.", 400);
  }

  if (record.consumedAt) {
    throw new AuthError("code_already_used", "This authorization code has already been used.", 400);
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    throw new AuthError("code_expired", "This authorization code has expired.", 400);
  }

  // Mark as consumed
  const consumed = await prisma.cliAuthCode.updateMany({
    where: { id: record.id, consumedAt: null },
    data: { consumedAt: now }
  });

  if (consumed.count !== 1) {
    throw new AuthError("code_already_used", "This authorization code has already been used.", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) {
    throw new AuthError("user_not_found", "User not found.", 404);
  }

  if (user.status === UserStatus.DISABLED) {
    throw new AuthError("account_disabled", "Your account has been disabled.", 403);
  }

  // Create session
  const refreshToken = generateOpaqueToken(48);
  const refreshTokenHash = hashValue(refreshToken, env.AUTH_HASH_PEPPER);
  const refreshExpiresAt = new Date(now.getTime() + env.REFRESH_TOKEN_EXPIRES_IN_SEC * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt: refreshExpiresAt,
      userAgent: "base-account-cli"
    }
  });

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    status: user.status
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN_SEC,
    user: toUserDTO(user)
  };
}
