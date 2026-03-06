import {
  endpointSpecs,
  externalIntegrationChecklist,
  rolloutChecklist,
  templateSpecs,
  troubleshooting
} from "@/app/docs/content-auth";
import { CopyForAiButton } from "@/app/docs/copy-for-ai-button";

import styles from "../docs.module.css";

export default function AuthDocsPage() {
  return (
    <>
      <section className={styles.section}>
        <div className={styles.heroTop}>
          <h2>API Contract</h2>
          <CopyForAiButton endpoint="/api/docs/ai-feed?topic=auth" tip="仅复制认证系统文档" />
        </div>
        <p className={styles.cliTip}>
          推荐使用 CLI 完成服务注册和管理操作：<code>npm install -g @stringzhao/base-account-cli</code>。
          注册服务：<code>ba admin services create --origin &lt;url&gt;</code>，无需访问 Admin Console。
        </p>
        <div className={styles.endpointList}>
          {endpointSpecs.map((endpoint) => (
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
        <h2>Integration Templates</h2>
        <div className={styles.templateList}>
          {templateSpecs.map((template) => (
            <article key={template.id} className={styles.templateCard}>
              <header>
                <h3>{template.title}</h3>
                <span>{template.runtime}</span>
              </header>
              <details className={styles.fold}>
                <summary>展开查看模板代码</summary>
                <pre>
                  <code>{template.code}</code>
                </pre>
              </details>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Deployment Checklist</h2>
        <ul className={styles.cleanList}>
          {rolloutChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>External Integration Checklist</h2>
        <ul className={styles.cleanList}>
          {externalIntegrationChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Troubleshooting</h2>
        <div className={styles.issueList}>
          {troubleshooting.map((item) => (
            <article key={item.title} className={styles.issueCard}>
              <h3>{item.title}</h3>
              <p>{item.fix}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
