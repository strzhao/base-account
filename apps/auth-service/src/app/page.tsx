import Link from "next/link";

import styles from "./page.module.css";

const features = [
  {
    iconClass: "iconMail",
    title: "免密码登录",
    description: "邮箱验证码一键登录，无需记忆密码，安全便捷。",
  },
  {
    iconClass: "iconShield",
    title: "OAuth 2.0 授权",
    description: "标准授权码流程，下游服务一键接入，支持用户授权同意。",
  },
  {
    iconClass: "iconLink",
    title: "多邮箱绑定",
    description: "主邮箱 + 备用邮箱，多个邮箱登录同一账号，灵活管理。",
  },
  {
    iconClass: "iconTerminal",
    title: "CLI 鉴权",
    description: "命令行工具原生支持，开发者友好的终端认证体验。",
  },
  {
    iconClass: "iconDashboard",
    title: "服务管理",
    description: "管理控制台统一管理下游服务、API Key 和邀请码。",
  },
  {
    iconClass: "iconKey",
    title: "开放标准",
    description: "JWKS 公钥端点、标准 JWT Token，完全可验证。",
  },
];

const trustItems = [
  { label: "OAuth 2.0", value: "标准授权协议" },
  { label: "JWT + JWKS", value: "公钥可验证 Token" },
  { label: "零密码存储", value: "无密码泄露风险" },
];

export default function HomePage() {
  return (
    <main className={styles.root}>
      <div className={styles.gridAura} />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <span className={styles.logo}>统一账号中心</span>
          <nav className={styles.headerNav}>
            <Link href="/login" className={styles.headerLink}>登录</Link>
            <Link href="/docs" className={styles.headerLinkPrimary}>接入文档</Link>
          </nav>
        </div>
      </header>

      <section className={styles.hero}>
        <span className={styles.kicker}>Unified Identity</span>
        <h1 className={styles.heroTitle}>一个账号，连接所有服务</h1>
        <p className={styles.heroSubtitle}>
          为你的应用提供安全、可靠的统一认证与授权能力。
          免密码登录、OAuth 2.0 授权、多邮箱绑定、CLI 鉴权 &mdash; 开箱即用。
        </p>
        <div className={styles.heroCta}>
          <Link href="/login" className={styles.ctaPrimary}>
            开始使用 &rarr;
          </Link>
          <Link href="/docs" className={styles.ctaSecondary}>查看文档</Link>
        </div>
      </section>

      <section className={styles.features}>
        <h2 className={styles.sectionTitle}>核心能力</h2>
        <div className={styles.featureGrid}>
          {features.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <div className={`${styles.featureIcon} ${styles[f.iconClass]}`} />
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.trust}>
        <div className={styles.trustGrid}>
          {trustItems.map((t) => (
            <div key={t.label} className={styles.trustItem}>
              <strong className={styles.trustLabel}>{t.label}</strong>
              <span className={styles.trustValue}>{t.value}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.quickLinks}>
          <Link href="/login" className={styles.quickLink}>进入登录</Link>
          <Link href="/account" className={styles.quickLink}>账号设置</Link>
          <Link href="/admin" className={styles.quickLink}>管理控制台</Link>
          <Link href="/docs" className={styles.quickLink}>接入文档</Link>
        </div>
        <p className={styles.footerText}>统一账号中心 · user.stringzhao.life</p>
      </footer>
    </main>
  );
}
