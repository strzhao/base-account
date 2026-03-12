import { ActorType, InvitationCodeStatus, Prisma } from "@prisma/client";

import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { generateInvitationCode, normalizeEmail } from "@/lib/security";

import { AuthError } from "@/server/auth/errors";

type InvitationCodeDTO = {
  id: string;
  code: string;
  serviceKey: string;
  status: InvitationCodeStatus;
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt: string;
};

function toDTO(row: {
  id: string;
  code: string;
  serviceKey: string;
  status: InvitationCodeStatus;
  redeemedBy: string | null;
  redeemedAt: Date | null;
  createdAt: Date;
}): InvitationCodeDTO {
  return {
    id: row.id,
    code: row.code,
    serviceKey: row.serviceKey,
    status: row.status,
    redeemedBy: row.redeemedBy,
    redeemedAt: row.redeemedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString()
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
  await prisma.auditLog.create({ data: input });
}

export async function createInvitationCode(input: {
  userId: string;
  serviceKey: string;
}): Promise<InvitationCodeDTO> {
  const { userId, serviceKey } = input;
  const env = getEnv();

  const service = await prisma.authServiceApp.findUnique({
    where: { serviceKey }
  });
  if (!service || !service.enabled) {
    throw new AuthError("invalid_service", "Service not found or disabled.", 400);
  }

  const usedCount = await prisma.invitationCode.count({
    where: { creatorId: userId, serviceKey }
  });
  if (usedCount >= env.INVITATION_CODE_QUOTA_PER_APP) {
    throw new AuthError(
      "invitation_quota_exceeded",
      `You have reached the maximum of ${env.INVITATION_CODE_QUOTA_PER_APP} invitation codes for this service.`,
      403
    );
  }

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateInvitationCode();
    try {
      const record = await prisma.invitationCode.create({
        data: { code, serviceKey, creatorId: userId }
      });

      await createAuditLog({
        actorType: ActorType.USER,
        actorId: userId,
        action: "INVITATION_CODE_CREATED",
        targetType: "InvitationCode",
        targetId: record.id,
        metadata: { serviceKey, code }
      });

      return toDTO(record);
    } catch (err: unknown) {
      const isUniqueViolation =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isUniqueViolation && attempt < MAX_RETRIES - 1) {
        continue;
      }
      throw err;
    }
  }

  throw new AuthError("internal_error", "Failed to generate a unique invitation code.", 500);
}

export async function redeemInvitationCode(input: {
  code: string;
  userId: string;
  userEmail?: string;
}): Promise<{ serviceKey: string; creatorId: string }> {
  const normalized = input.code.trim().toUpperCase();

  const record = await prisma.invitationCode.findUnique({
    where: { code: normalized }
  });

  if (!record) {
    throw new AuthError("invalid_invitation_code", "Invitation code not found.", 400);
  }

  if (record.status === InvitationCodeStatus.REDEEMED) {
    throw new AuthError("invitation_code_already_redeemed", "This invitation code has already been used.", 409);
  }

  if (record.status === InvitationCodeStatus.REVOKED) {
    throw new AuthError("invalid_invitation_code", "This invitation code is no longer valid.", 400);
  }

  const isAdminRedeemingOwnCode =
    record.creatorId === input.userId &&
    Boolean(
      input.userEmail &&
        getEnv().adminEmailSet.has(normalizeEmail(input.userEmail))
    );

  if (record.creatorId === input.userId && !isAdminRedeemingOwnCode) {
    throw new AuthError("self_redeem_not_allowed", "You cannot redeem your own invitation code.", 400);
  }

  await prisma.invitationCode.update({
    where: { id: record.id },
    data: {
      status: InvitationCodeStatus.REDEEMED,
      redeemedBy: input.userId,
      redeemedAt: new Date()
    }
  });

  await createAuditLog({
    actorType: ActorType.USER,
    actorId: input.userId,
    action: "INVITATION_CODE_REDEEMED",
    targetType: "InvitationCode",
    targetId: record.id,
    metadata: {
      serviceKey: record.serviceKey,
      creatorId: record.creatorId,
      selfRedeemedByAdmin: isAdminRedeemingOwnCode
    }
  });

  return { serviceKey: record.serviceKey, creatorId: record.creatorId };
}

export async function validateInvitationCode(code: string): Promise<{
  valid: boolean;
  serviceKey: string | null;
  creatorId: string | null;
}> {
  const normalized = code.trim().toUpperCase();

  const record = await prisma.invitationCode.findUnique({
    where: { code: normalized }
  });

  if (!record || record.status !== InvitationCodeStatus.ACTIVE) {
    return { valid: false, serviceKey: null, creatorId: null };
  }

  return { valid: true, serviceKey: record.serviceKey, creatorId: record.creatorId };
}

export async function listMyInvitationCodes(input: {
  userId: string;
  serviceKey: string;
}): Promise<{ codes: InvitationCodeDTO[]; quota: { used: number; total: number } }> {
  const env = getEnv();
  const { userId, serviceKey } = input;

  const records = await prisma.invitationCode.findMany({
    where: { creatorId: userId, serviceKey },
    orderBy: { createdAt: "desc" }
  });

  return {
    codes: records.map(toDTO),
    quota: { used: records.length, total: env.INVITATION_CODE_QUOTA_PER_APP }
  };
}

export async function revokeInvitationCode(input: {
  codeId: string;
  userId: string;
}): Promise<void> {
  const record = await prisma.invitationCode.findUnique({
    where: { id: input.codeId }
  });

  if (!record) {
    throw new AuthError("invitation_code_not_found", "Invitation code not found.", 404);
  }

  if (record.creatorId !== input.userId) {
    throw new AuthError("forbidden", "You can only revoke your own invitation codes.", 403);
  }

  if (record.status !== InvitationCodeStatus.ACTIVE) {
    throw new AuthError("invalid_invitation_code", "Only active invitation codes can be revoked.", 400);
  }

  await prisma.invitationCode.update({
    where: { id: record.id },
    data: { status: InvitationCodeStatus.REVOKED }
  });

  await createAuditLog({
    actorType: ActorType.USER,
    actorId: input.userId,
    action: "INVITATION_CODE_REVOKED",
    targetType: "InvitationCode",
    targetId: record.id,
    metadata: { serviceKey: record.serviceKey }
  });
}
