"use client";

import styles from "./authorize.module.css";

interface AccountSelectorProps {
  email: string;
  callbackUrl: string;
  loginPath: string;
  serviceName: string;
}

export function AccountSelector({ email, callbackUrl, loginPath, serviceName }: AccountSelectorProps) {
  return (
    <>
      <p className={styles.summary}>选择要用于 {serviceName} 的账号。</p>

      <div className={styles.meta}>
        <button
          onClick={() => { window.location.href = callbackUrl; }}
          className={styles.accountOption}
        >
          <span className={styles.accountAvatar}>
            {email.charAt(0).toUpperCase()}
          </span>
          <span className={styles.accountEmail}>{email}</span>
          <span className={styles.accountAction}>继续</span>
        </button>
      </div>

      <div className={styles.actions}>
        <button onClick={() => { window.location.href = loginPath; }}>
          使用其他账号
        </button>
      </div>
    </>
  );
}
