"use client";

import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState } from "react";

type SendCodeResponse = {
  success: boolean;
  requestId?: string;
  debugCode?: string;
  message?: string;
};

type VerifyResponse = {
  error?: string;
  message?: string;
};

function extractErrorMessage(payload: VerifyResponse | null): string {
  return payload?.message ?? "Request failed. Please try again.";
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
    <main className="page-shell">
      <section className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1>Login</h1>
        <p>Loading login context...</p>
      </section>
    </main>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
      setMessage("Verification code sent. Please check your inbox.");
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

      const payload = (await response.json().catch(() => null)) as VerifyResponse | null;

      if (!response.ok) {
        setError(extractErrorMessage(payload));
        return;
      }

      setMessage("Login successful.");
      router.push((authorizePath ?? "/admin") as Route);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="panel" style={{ maxWidth: 520, margin: "0 auto" }}>
        <h1>Login</h1>
        <p>
          {authorizePath
            ? "Sign in to continue authorization for your external service."
            : "Enter your email to receive a one-time verification code."}
        </p>

        {step === "email" ? (
          <form onSubmit={onSendCode}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
            <div style={{ height: 12 }} />
            <button type="submit" disabled={busy || !email.trim()}>
              {busy ? "Sending..." : "Send verification code"}
            </button>
          </form>
        ) : (
          <form onSubmit={onVerifyCode}>
            <label htmlFor="code">Verification code</label>
            <input
              id="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              required
            />
            <div style={{ height: 12 }} />
            <div className="inline-actions">
              <button type="submit" disabled={busy || !code.trim()}>
                {busy ? "Verifying..." : "Verify and login"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                  setMessage(null);
                }}
              >
                Back
              </button>
            </div>
          </form>
        )}

        {message ? <p><small>{message}</small></p> : null}
        {error ? <p style={{ color: "#b91c1c" }}><small>{error}</small></p> : null}
        {debugCode ? <p><small>Debug code: <strong>{debugCode}</strong></small></p> : null}
      </section>
    </main>
  );
}
