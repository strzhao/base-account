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
  message?: string;
};

function resolveErrorMessage(payload: ApproveResponse | null): string {
  return payload?.message ?? "Unable to complete authorization. Please try again.";
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
        setError("Missing redirect destination from approval response.");
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
          {busy ? "Authorizing..." : "Continue and authorize"}
        </button>
      </div>
      {error ? <p style={{ color: "#b91c1c", marginTop: 12 }}><small>{error}</small></p> : null}
    </form>
  );
}

