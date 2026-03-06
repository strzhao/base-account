import Link from "next/link";

import { quickStartSteps } from "@/app/docs/content-auth";
import { CopyForAiButton } from "@/app/docs/copy-for-ai-button";

import styles from "./docs.module.css";

export default function DocsOverviewPage() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.heroTop}>
          <h2>Quick Start</h2>
          <CopyForAiButton />
        </div>
        <ol className={styles.steps}>
          {quickStartSteps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <p className={styles.cliTip}>
        推荐使用 CLI 工具完成服务注册和管理操作，无需访问 Admin Console：<code>npm install -g @stringzhao/base-account-cli</code>
      </p>

      <div className={styles.capabilityGrid}>
        <Link href="/docs/auth" className={styles.capabilityCard}>
          <h3>Auth API</h3>
          <p>认证系统完整接入：8 个 API 端点、5 个集成模板、部署检查清单和故障排除。</p>
        </Link>
        <Link href="/docs/invitation-codes" className={styles.capabilityCard}>
          <h3>Invitation Codes</h3>
          <p>邀请码增长机制：生成、分享、兑换邀请码，记录邀请关系，支持配额管理。</p>
        </Link>
        <Link href="/docs/machine-spec" className={styles.capabilityCard}>
          <h3>Machine Spec</h3>
          <p>机器可读 JSON 规范，AI Agent 可直接解析进行自动接入。</p>
        </Link>
      </div>
    </>
  );
}
