-- CreateTable
CREATE TABLE "ServiceConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceConsent_userId_serviceId_key" ON "ServiceConsent"("userId", "serviceId");

-- CreateIndex
CREATE INDEX "ServiceConsent_serviceId_idx" ON "ServiceConsent"("serviceId");

-- AddForeignKey
ALTER TABLE "ServiceConsent" ADD CONSTRAINT "ServiceConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
