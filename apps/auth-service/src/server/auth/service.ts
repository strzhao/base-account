import crypto from "node:crypto";

import { ActorType, EmailCodePurpose, Prisma, UserStatus, type User } from "@prisma/client";

import { getEnv } from "@/lib/env";
import { signAccessToken, verifyAccessToken } from "@/lib/jwt";
import { sendLoginCodeEmail } from "@/lib/mailer";
import { prisma } from "@/lib/prisma";
import {
  compareHash,
  generateNumericCode,
  generateOpaqueToken,
  getClientIp,
  hashValue,
  normalizeEmail
} from "@/lib/security";
import type { AuthSuccessResponse, UserDTO } from "@/types/auth";

import { AuthError } from "@/server/auth/errors";

type ClientMeta = {
  ip?: string;
  userAgent?: string;
};

type SendCodeInput = {
  email: string;
};

type VerifyCodeInput = {
  email: string;
  code: string;
  client: ClientMeta;
};

type RefreshInput = {
  refreshToken: string;
  client: ClientMeta;
};

const INVALID_CODE_ERROR = () =>
  new AuthError("invalid_code", "Invalid or expired verification code.", 400);

function toUserDTO(user: Pick<User, "id" | "email" | "status" | "createdAt" | "updatedAt" | "lastLoginAt">): UserDTO {
  return {
    id: user.id,
    email: user.email,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null
  };
}

async function createAuditLog(input: {
  actorType: ActorType;
  actorId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata
    }
  });
}

export function extractClientMeta(request: Request): ClientMeta {
  return {
    ip: getClientIp(request.headers),
    userAgent: request.headers.get("user-agent") ?? undefined
  };
}

export function extractBearerToken(request: Request): string | undefined {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return undefined;
  }

  const [prefix, token] = authHeader.split(" ");
  if (prefix !== "Bearer" || !token) {
    return undefined;
  }

  return token;
}

export function isAdminEmail(email: string): boolean {
  return getEnv().adminEmailSet.has(normalizeEmail(email));
}

