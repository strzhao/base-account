"use client";

import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";

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

const SESSION_READY_CHECK_RETRIES = 5;
const SESSION_READY_CHECK_INTERVAL_MS = 120;

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
  const checkedSessionRef = useRef(false);

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);

  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const authorizePath = useMemo(() => {
    const service = searchParams.get("service")?.trim();
    const returnTo = searchParams.get("return_to")?.trim();
    const state = searchParams.get("state")?.trim();

    if (!service || !returnTo || !state) {
      return null;
    }

    const query = new URLSearchParams();
    query.set("service", service);
    query.set("return_to", returnTo);
    query.set("state", state);
    return `/authorize?${query.toString()}`;
  }, [searchParams]);

  async function waitForSessionReady(): Promise<boolean> {
    for (let index = 0; index < SESSION_READY_CHECK_RETRIES; index += 1) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, SESSION_READY_CHECK_INTERVAL_MS));
      }

      const response = await fetch("/api/auth/me", {
        cache: "no-store"
      });

      if (response.ok) {
        return true;
      }
    }

    return false;
  }

  function continueAfterLogin(path: string) {
    window.location.assign(path);
  }

  useEffect(() => {
    if (!authorizePath || checkedSessionRef.current) {
      return;
    }

    const targetPath = authorizePath;
    checkedSessionRef.current = true;

    let cancelled = false;

    async function resumeAuthorizeIfLoggedIn() {
      const ready = await waitForSessionReady();
      if (!cancelled && ready) {
        continueAfterLogin(targetPath);
      }
    }

    void resumeAuthorizeIfLoggedIn();

    return () => {
      cancelled = true;
    };
  }, [authorizePath]);

  async function onSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

      await waitForSessionReady();
      continueAfterLogin((authorizePath ?? "/admin") as Route);
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

          {step === "email" ? (
            <form onSubmit={onSendCode} className={styles.form}>
              <label htmlFor="email" className={styles.label}>邮箱</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
                className={styles.input}
              />
              <div className={styles.actions}>
                <button type="submit" disabled={busy || !email.trim()} className={styles.primaryButton}>
                  {busy ? "发送中..." : "发送验证码"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={onVerifyCode} className={styles.form}>
              <label htmlFor="code" className={styles.label}>验证码</label>
              <input
                id="code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                required
                className={styles.input}
              />
              <div className={styles.actions}>
                <button type="submit" disabled={busy || !code.trim()} className={styles.primaryButton}>
                  {busy ? "验证中..." : "验证并登录"}
                </button>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setError(null);
                    setMessage(null);
                  }}
                >
                  返回
                </button>
              </div>
            </form>
          )}

          {message ? <p className={styles.info}><small>{message}</small></p> : null}
          {error ? <p className={styles.error}><small>{error}</small></p> : null}
          {debugCode ? <p className={styles.debug}><small>调试验证码：<strong>{debugCode}</strong></small></p> : null}
        </div>
      </section>
    </main>
  );
}
