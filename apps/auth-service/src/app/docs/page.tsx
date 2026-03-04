import type { Metadata } from "next";
import Link from "next/link";
import { Cormorant_Garamond, IBM_Plex_Mono, Spectral } from "next/font/google";

import {
  AUDIENCE,
  DOC_VERSION,
  ISSUER,
  JWKS_URL,
  endpointSpecs,
  machineReadableSpec,
  quickStartSteps,
  rolloutChecklist,
  templateSpecs,
  troubleshooting,
  externalIntegrationChecklist
} from "@/app/docs/content";
import { CopyForAiButton } from "@/app/docs/copy-for-ai-button";

import styles from "./docs.module.css";

const titleFont = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-zen-title",
  weight: ["500", "700"]
});

const bodyFont = Spectral({
  subsets: ["latin"],
  variable: "--font-zen-body",
  weight: ["400", "500", "600"]
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-zen-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "Base Account Docs",
  description: "AI-first integration documentation for Base Account Service"
};

export default function DocsPage() {
  const machineJson = JSON.stringify(machineReadableSpec, null, 2);

  return (
    <main className={`${styles.root} ${titleFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <div className={styles.gridAura} aria-hidden />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div className={styles.heroTop}>
            <p className={styles.kicker}>Base Account / Integration</p>
            <CopyForAiButton />
          </div>
          <h1>账号系统接入文档</h1>
          <p className={styles.summary}>
            这是给产品工程和 AI Agent 共用的单页规范。你可以从这里直接拿到稳定接口、JWT 校验规则和可复制模板。
          </p>
          <div className={styles.metaRow}>
            <span>
              <strong>Issuer</strong>
              {ISSUER}
            </span>
            <span>
              <strong>Audience</strong>
              {AUDIENCE}
            </span>
            <span>
              <strong>JWKS</strong>
              {JWKS_URL}
            </span>
            <span>
              <strong>Doc</strong>
              v{DOC_VERSION}
            </span>
          </div>
          <nav className={styles.nav}>
            <a href="#quick-start">Quick Start</a>
            <a href="#api-contract">API Contract</a>
            <a href="#templates">Templates</a>
            <a href="#external-checklist">External Checklist</a>
            <a href="#machine-spec">Machine Spec</a>
            <Link href="/login">Login</Link>
          </nav>
        </header>

        <section id="quick-start" className={styles.section}>
          <h2>Quick Start</h2>
          <ol className={styles.steps}>
            {quickStartSteps.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="api-contract" className={styles.section}>
          <h2>API Contract</h2>
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

        <section id="templates" className={styles.section}>
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

        <section id="external-checklist" className={styles.section}>
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

        <section id="machine-spec" className={styles.section}>
          <h2>Machine Readable Spec</h2>
          <p className={styles.summary}>
            AI Agent 可直接读取下方 JSON 进行自动接入。结构版本字段为 <code>docVersion</code>。
          </p>
          <div className={styles.machineActions}>
            <CopyForAiButton endpoint="/api/docs/machine-spec" tip="复制 Machine Readable JSON" />
          </div>
          <script
            id="base-account-machine-spec"
            type="application/json"
            dangerouslySetInnerHTML={{ __html: machineJson }}
          />
          <details className={styles.fold}>
            <summary>展开查看 Machine Readable JSON</summary>
            <pre data-machine-readable>{machineJson}</pre>
          </details>
        </section>
      </div>
    </main>
  );
}
