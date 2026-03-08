-- AlterEnum
ALTER TYPE "EmailCodePurpose" ADD VALUE 'LINK_EMAIL';

-- CreateTable
CREATE TABLE "LinkedEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LinkedEmail_email_key" ON "LinkedEmail"("email");

-- CreateIndex
CREATE INDEX "LinkedEmail_userId_idx" ON "LinkedEmail"("userId");

-- AddForeignKey
ALTER TABLE "LinkedEmail" ADD CONSTRAINT "LinkedEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
