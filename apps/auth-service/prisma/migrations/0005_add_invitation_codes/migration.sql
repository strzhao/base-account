-- CreateEnum
CREATE TYPE "InvitationCodeStatus" AS ENUM ('ACTIVE', 'REDEEMED', 'REVOKED');

-- CreateTable
CREATE TABLE "InvitationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "status" "InvitationCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitationCode_code_key" ON "InvitationCode"("code");

-- CreateIndex
CREATE INDEX "InvitationCode_serviceKey_creatorId_idx" ON "InvitationCode"("serviceKey", "creatorId");

-- CreateIndex
CREATE INDEX "InvitationCode_serviceKey_status_idx" ON "InvitationCode"("serviceKey", "status");

-- CreateIndex
CREATE INDEX "InvitationCode_redeemedBy_idx" ON "InvitationCode"("redeemedBy");

-- AddForeignKey
ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitationCode" ADD CONSTRAINT "InvitationCode_redeemedBy_fkey" FOREIGN KEY ("redeemedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
