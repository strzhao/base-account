import type { Metadata } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, Spectral } from "next/font/google";

import { DOC_VERSION, ISSUER, AUDIENCE, JWKS_URL } from "@/app/docs/content-base";
import { DocsNav } from "@/app/docs/docs-nav";

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

export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className={`${styles.root} ${titleFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <div className={styles.gridAura} aria-hidden />
      <div className={styles.shell}>
        <header className={styles.hero}>
          <p className={styles.kicker}>Base Account / Integration</p>
          <h1>账号系统接入文档</h1>
          <p className={styles.summary}>
            按能力模块拆分的接入规范，供产品工程和 AI Agent 按需获取。
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
          <DocsNav />
        </header>
        {children}
      </div>
    </main>
  );
}
