-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "previousRefreshTokenHash" TEXT,
ADD COLUMN     "rotatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Session_previousRefreshTokenHash_idx" ON "Session"("previousRefreshTokenHash");
