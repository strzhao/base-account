"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

import styles from "./login.module.css";

type SendCodeResponse = {
  success: boolean;
  requestId?: string;
  debugCode?: string;
  error?: string;
  message?: string;
};

type ApiResponse = {
  error?: string;
  message?: string;
};

const SESSION_READY_CHECK_RETRIES = 20;
const SESSION_READY_CHECK_INTERVAL_MS = 250;

function extractErrorMessage(payload: ApiResponse | null): string {
  switch (payload?.error) {
    case "invalid_input":
      return "输入格式有误，请检查邮箱或验证码。";
    case "invalid_code":
      return "验证码无效或已过期，请重新获取。";
    case "too_many_attempts":
      return "尝试次数过多，请稍后再试。";
    case "rate_limited":
      return "请求过于频繁，请稍后再试。";
    case "email_delivery_failed":
      return "验证码发送失败，请稍后重试。";
    case "account_disabled":
      return "账号已被禁用，请联系管理员。";
    default:
      return "请求失败，请稍后重试。";
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <div className={styles.card}>
          <h1 className={styles.title}>登录</h1>
          <p className={styles.subtitle}>正在加载登录上下文...</p>
        </div>
      </section>
    </main>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();

  const prefillEmail = searchParams.get("email")?.trim().toLowerCase() || "";
  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const authorizePath = useMemo(() => {
    const returnTo = searchParams.get("return_to")?.trim();
    const state = searchParams.get("state")?.trim();

    if (!returnTo || !state) {
      return null;
    }

    const query = new URLSearchParams();
    // service 向后兼容：有就透传，没有不阻断（后端已通过 return_to origin 识别服务）
    const service = searchParams.get("service")?.trim();
    if (service) {
      query.set("service", service);
    }
    query.set("return_to", returnTo);
    query.set("state", state);
    return `/authorize?${query.toString()}`;
  }, [searchParams]);

  async function waitForSessionReady(): Promise<boolean> {
    for (let index = 0; index < SESSION_READY_CHECK_RETRIES; index += 1) {
      if (index >= 0) {
        await new Promise((resolve) => setTimeout(resolve, SESSION_READY_CHECK_INTERVAL_MS));
      }

      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
          credentials: "include"
        });

        if (response.ok) {
          return true;
        }

        if (response.status === 401 || response.status === 403) {
          await fetch("/api/auth/refresh", {
            method: "POST",
            cache: "no-store",
            credentials: "include",
            headers: {
              "Content-Type": "application/json"
            },
            body: "{}"
          }).catch(() => null);
        }
      } catch {
        // Ignore transient network errors and continue polling.
      }
    }

    return false;
  }

  function continueAfterLogin(path: string) {
    window.location.assign(path);
  }

  async function sendCode() {
    setBusy(true);
    setMessage(null);
    setError(null);
    setDebugCode(null);

    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: normalizedEmail })
      });

      const payload = (await response.json().catch(() => null)) as SendCodeResponse | null;

      if (!response.ok) {
        setError(extractErrorMessage(payload));
        return;
      }

      setStep("code");
      setMessage("验证码已发送，请查收邮箱。");
      setDebugCode(payload?.debugCode ?? null);
    } finally {
      setBusy(false);
    }
  }

  async function onSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode();
  }

  async function onVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email: normalizedEmail, code: code.trim() })
      });

      const payload = (await response.json().catch(() => null)) as ApiResponse | null;

      if (!response.ok) {
        setError(extractErrorMessage(payload));
        return;
      }

      setMessage("登录成功，正在跳转...");

      // 记录已登录邮箱到 localStorage
      try {
        const accounts: string[] = JSON.parse(localStorage.getItem("known_accounts") || "[]");
        const filtered = accounts.filter((a) => a !== normalizedEmail);
        filtered.unshift(normalizedEmail);
        localStorage.setItem("known_accounts", JSON.stringify(filtered));
      } catch { /* ignore */ }

      const sessionReady = await waitForSessionReady();
      if (!sessionReady) {
        setMessage(null);
        setError("登录状态同步超时，请稍后重试。");
        return;
      }

      continueAfterLogin((authorizePath ?? "/") as Route);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.root}>
      <section className={styles.shell}>
        <div className={styles.card}>
          <h1 className={styles.title}>登录</h1>
          <p className={styles.subtitle}>
          {authorizePath
            ? "请先登录，再继续完成外部服务授权。"
            : "请输入邮箱，我们会发送一次性验证码。"}
          </p>

          <form onSubmit={step === "email" ? onSendCode : onVerifyCode} className={styles.form}>
            <label htmlFor="email" className={styles.label}>邮箱</label>
            <div className={styles.emailRow}>
              <input
                id="email"
                name="email"
                type="email"

                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus={step === "email"}
                readOnly={step === "code"}
                className={`${styles.input} ${step === "code" ? styles.inputReadonly : ""}`}
              />
              {step === "code" && (
                <button
                  type="button"
                  className={styles.changeButton}
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setMessage(null);
                    setDebugCode(null);
                  }}
                >
                  修改
                </button>
              )}
            </div>

            {step === "code" && (
              <>
                <label htmlFor="code" className={styles.label}>验证码</label>
                <input
                  id="code"
                  name="code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
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
              {step === "email" ? (
                <button type="submit" disabled={busy || !email.trim()} className={styles.primaryButton}>
                  {busy ? "发送中..." : "发送验证码"}
                </button>
              ) : (
                <>
                  <button type="submit" disabled={busy || !code.trim()} className={styles.primaryButton}>
                    {busy ? "验证中..." : "验证并登录"}
                  </button>
                  <button
                    type="button"
                    className={styles.linkButton}
                    disabled={busy}
                    onClick={() => {
                      setCode("");
                      sendCode();
                    }}
                  >
                    重新发送
                  </button>
                </>
              )}
            </div>
          </form>

          {message ? <p className={styles.info}><small>{message}</small></p> : null}
          {error ? <p className={styles.error}><small>{error}</small></p> : null}
          {debugCode ? <p className={styles.debug}><small>调试验证码：<strong>{debugCode}</strong></small></p> : null}
        </div>
      </section>
    </main>
  );
}
