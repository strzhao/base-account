-- CreateEnum
CREATE TYPE "ServiceIconMode" AS ENUM ('FAVICON', 'CUSTOM', 'GENERATED');

-- CreateTable
CREATE TABLE "AuthServiceApp" (
    "id" TEXT NOT NULL,
    "serviceKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "hostname" TEXT NOT NULL,
    "iconUrl" TEXT,
    "iconMode" "ServiceIconMode" NOT NULL DEFAULT 'FAVICON',
    "consentSummary" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthServiceApp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthServiceApp_serviceKey_key" ON "AuthServiceApp"("serviceKey");

-- CreateIndex
CREATE UNIQUE INDEX "AuthServiceApp_origin_key" ON "AuthServiceApp"("origin");

-- CreateIndex
CREATE INDEX "AuthServiceApp_enabled_updatedAt_idx" ON "AuthServiceApp"("enabled", "updatedAt");

-- CreateIndex
CREATE INDEX "AuthServiceApp_hostname_idx" ON "AuthServiceApp"("hostname");

-- SeedData
INSERT INTO "AuthServiceApp" (
    "id",
    "serviceKey",
    "displayName",
    "origin",
    "hostname",
    "iconUrl",
    "iconMode",
    "consentSummary",
    "enabled",
    "createdAt",
    "updatedAt"
)
VALUES
    (
      'svc_seed_base_account_client',
      'base-account-client',
      '统一账号服务',
      'https://user.stringzhao.life',
      'user.stringzhao.life',
      'https://user.stringzhao.life/favicon.ico',
      'FAVICON',
      '该服务将使用你的统一账号登录状态并读取基础资料。',
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ),
    (
      'svc_seed_admin_console',
      'admin-console',
      '管理控制台',
      'http://localhost:3000',
      'localhost',
      'http://localhost:3000/favicon.ico',
      'FAVICON',
      '该服务将使用你的统一账号登录状态并读取基础资料。',
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    ),
    (
      'svc_seed_integration_docs',
      'integration-docs',
      '接入文档中心',
      'https://stringzhao.life',
      'stringzhao.life',
      'https://stringzhao.life/favicon.ico',
      'FAVICON',
      '该服务将使用你的统一账号登录状态并读取基础资料。',
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
