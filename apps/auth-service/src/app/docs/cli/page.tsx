import { cliSections } from "@/app/docs/content-cli";
import { CopyForAiButton } from "@/app/docs/copy-for-ai-button";

import styles from "../docs.module.css";

export default function CliDocsPage() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.heroTop}>
          <h2>CLI Tool</h2>
          <CopyForAiButton endpoint="/api/docs/ai-feed?topic=cli" tip="复制 CLI 文档" />
        </div>
        <p>
          <code>@stringzhao/base-account-cli</code> 是面向 AI Agent 的命令行工具，用于管理用户、服务和
          API Key。命令通过服务端 manifest 动态获取，无需升级 CLI 即可使用新能力。
        </p>
      </section>

      {cliSections.map((section) => (
        <section key={section.title} className={styles.section}>
          <h3>{section.title}</h3>
          <pre className={styles.codeBlock}>{section.content}</pre>
        </section>
      ))}
    </>
  );
}
