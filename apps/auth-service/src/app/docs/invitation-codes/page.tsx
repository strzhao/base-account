import {
  invitationCodeEndpoints,
  invitationCodeSteps,
  invitationCodeTemplate
} from "@/app/docs/content-invitation";
import { CopyForAiButton } from "@/app/docs/copy-for-ai-button";

import styles from "../docs.module.css";

export default function InvitationCodesDocsPage() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.heroTop}>
          <h2>Invitation Codes</h2>
          <CopyForAiButton endpoint="/api/docs/ai-feed?topic=invitation-codes" tip="仅复制邀请码文档" />
        </div>
        <p className={styles.summary}>
          邀请码系统允许已登录用户为指定应用生成一次性邀请码（每用户每应用默认 3 个）。
          兑换后系统记录邀请关系（谁邀请了谁），下游服务可据此做增长分析和奖励机制。
        </p>

        <h3>接入步骤</h3>
        <ol className={styles.steps}>
          {invitationCodeSteps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2>API 端点</h2>
        <div className={styles.endpointList}>
          {invitationCodeEndpoints.map((endpoint) => (
            <article key={`${endpoint.method}-${endpoint.path}`} className={styles.endpointCard}>
              <header>
                <span className={endpoint.method === "GET" ? styles.methodGet : styles.methodPost}>
                  {endpoint.method}
                </span>
                <code>{endpoint.path}</code>
              </header>
              <p>{endpoint.purpose}</p>
              <p className={styles.authHint}>Auth: {endpoint.auth}</p>
              <details className={styles.fold}>
                <summary>展开查看请求/响应示例</summary>
                {endpoint.requestExample ? (
                  <>
                    <h4>Request</h4>
                    <pre>{endpoint.requestExample}</pre>
                  </>
                ) : null}
                <h4>Response</h4>
                <pre>{endpoint.responseExample}</pre>
                <h4>Errors</h4>
                <ul>
                  {endpoint.errorNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>集成模板</h2>
        <div className={styles.templateList}>
          <article className={styles.templateCard}>
            <header>
              <h3>{invitationCodeTemplate.title}</h3>
              <span>{invitationCodeTemplate.runtime}</span>
            </header>
            <details className={styles.fold}>
              <summary>展开查看模板代码</summary>
              <pre>
                <code>{invitationCodeTemplate.code}</code>
              </pre>
            </details>
          </article>
        </div>
      </section>
    </>
  );
}
