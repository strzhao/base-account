"use client";

import { useState } from "react";

import styles from "@/app/authorize/authorize.module.css";

type ServiceIconProps = {
  serviceName: string;
  iconUrl: string | null;
};

export function ServiceIcon({ serviceName, iconUrl }: ServiceIconProps) {
  const [failed, setFailed] = useState(false);
  const fallback = (serviceName.trim().slice(0, 1) || "?").toUpperCase();

  if (!iconUrl || failed) {
    return (
      <span className={styles.serviceIconFallback} aria-hidden>
        {fallback}
      </span>
    );
  }

  return (
    <img
      className={styles.serviceIcon}
      src={iconUrl}
      alt={`${serviceName} icon`}
      onError={() => setFailed(true)}
    />
  );
}
