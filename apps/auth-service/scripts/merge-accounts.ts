/**
 * 账号合并脚本
 *
 * 将 SOURCE 账号的所有数据迁移到 TARGET 账号，然后将 SOURCE 邮箱绑定为 TARGET 的备用邮箱。
 *
 * 使用方式：
 *   1. 确保 .env.local 中有 DATABASE_URL
 *   2. 设置环境变量：
 *      - AI_TODO_DATABASE_URL: ai-todo 的 Neon PostgreSQL 连接串
 *      - AI_EMAIL_DATABASE_URL: ai-email 的 Neon PostgreSQL 连接串
 *      - SOURCE_EMAIL: 被合并的账号邮箱 (如 daniel21436@hotmail.com)
 *      - TARGET_EMAIL: 保留的账号邮箱 (如 zhaoguixiong@corp.netease.com)
 *   3. 执行：npx tsx scripts/merge-accounts.ts
 *
 * 注意：执行前请先备份三个数据库！
 */

import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url).pathname });

import { PrismaClient, UserStatus, ActorType } from "@prisma/client";
import pg from "pg";

const { Client } = pg;

// ─── Config ───────────────────────────────────────────────────────────────────

const SOURCE_EMAIL = process.env.SOURCE_EMAIL;
const TARGET_EMAIL = process.env.TARGET_EMAIL;
const AI_TODO_DATABASE_URL = process.env.AI_TODO_DATABASE_URL;
const AI_EMAIL_DATABASE_URL = process.env.AI_EMAIL_DATABASE_URL;

if (!SOURCE_EMAIL || !TARGET_EMAIL) {
  console.error("❌ 请设置 SOURCE_EMAIL 和 TARGET_EMAIL 环境变量");
  process.exit(1);
}

