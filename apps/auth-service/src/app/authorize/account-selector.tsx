"use client";

import { useEffect, useState } from "react";
import styles from "./authorize.module.css";

interface AccountSelectorProps {
  email: string;
  callbackUrl: string;
  loginPath: string;
  serviceName: string;
}

export function AccountSelector({ email, callbackUrl, loginPath, serviceName }: AccountSelectorProps) {
  const [otherAccounts, setOtherAccounts] = useState<string[]>([]);

  useEffect(() => {
    try {
      const accounts: string[] = JSON.parse(localStorage.getItem("known_accounts") || "[]");
      setOtherAccounts(accounts.filter((a) => a !== email));
    } catch { /* ignore */ }
  }, [email]);

  function loginWithEmail(targetEmail: string) {
    const separator = loginPath.includes("?") ? "&" : "?";
    window.location.href = `${loginPath}${separator}email=${encodeURIComponent(targetEmail)}`;
  }

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

        {otherAccounts.map((account) => (
          <button
            key={account}
            onClick={() => loginWithEmail(account)}
            className={styles.accountOption}
          >
            <span className={styles.accountAvatar}>
              {account.charAt(0).toUpperCase()}
            </span>
            <span className={styles.accountEmail}>{account}</span>
            <span className={styles.accountAction}>切换</span>
          </button>
        ))}
      </div>

      <div className={styles.actions}>
        <button onClick={() => { window.location.href = loginPath; }}>
          使用新账号
        </button>
      </div>
    </>
  );
}
