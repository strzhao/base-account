"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import styles from "./account.module.css";

type LinkedEmail = {
  id: string;
  email: string;
  createdAt: string;
};

type UserInfo = {
  id: string;
  email: string;
};

type ApiResponse = {
  error?: string;
  message?: string;
  debugCode?: string;
};

function extractErrorMessage(payload: ApiResponse | null): string {
  switch (payload?.error) {
    case "email_conflict":
      return "这已经是你的主邮箱。";
    case "email_already_registered":
      return "该邮箱已注册为独立账号，无法作为备用邮箱绑定。";
    case "email_already_linked":
      return "该邮箱已被绑定到其他账号。";
    case "linked_email_limit":
      return "已达到备用邮箱数量上限。";
    case "invalid_code":
      return "验证码无效或已过期，请重新获取。";
    case "too_many_attempts":
      return "尝试次数过多，请稍后再试。";
    case "rate_limited":
      return "请求过于频繁，请稍后再试。";
    case "email_delivery_failed":
      return "验证码发送失败，请稍后重试。";
    case "invalid_input":
      return "输入格式有误，请检查邮箱或验证码。";
    default:
      return payload?.message ?? "请求失败，请稍后重试。";
  }
}

export default function AccountPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [linkedEmails, setLinkedEmails] = useState<LinkedEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Link email form state
  const [linkEmail, setLinkEmail] = useState("");
  const [linkCode, setLinkCode] = useState("");
  const [linkStep, setLinkStep] = useState<"email" | "code">("email");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkDebugCode, setLinkDebugCode] = useState<string | null>(null);

  // Removing state
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [meRes, linkedRes] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/account/linked-emails", { credentials: "include" })
      ]);

      if (!meRes.ok) {
        setAuthError(true);
        return;
      }

      const meData = await meRes.json();
      setUser(meData);

      if (linkedRes.ok) {
        const linkedData = await linkedRes.json();
        setLinkedEmails(linkedData.linkedEmails ?? []);
      }
    } catch {
      setAuthError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function sendLinkCode() {
    setLinkBusy(true);
    setLinkMessage(null);
    setLinkError(null);
    setLinkDebugCode(null);

    try {
      const res = await fetch("/api/account/linked-emails/send-code", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: linkEmail.trim().toLowerCase() })
      });

      const payload = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok) {
        setLinkError(extractErrorMessage(payload));
        return;
      }

      setLinkStep("code");
      setLinkMessage("验证码已发送，请查收邮箱。");
      setLinkDebugCode(payload?.debugCode ?? null);
    } finally {
      setLinkBusy(false);
    }
  }

  async function onSendLinkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendLinkCode();
  }

  async function onVerifyLinkCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLinkBusy(true);
    setLinkMessage(null);
    setLinkError(null);

    try {
      const res = await fetch("/api/account/linked-emails/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: linkEmail.trim().toLowerCase(), code: linkCode.trim() })
      });

      const payload = (await res.json().catch(() => null)) as ApiResponse | null;

      if (!res.ok) {
        setLinkError(extractErrorMessage(payload));
        return;
      }

      setLinkMessage("备用邮箱绑定成功！");
      setLinkEmail("");
      setLinkCode("");
      setLinkStep("email");
      setLinkDebugCode(null);

      // Refresh list
      await fetchData();
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("确定要解绑这个备用邮箱吗？解绑后将无法用该邮箱登录此账号。")) {
      return;
    }

    setRemovingId(id);
    try {
      const res = await fetch(`/api/account/linked-emails/${id}`, {
        method: "DELETE",
        credentials: "include"
      });

      if (res.ok) {
        setLinkedEmails((prev) => prev.filter((le) => le.id !== id));
      }
    } finally {
      setRemovingId(null);
    }
  }

  if (loading) {
    return (
      <main className={styles.root}>
        <section className={styles.shell}>
          <div className={styles.card}>
            <h1 className={styles.title}>账号设置</h1>
            <p className={styles.subtitle}>加载中...</p>
          </div>
        </section>
      </main>
    );
  }

  if (authError || !user) {
    return (
      <main className={styles.root}>
        <section className={styles.shell}>
          <div className={styles.card}>
            <h1 className={styles.title}>账号设置</h1>
            <p className={styles.subtitle}>请先登录后再访问此页面。</p>
            <Link href="/login" className={styles.primaryButton}>前往登录</Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <Link href="/" className={styles.backLink}>&larr; 返回首页</Link>

        <div className={styles.card}>
          <h1 className={styles.title}>账号设置</h1>
          <p className={styles.subtitle}>管理你的账号信息和备用邮箱。</p>
          <div className={styles.fieldLabel}>主邮箱</div>
          <div className={styles.fieldValue}>{user.email}</div>
        </div>

        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>备用邮箱</h2>
          <p className={styles.subtitle}>绑定备用邮箱后，可以用备用邮箱登录此账号。最多绑定 5 个。</p>

          {linkedEmails.length > 0 ? (
            <ul className={styles.emailList}>
              {linkedEmails.map((le) => (
                <li key={le.id} className={styles.emailItem}>
                  <span>
                    <span className={styles.emailItemText}>{le.email}</span>
                    <span className={styles.emailItemDate}>
                      {new Date(le.createdAt).toLocaleDateString("zh-CN")}
                    </span>
                  </span>
                  <button
                    className={styles.removeButton}
                    disabled={removingId === le.id}
                    onClick={() => handleRemove(le.id)}
                  >
                    {removingId === le.id ? "解绑中..." : "解绑"}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.emptyHint}>暂无备用邮箱。</p>
          )}

          <form
            onSubmit={linkStep === "email" ? onSendLinkCode : onVerifyLinkCode}
            className={styles.form}
          >
            <label htmlFor="linkEmail" className={styles.label}>添加备用邮箱</label>
            <div className={styles.emailRow}>
              <input
                id="linkEmail"
                name="linkEmail"
                type="email"
                placeholder="输入备用邮箱地址"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                required
                autoFocus={linkStep === "email"}
                readOnly={linkStep === "code"}
                className={`${styles.input} ${linkStep === "code" ? styles.inputReadonly : ""}`}
              />
              {linkStep === "code" && (
                <button
                  type="button"
                  className={styles.changeButton}
                  onClick={() => {
                    setLinkStep("email");
                    setLinkCode("");
                    setLinkError(null);
                    setLinkMessage(null);
                    setLinkDebugCode(null);
                  }}
                >
                  修改
                </button>
              )}
            </div>

            {linkStep === "code" && (
              <>
                <label htmlFor="linkCode" className={styles.label}>验证码</label>
                <input
                  id="linkCode"
                  name="linkCode"
                  value={linkCode}
                  onChange={(e) => setLinkCode(e.target.value)}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  className={styles.input}
                />
              </>
            )}

            <div className={styles.actions}>
              {linkStep === "email" ? (
                <button
                  type="submit"
                  disabled={linkBusy || !linkEmail.trim()}
                  className={styles.primaryButton}
                >
                  {linkBusy ? "发送中..." : "发送验证码"}
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={linkBusy || !linkCode.trim()}
                    className={styles.primaryButton}
                  >
                    {linkBusy ? "验证中..." : "验证并绑定"}
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={linkBusy}
                    onClick={() => {
                      setLinkCode("");
                      sendLinkCode();
                    }}
                  >
                    重新发送
                  </button>
                </>
              )}
            </div>
          </form>

          {linkMessage ? <p className={styles.info}><small>{linkMessage}</small></p> : null}
          {linkError ? <p className={styles.error}><small>{linkError}</small></p> : null}
          {linkDebugCode ? <p className={styles.debug}><small>调试验证码：<strong>{linkDebugCode}</strong></small></p> : null}
        </div>
      </section>
    </main>
  );
}