if (!AI_TODO_DATABASE_URL || !AI_EMAIL_DATABASE_URL) {
  console.error("❌ 请设置 AI_TODO_DATABASE_URL 和 AI_EMAIL_DATABASE_URL 环境变量");
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(phase: string, msg: string) {
  console.log(`[${phase}] ${msg}`);
}

async function execSql(client: pg.Client, sql: string, params: unknown[] = []): Promise<pg.QueryResult> {
  if (DRY_RUN) {
    log("DRY-RUN", `SQL: ${sql.replace(/\s+/g, " ").trim()}`);
    log("DRY-RUN", `Params: ${JSON.stringify(params)}`);
    return { rows: [], rowCount: 0, command: "", oid: 0, fields: [] };
  }
  const result = await client.query(sql, params);
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  console.log("=".repeat(60));
  console.log(DRY_RUN ? "🔍 DRY RUN 模式（不会执行任何写操作）" : "🚀 正式执行模式");
  console.log(`SOURCE: ${SOURCE_EMAIL}`);
  console.log(`TARGET: ${TARGET_EMAIL}`);
  console.log("=".repeat(60));

  // ── Step 0: 查询两个账号的 user_id ──────────────────────────────────────────

  log("STEP-0", "查询账号信息...");

  const sourceUser = await prisma.user.findUnique({ where: { email: SOURCE_EMAIL } });
  const targetUser = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } });

  if (!sourceUser) {
    console.error(`❌ SOURCE 账号不存在: ${SOURCE_EMAIL}`);
    process.exit(1);
  }
  if (!targetUser) {
    console.error(`❌ TARGET 账号不存在: ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const SOURCE_ID = sourceUser.id;
  const TARGET_ID = targetUser.id;

  log("STEP-0", `SOURCE user_id: ${SOURCE_ID} (${SOURCE_EMAIL})`);
  log("STEP-0", `TARGET user_id: ${TARGET_ID} (${TARGET_EMAIL})`);

  // Disable source user first
  if (!DRY_RUN) {
    await prisma.user.update({
      where: { id: SOURCE_ID },
      data: { status: UserStatus.DISABLED },
    });
    await prisma.session.updateMany({
      where: { userId: SOURCE_ID, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  log("STEP-0", "✅ SOURCE 账号已 DISABLED，会话已撤销");

  // ── Step 1: 迁移 ai-todo ──────────────────────────────────────────────────

  log("STEP-1", "连接 ai-todo 数据库...");
  const todoClient = new Client({ connectionString: AI_TODO_DATABASE_URL });
  await todoClient.connect();

  try {
    // Count existing data
    const todoTaskCount = await todoClient.query(
      "SELECT COUNT(*) as cnt FROM ai_todo_tasks WHERE user_id = $1",
      [SOURCE_ID]
    );
    log("STEP-1", `SOURCE 在 ai-todo 中有 ${todoTaskCount.rows[0].cnt} 个任务`);

    // tasks: 归属
    let result = await execSql(todoClient,
      "UPDATE ai_todo_tasks SET user_id = $1 WHERE user_id = $2",
      [TARGET_ID, SOURCE_ID]
    );
    log("STEP-1", `ai_todo_tasks.user_id: 迁移 ${result.rowCount} 行`);

    // tasks: assignee
    result = await execSql(todoClient,
      "UPDATE ai_todo_tasks SET assignee_id = $1 WHERE assignee_id = $2",
      [TARGET_ID, SOURCE_ID]
    );
    log("STEP-1", `ai_todo_tasks.assignee_id: 迁移 ${result.rowCount} 行`);

    // task_members: 先删冲突行（target 已是成员的 task），再迁移
    result = await execSql(todoClient,
      `DELETE FROM ai_todo_task_members WHERE user_id = $1
       AND task_id IN (SELECT task_id FROM ai_todo_task_members WHERE user_id = $2)`,
      [SOURCE_ID, TARGET_ID]
    );
    log("STEP-1", `ai_todo_task_members: 删除 ${result.rowCount} 个冲突行`);

    result = await execSql(todoClient,
      "UPDATE ai_todo_task_members SET user_id = $1 WHERE user_id = $2",
      [TARGET_ID, SOURCE_ID]
    );
    log("STEP-1", `ai_todo_task_members: 迁移 ${result.rowCount} 行`);

    // task_logs
    result = await execSql(todoClient,
      "UPDATE ai_todo_task_logs SET user_id = $1 WHERE user_id = $2",
      [TARGET_ID, SOURCE_ID]
    );
    log("STEP-1", `ai_todo_task_logs: 迁移 ${result.rowCount} 行`);

    // activated_users: unique(user_id)
    result = await execSql(todoClient,
      `DELETE FROM ai_todo_activated_users WHERE user_id = $1
       AND EXISTS (SELECT 1 FROM ai_todo_activated_users WHERE user_id = $2)`,
      [SOURCE_ID, TARGET_ID]
    );
    log("STEP-1", `ai_todo_activated_users: 删除 ${result.rowCount} 个冲突行`);

    result = await execSql(todoClient,
      "UPDATE ai_todo_activated_users SET user_id = $1 WHERE user_id = $2",
      [TARGET_ID, SOURCE_ID]
    );
    log("STEP-1", `ai_todo_activated_users: 迁移 ${result.rowCount} 行`);

    log("STEP-1", "✅ ai-todo 迁移完成");
  } finally {
    await todoClient.end();
  }

  // ── Step 2: 迁移 ai-email ─────────────────────────────────────────────────

  log("STEP-2", "连接 ai-email 数据库...");
  const emailClient = new Client({ connectionString: AI_EMAIL_DATABASE_URL });
  await emailClient.connect();

  try {
    // Count existing data
    const emailCount = await emailClient.query(
      "SELECT COUNT(*) as cnt FROM emails WHERE user_id = $1",
      [SOURCE_ID]
    );
    log("STEP-2", `SOURCE 在 ai-email 中有 ${emailCount.rows[0].cnt} 封邮件`);

    // 无唯一冲突的表
    for (const table of ["imap_accounts", "emails", "categories", "push_subscriptions", "notification_logs"]) {
      const r = await execSql(emailClient,
        `UPDATE ${table} SET user_id = $1 WHERE user_id = $2`,
        [TARGET_ID, SOURCE_ID]
      );
      log("STEP-2", `${table}: 迁移 ${r.rowCount} 行`);
    }

    // feed_summaries: unique(user_id, group_key)
    let result = await execSql(emailClient,
      `DELETE FROM feed_summaries WHERE user_id = $1
       AND group_key IN (SELECT group_key FROM feed_summaries WHERE user_id = $2)`,
      [SOURCE_ID, TARGET_ID]
    );
    log("STEP-2", `feed_summaries: 删除 ${result.rowCount} 个冲突行`);

    result = await execSql(emailClient,
      "UPDATE feed_summaries SET user_id = $1 WHERE user_id = $2",
      [TARGET_ID, SOURCE_ID]
    );
    log("STEP-2", `feed_summaries: 迁移 ${result.rowCount} 行`);

    // user_email_addresses: unique(address)
    result = await execSql(emailClient,
      `DELETE FROM user_email_addresses WHERE user_id = $1
       AND address IN (SELECT address FROM user_email_addresses WHERE user_id = $2)`,
      [SOURCE_ID, TARGET_ID]
    );
    log("STEP-2", `user_email_addresses: 删除 ${result.rowCount} 个冲突行`);

    result = await execSql(emailClient,
      "UPDATE user_email_addresses SET user_id = $1 WHERE user_id = $2",
      [TARGET_ID, SOURCE_ID]
    );
    log("STEP-2", `user_email_addresses: 迁移 ${result.rowCount} 行`);

    // user_settings: unique(user_id)，保留 target
    result = await execSql(emailClient,
      "DELETE FROM user_settings WHERE user_id = $1",
      [SOURCE_ID]
    );
    log("STEP-2", `user_settings: 删除 SOURCE 的 ${result.rowCount} 行（保留 TARGET 侧）`);

    log("STEP-2", "✅ ai-email 迁移完成");
  } finally {
    await emailClient.end();
  }

  // ── Step 3 & 4: 迁移 base-account + 删除源账号 + 绑定备用邮箱 ──────────

  log("STEP-3", "迁移 base-account 数据...");

  if (DRY_RUN) {
    log("DRY-RUN", "跳过 base-account 数据库操作（Prisma 事务）");
    log("DRY-RUN", "将执行: ServiceConsent、ApiKey、InvitationCode、LinkedEmail、AuditLog、CliAuthCode 迁移");
    log("DRY-RUN", "将执行: 删除 SOURCE User + 绑定备用邮箱");
  } else {
    await prisma.$transaction(async (tx) => {
      // ServiceConsent: unique(userId, serviceId)
      const targetConsents = await tx.serviceConsent.findMany({
        where: { userId: TARGET_ID },
        select: { serviceId: true },
      });
      const targetServiceIds = targetConsents.map((c) => c.serviceId);

      if (targetServiceIds.length > 0) {
        const deleted = await tx.serviceConsent.deleteMany({
          where: {
            userId: SOURCE_ID,
            serviceId: { in: targetServiceIds },
          },
        });
        log("STEP-3", `ServiceConsent: 删除 ${deleted.count} 个冲突行`);
      }

      const consentMigrated = await tx.serviceConsent.updateMany({
        where: { userId: SOURCE_ID },
        data: { userId: TARGET_ID },
      });
      log("STEP-3", `ServiceConsent: 迁移 ${consentMigrated.count} 行`);

      // ApiKey
      const apiKeyMigrated = await tx.apiKey.updateMany({
        where: { userId: SOURCE_ID },
        data: { userId: TARGET_ID },
      });
      log("STEP-3", `ApiKey: 迁移 ${apiKeyMigrated.count} 行`);

      // InvitationCode: creatorId
      const invCreatorMigrated = await tx.invitationCode.updateMany({
        where: { creatorId: SOURCE_ID },
        data: { creatorId: TARGET_ID },
      });
      log("STEP-3", `InvitationCode (creator): 迁移 ${invCreatorMigrated.count} 行`);

      // InvitationCode: redeemedBy
      const invRedeemerMigrated = await tx.invitationCode.updateMany({
        where: { redeemedBy: SOURCE_ID },
        data: { redeemedBy: TARGET_ID },
      });
      log("STEP-3", `InvitationCode (redeemer): 迁移 ${invRedeemerMigrated.count} 行`);

      // LinkedEmail: source 的备用邮箱迁移到 target
      const targetLinked = await tx.linkedEmail.findMany({
        where: { userId: TARGET_ID },
        select: { email: true },
      });
      const targetLinkedEmails = targetLinked.map((l) => l.email);

      if (targetLinkedEmails.length > 0) {
        const linkedDeleted = await tx.linkedEmail.deleteMany({
          where: {
            userId: SOURCE_ID,
            email: { in: targetLinkedEmails },
          },
        });
        log("STEP-3", `LinkedEmail: 删除 ${linkedDeleted.count} 个冲突行`);
      }

      const linkedMigrated = await tx.linkedEmail.updateMany({
        where: { userId: SOURCE_ID },
        data: { userId: TARGET_ID },
      });
      log("STEP-3", `LinkedEmail: 迁移 ${linkedMigrated.count} 行`);

      // AuditLog: 无 FK 约束
      await tx.$executeRawUnsafe(
        `UPDATE "AuditLog" SET "actorId" = $1 WHERE "actorId" = $2`,
        TARGET_ID, SOURCE_ID
      );
      await tx.$executeRawUnsafe(
        `UPDATE "AuditLog" SET "targetId" = $1 WHERE "targetId" = $2`,
        TARGET_ID, SOURCE_ID
      );
      log("STEP-3", "AuditLog: actorId + targetId 已迁移");

      // CliAuthCode: 无 FK 约束
      await tx.$executeRawUnsafe(
        `UPDATE "CliAuthCode" SET "userId" = $1 WHERE "userId" = $2`,
        TARGET_ID, SOURCE_ID
      );
      log("STEP-3", "CliAuthCode: 已迁移");

      log("STEP-3", "✅ base-account 数据迁移完成");

      // ── Step 4: 删除 SOURCE + 绑定备用邮箱 ──

      log("STEP-4", "删除 SOURCE 账号...");

      // 删除 SOURCE User（级联删除 Session 等残留数据）
      await tx.user.delete({ where: { id: SOURCE_ID } });
      log("STEP-4", `✅ SOURCE User 已删除 (id=${SOURCE_ID})`);

      // 绑定 SOURCE 邮箱为 TARGET 的备用邮箱
      const newLinked = await tx.linkedEmail.create({
        data: {
          email: SOURCE_EMAIL!,
          userId: TARGET_ID,
        },
      });
      log("STEP-4", `✅ ${SOURCE_EMAIL} 已绑定为 TARGET 的备用邮箱 (id=${newLinked.id})`);

      // 审计日志
      await tx.auditLog.create({
        data: {
          actorType: ActorType.ADMIN,
          actorId: TARGET_ID,
          action: "ADMIN_ACCOUNT_MERGED",
          targetType: "User",
          targetId: SOURCE_ID,
          metadata: {
            sourceEmail: SOURCE_EMAIL,
            targetEmail: TARGET_EMAIL,
            sourceUserId: SOURCE_ID,
          },
        },
      });
      log("STEP-4", "✅ 审计日志已记录");
    }, { timeout: 30000 });
  }

  // ── Step 5: 验证 ──────────────────────────────────────────────────────────

  log("STEP-5", "验证结果...");

  if (!DRY_RUN) {
    // 验证 source 已删除
    const deletedUser = await prisma.user.findUnique({ where: { id: SOURCE_ID } });
    log("STEP-5", `SOURCE User 已删除: ${deletedUser === null ? "✅" : "❌ 仍存在!"}`);

    // 验证 linked email
    const linkedEmails = await prisma.linkedEmail.findMany({ where: { userId: TARGET_ID } });
    const hasSourceEmail = linkedEmails.some((l) => l.email === SOURCE_EMAIL);
    log("STEP-5", `TARGET LinkedEmails: ${linkedEmails.map((l) => l.email).join(", ")}`);
    log("STEP-5", `SOURCE 邮箱已绑定: ${hasSourceEmail ? "✅" : "❌"}`);

    // 验证外部数据库无残留
    const todoVerify = new Client({ connectionString: AI_TODO_DATABASE_URL });
    await todoVerify.connect();
    const todoRemain = await todoVerify.query(
      "SELECT COUNT(*) as cnt FROM ai_todo_tasks WHERE user_id = $1",
      [SOURCE_ID]
    );
    log("STEP-5", `ai-todo 残留任务数: ${todoRemain.rows[0].cnt} ${todoRemain.rows[0].cnt === "0" ? "✅" : "❌"}`);
    await todoVerify.end();

    const emailVerify = new Client({ connectionString: AI_EMAIL_DATABASE_URL });
    await emailVerify.connect();
    const emailRemain = await emailVerify.query(
      "SELECT COUNT(*) as cnt FROM emails WHERE user_id = $1",
      [SOURCE_ID]
    );
    log("STEP-5", `ai-email 残留邮件数: ${emailRemain.rows[0].cnt} ${emailRemain.rows[0].cnt === "0" ? "✅" : "❌"}`);
    await emailVerify.end();
  }

  console.log("=".repeat(60));
  console.log(DRY_RUN ? "🔍 DRY RUN 完成，未执行任何写操作" : "🎉 账号合并完成！");
  console.log("=".repeat(60));

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ 执行失败:", err);
  process.exit(1);
});
