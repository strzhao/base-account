"use client";

import { FormEvent, useState } from "react";

type ApproveConsentFormProps = {
  serviceId: string;
  returnTo: string;
  state: string;
};

type ApproveResponse = {
  success?: boolean;
  redirectTo?: string;
  error?: string;
  message?: string;
};

function resolveErrorMessage(payload: ApproveResponse | null): string {
  switch (payload?.error) {
    case "missing_access_token":
      return "登录态已失效，请重新登录。";
    case "invalid_return_to":
      return "回跳地址不在授权白名单内，请联系管理员。";
    case "invalid_service":
      return "service 参数无效，请检查接入配置。";
    default:
      return "授权失败，请稍后重试。";
  }
}

export function ApproveConsentForm({ serviceId, returnTo, state }: ApproveConsentFormProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/authorize/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          service: serviceId,
          return_to: returnTo,
          state
        })
      });

      const payload = (await response.json().catch(() => null)) as ApproveResponse | null;
      if (!response.ok) {
        setError(resolveErrorMessage(payload));
        return;
      }

      if (!payload?.redirectTo) {
        setError("未获取到回跳地址，请稍后重试。");
        return;
      }

      window.location.assign(payload.redirectTo);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="inline-actions">
        <button type="submit" disabled={busy}>
          {busy ? "授权中..." : "同意并继续"}
        </button>
      </div>
      {error ? <p style={{ color: "#b91c1c", marginTop: 12 }}><small>{error}</small></p> : null}
    </form>
  );
}
