"use client";

import { useState } from "react";

import styles from "./copy-for-ai-button.module.css";

type CopyState = "idle" | "copying" | "copied" | "failed";

function copyWithLegacyApi(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  return copied;
}

type CopyForAiButtonProps = {
  endpoint?: string;
  tip?: string;
};

export function CopyForAiButton({ endpoint = "/api/docs/ai-feed", tip }: CopyForAiButtonProps) {
  const [state, setState] = useState<CopyState>("idle");

  async function handleCopy() {
    if (state === "copying") {
      return;
    }

    setState("copying");

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("load_payload_failed");
      }
      const contentType = response.headers.get("content-type") ?? "";
      const payload = contentType.includes("application/json")
        ? JSON.stringify(await response.json(), null, 2)
        : await response.text();

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
      } else if (!copyWithLegacyApi(payload)) {
        throw new Error("legacy_copy_failed");
      }
      setState("copied");
      window.setTimeout(() => setState("idle"), 2200);
    } catch {
      setState("failed");
      window.setTimeout(() => setState("idle"), 2600);
    }
  }

  const label =
    state === "copying" ? "复制中..." : state === "copied" ? "已复制给 AI" : "复制给 AI 使用";

  const defaultTip =
    state === "failed"
      ? "复制失败，请重试"
      : tip ?? "包含接入步骤、API 契约、模板代码与机器 JSON";

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.button} onClick={handleCopy} disabled={state === "copying"}>
        {label}
      </button>
      <span className={styles.tip} role="status" aria-live="polite">
        {defaultTip}
      </span>
    </div>
  );
}
