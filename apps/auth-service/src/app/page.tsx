import Link from "next/link";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <div className={styles.panel}>
          <h1 className={styles.title}>统一账号中心</h1>
          <p className={styles.summary}>为你的所有 Vercel 服务提供统一登录、授权与账号鉴权能力。</p>
          <div className={styles.actions}>
            <Link href="/login" className={styles.link}>进入登录</Link>
            <span className={styles.dot}>·</span>
            <Link href="/account" className={styles.link}>账号设置</Link>
            <span className={styles.dot}>·</span>
            <Link href="/admin" className={styles.link}>管理控制台</Link>
            <span className={styles.dot}>·</span>
            <Link href="/docs" className={styles.link}>接入文档</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
