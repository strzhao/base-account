import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/server/auth/errors";

const { prismaMock, getEnvMock } = vi.hoisted(() => ({
  prismaMock: {
    invitationCode: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    }
  },
  getEnvMock: vi.fn()
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock
}));

vi.mock("@/lib/env", () => ({
  getEnv: getEnvMock
}));

vi.mock("@prisma/client", () => ({
  ActorType: {
    USER: "USER"
  },
  InvitationCodeStatus: {
    ACTIVE: "ACTIVE",
    REDEEMED: "REDEEMED",
    REVOKED: "REVOKED"
  },
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(code = "P2002") {
        super("Prisma error");
        this.code = code;
      }
    }
  }
}));

import { redeemInvitationCode } from "@/server/auth/invitation";

describe("redeemInvitationCode", () => {
  beforeEach(() => {
    prismaMock.invitationCode.findUnique.mockReset();
    prismaMock.invitationCode.update.mockReset();
    prismaMock.auditLog.create.mockReset();
    getEnvMock.mockReset();
    getEnvMock.mockReturnValue({
      adminEmailSet: new Set(["admin@example.com"])
    });
  });

  it("rejects self redemption for normal users", async () => {
    prismaMock.invitationCode.findUnique.mockResolvedValue({
      id: "code-1",
      code: "ABCD1234",
      serviceKey: "svc-little-bee",
      status: "ACTIVE",
      creatorId: "user-1"
    });

    await expect(
      redeemInvitationCode({
        code: "ABCD1234",
        userId: "user-1",
        userEmail: "kid@example.com"
      })
    ).rejects.toMatchObject<AuthError>({
      code: "self_redeem_not_allowed",
      statusCode: 400
    });

    expect(prismaMock.invitationCode.update).not.toHaveBeenCalled();
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("allows admins to redeem their own invitation codes", async () => {
    prismaMock.invitationCode.findUnique.mockResolvedValue({
      id: "code-1",
      code: "ABCD1234",
      serviceKey: "svc-little-bee",
      status: "ACTIVE",
      creatorId: "user-1"
    });
    prismaMock.invitationCode.update.mockResolvedValue(undefined);
    prismaMock.auditLog.create.mockResolvedValue(undefined);

    await expect(
      redeemInvitationCode({
        code: "ABCD1234",
        userId: "user-1",
        userEmail: "admin@example.com"
      })
    ).resolves.toEqual({
      serviceKey: "svc-little-bee",
      creatorId: "user-1"
    });

    expect(prismaMock.invitationCode.update).toHaveBeenCalledWith({
      where: { id: "code-1" },
      data: {
        status: "REDEEMED",
        redeemedBy: "user-1",
        redeemedAt: expect.any(Date)
      }
    });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorType: "USER",
        actorId: "user-1",
        action: "INVITATION_CODE_REDEEMED",
        targetType: "InvitationCode",
        targetId: "code-1",
        metadata: {
          serviceKey: "svc-little-bee",
          creatorId: "user-1",
          selfRedeemedByAdmin: true
        }
      })
    });
  });
});
