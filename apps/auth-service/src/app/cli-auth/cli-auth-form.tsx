"use client";

import { useCallback, useState } from "react";

import styles from "@/app/authorize/authorize.module.css";

type Props = {
  state: string;
  port: string;
};

export function CliAuthForm({ state, port }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");

  const handleAuthorize = useCallback(async () => {
    setStatus("loading");

    try {
      const res = await fetch("/api/auth/cli/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state, port: Number(port) })
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || `授权失败 (${res.status})`);
      }

      const data = (await res.json()) as { redirectTo: string };
      setStatus("done");
      window.location.assign(data.redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "授权失败");
      setStatus("error");
    }
  }, [state, port]);

  return (
    <>
      <div className={styles.actions}>
        <button
          onClick={handleAuthorize}
          disabled={status === "loading" || status === "done"}
        >
          {status === "loading" ? "授权中..." : status === "done" ? "已授权，正在跳转..." : "确认授权"}
        </button>
      </div>

      {status === "error" && (
        <p className={styles.note} style={{ color: "#a0503c" }}>{error}</p>
      )}
    </>
  );
}