export async function sendLoginCode(input: SendCodeInput): Promise<{ requestId: string; debugCode?: string }> {
  const env = getEnv();
  const email = normalizeEmail(input.email);
  const now = new Date();

  const recentCode = await prisma.emailCode.findFirst({
    where: {
      email,
      purpose: EmailCodePurpose.LOGIN,
      createdAt: {
        gte: new Date(now.getTime() - env.EMAIL_CODE_COOLDOWN_SEC * 1000)
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (recentCode) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((recentCode.createdAt.getTime() + env.EMAIL_CODE_COOLDOWN_SEC * 1000 - now.getTime()) / 1000)
    );

    throw new AuthError("rate_limited", "Please wait before requesting another code.", 429, {
      retryAfterSeconds
    });
  }

  const requestId = crypto.randomUUID();
  const code = generateNumericCode(6);
  const codeHash = hashValue(code, env.AUTH_HASH_PEPPER);

  await prisma.emailCode.create({
    data: {
      requestId,
      email,
      codeHash,
      purpose: EmailCodePurpose.LOGIN,
      expiresAt: new Date(now.getTime() + env.EMAIL_CODE_TTL_SEC * 1000)
    }
  });

  try {
    await sendLoginCodeEmail(email, code);
  } catch (error) {
    await prisma.emailCode.updateMany({
      where: {
        requestId,
        consumedAt: null
      },
      data: {
        consumedAt: new Date()
      }
    });

    throw new AuthError("email_delivery_failed", "Unable to deliver verification email.", 502, {
      reason: error instanceof Error ? error.message : "unknown"
    });
  }

  await createAuditLog({
    actorType: ActorType.SYSTEM,
    action: "AUTH_CODE_SENT",
    targetType: "EmailCode",
    targetId: requestId,
    metadata: {
      email
    }
  });

  const debugCode = env.NODE_ENV !== "production" && !env.RESEND_API_KEY ? code : undefined;

  return {
    requestId,
    ...(debugCode ? { debugCode } : {})
  };
}

export async function verifyLoginCode(input: VerifyCodeInput): Promise<AuthSuccessResponse> {
  const env = getEnv();
  const email = normalizeEmail(input.email);
  const now = new Date();

  const emailCode = await prisma.emailCode.findFirst({
    where: {
      email,
      purpose: EmailCodePurpose.LOGIN,
      consumedAt: null
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!emailCode) {
    throw INVALID_CODE_ERROR();
  }

  if (emailCode.expiresAt.getTime() <= now.getTime()) {
    await prisma.emailCode.updateMany({
      where: {
        id: emailCode.id,
        consumedAt: null
      },
      data: {
        consumedAt: now
      }
    });

    throw INVALID_CODE_ERROR();
  }

  if (emailCode.attemptCount >= env.EMAIL_CODE_MAX_ATTEMPTS) {
    await prisma.emailCode.updateMany({
      where: {
        id: emailCode.id,
        consumedAt: null
      },
      data: {
        consumedAt: now
      }
    });

    throw new AuthError("too_many_attempts", "Verification code attempt limit reached.", 429);
  }

  const matches = compareHash(input.code.trim(), emailCode.codeHash, env.AUTH_HASH_PEPPER);
  if (!matches) {
    const updatedAttemptCount = emailCode.attemptCount + 1;
    await prisma.emailCode.update({
      where: {
        id: emailCode.id
      },
      data: {
        attemptCount: updatedAttemptCount,
        ...(updatedAttemptCount >= env.EMAIL_CODE_MAX_ATTEMPTS ? { consumedAt: now } : {})
      }
    });

    await createAuditLog({
      actorType: ActorType.SYSTEM,
      action: "AUTH_CODE_VERIFY_FAILED",
      targetType: "EmailCode",
      targetId: emailCode.requestId,
      metadata: {
        email,
        attemptCount: updatedAttemptCount
      }
    });

    if (updatedAttemptCount >= env.EMAIL_CODE_MAX_ATTEMPTS) {
      throw new AuthError("too_many_attempts", "Verification code attempt limit reached.", 429);
    }

    throw INVALID_CODE_ERROR();
  }

  const refreshToken = generateOpaqueToken(48);
  const refreshTokenHash = hashValue(refreshToken, env.AUTH_HASH_PEPPER);
  const refreshExpiresAt = new Date(now.getTime() + env.REFRESH_TOKEN_EXPIRES_IN_SEC * 1000);

  const user = await prisma.$transaction(async (tx) => {
    const consumeResult = await tx.emailCode.updateMany({
      where: {
        id: emailCode.id,
        consumedAt: null
      },
      data: {
        consumedAt: now
      }
    });

    if (consumeResult.count !== 1) {
      throw INVALID_CODE_ERROR();
    }

    const existingUser = await tx.user.findUnique({
      where: {
        email
      }
    });

    if (existingUser?.status === UserStatus.DISABLED) {
      throw new AuthError("account_disabled", "Your account has been disabled.", 403);
    }

    const userRecord =
      existingUser ??
      (await tx.user.create({
        data: {
          email,
          status: UserStatus.ACTIVE
        }
      }));

    const updatedUser = await tx.user.update({
      where: {
        id: userRecord.id
      },
      data: {
        lastLoginAt: now
      }
    });

    await tx.session.create({
      data: {
        userId: updatedUser.id,
        refreshTokenHash,
        expiresAt: refreshExpiresAt,
        ip: input.client.ip,
        userAgent: input.client.userAgent
      }
    });

    await tx.auditLog.create({
      data: {
        actorType: ActorType.USER,
        actorId: updatedUser.id,
        action: "AUTH_LOGIN_SUCCESS",
        targetType: "User",
        targetId: updatedUser.id,
        metadata: {
          email,
          ip: input.client.ip ?? null
        }
      }
    });

    return updatedUser;
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

export async function refreshSession(input: RefreshInput): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const env = getEnv();
  const now = new Date();
  const incomingRefreshHash = hashValue(input.refreshToken, env.AUTH_HASH_PEPPER);

  const existingSession = await prisma.session.findUnique({
    where: {
      refreshTokenHash: incomingRefreshHash
    },
    include: {
      user: true
    }
  });

  if (!existingSession || existingSession.revokedAt || existingSession.expiresAt.getTime() <= now.getTime()) {
    throw new AuthError("invalid_refresh_token", "Refresh token is invalid or expired.", 401);
  }

  if (existingSession.user.status === UserStatus.DISABLED) {
    await prisma.session.update({
      where: {
        id: existingSession.id
      },
      data: {
        revokedAt: now
      }
    });

    throw new AuthError("account_disabled", "Your account has been disabled.", 403);
  }

  const nextRefreshToken = generateOpaqueToken(48);
  const nextRefreshTokenHash = hashValue(nextRefreshToken, env.AUTH_HASH_PEPPER);
  const nextRefreshExpiry = new Date(now.getTime() + env.REFRESH_TOKEN_EXPIRES_IN_SEC * 1000);

  await prisma.session.update({
    where: {
      id: existingSession.id
    },
    data: {
      refreshTokenHash: nextRefreshTokenHash,
      expiresAt: nextRefreshExpiry,
      ip: input.client.ip,
      userAgent: input.client.userAgent
    }
  });

  await createAuditLog({
    actorType: ActorType.USER,
    actorId: existingSession.user.id,
    action: "AUTH_TOKEN_REFRESH",
    targetType: "Session",
    targetId: existingSession.id,
    metadata: {
      ip: input.client.ip ?? null
    }
  });

  const accessToken = await signAccessToken({
    sub: existingSession.user.id,
    email: existingSession.user.email,
    status: existingSession.user.status
  });

  return {
    accessToken,
    refreshToken: nextRefreshToken,
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN_SEC
  };
}

export async function logoutSession(refreshToken: string): Promise<void> {
  const env = getEnv();
  const refreshTokenHash = hashValue(refreshToken, env.AUTH_HASH_PEPPER);

  const session = await prisma.session.findUnique({
    where: {
      refreshTokenHash
    }
  });

  if (!session) {
    return;
  }

  await prisma.session.update({
    where: {
      id: session.id
    },
    data: {
      revokedAt: new Date()
    }
  });

  await createAuditLog({
    actorType: ActorType.USER,
    actorId: session.userId,
    action: "AUTH_LOGOUT",
    targetType: "Session",
    targetId: session.id
  });
}

export async function getCurrentUserFromAccessToken(token: string): Promise<UserDTO> {
  const verified = await verifyAccessToken(token);

  const user = await prisma.user.findUnique({
    where: {
      id: verified.sub
    }
  });

  if (!user) {
    throw new AuthError("user_not_found", "User not found.", 404);
  }

  if (user.status === UserStatus.DISABLED) {
    throw new AuthError("account_disabled", "Your account has been disabled.", 403);
  }

  return toUserDTO(user);
}

export async function requireAdminFromAccessToken(token: string): Promise<UserDTO> {
  const currentUser = await getCurrentUserFromAccessToken(token);

  if (!isAdminEmail(currentUser.email)) {
    throw new AuthError("forbidden", "Admin access required.", 403);
  }

  return currentUser;
}

export async function listUsersForAdmin(query?: string): Promise<UserDTO[]> {
  const users = await prisma.user.findMany({
    where:
      query && query.trim()
        ? {
            email: {
              contains: query.trim(),
              mode: "insensitive"
            }
          }
        : undefined,
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });

  return users.map((user) => toUserDTO(user));
}

export async function listEmailCodeLogsForAdmin(limit = 50): Promise<
  Array<{
    requestId: string;
    email: string;
    purpose: string;
    attemptCount: number;
    createdAt: string;
    expiresAt: string;
    consumedAt: string | null;
  }>
> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  const rows = await prisma.emailCode.findMany({
    orderBy: {
      createdAt: "desc"
    },
    take: safeLimit,
    select: {
      requestId: true,
      email: true,
      purpose: true,
      attemptCount: true,
      createdAt: true,
      expiresAt: true,
      consumedAt: true
    }
  });

  return rows.map((row) => ({
    requestId: row.requestId,
    email: row.email,
    purpose: row.purpose,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    consumedAt: row.consumedAt?.toISOString() ?? null
  }));
}

export async function getUserDetailForAdmin(userId: string): Promise<{
  user: UserDTO;
  sessions: Array<{
    id: string;
    expiresAt: string;
    revokedAt: string | null;
    ip: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    actorType: ActorType;
    actorId: string | null;
    targetType: string;
    createdAt: string;
  }>;
}> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId
    }
  });

  if (!user) {
    throw new AuthError("user_not_found", "User not found.", 404);
  }

  const [sessions, auditLogs] = await Promise.all([
    prisma.session.findMany({
      where: {
        userId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 50,
      select: {
        id: true,
        expiresAt: true,
        revokedAt: true,
        ip: true,
        userAgent: true,
        createdAt: true
      }
    }),
    prisma.auditLog.findMany({
      where: {
        OR: [{ actorId: userId }, { targetId: userId }]
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 100,
      select: {
        id: true,
        action: true,
        actorType: true,
        actorId: true,
        targetType: true,
        createdAt: true
      }
    })
  ]);

  return {
    user: toUserDTO(user),
    sessions: sessions.map((session) => ({
      id: session.id,
      expiresAt: session.expiresAt.toISOString(),
      revokedAt: session.revokedAt?.toISOString() ?? null,
      ip: session.ip,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString()
    })),
    auditLogs: auditLogs.map((log) => ({
      id: log.id,
      action: log.action,
      actorType: log.actorType,
      actorId: log.actorId,
      targetType: log.targetType,
      createdAt: log.createdAt.toISOString()
    }))
  };
}

export async function setUserStatusForAdmin(input: {
  actorId: string;
  userId: string;
  status: UserStatus;
}): Promise<UserDTO> {
  const now = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: {
        id: input.userId
      },
      data: {
        status: input.status
      }
    });

    if (input.status === UserStatus.DISABLED) {
      await tx.session.updateMany({
        where: {
          userId: input.userId,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });
    }

    await tx.auditLog.create({
      data: {
        actorType: ActorType.ADMIN,
        actorId: input.actorId,
        action: "ADMIN_USER_STATUS_UPDATED",
        targetType: "User",
        targetId: input.userId,
        metadata: {
          status: input.status
        }
      }
    });

    return updatedUser;
  });

  return toUserDTO(user);
}
