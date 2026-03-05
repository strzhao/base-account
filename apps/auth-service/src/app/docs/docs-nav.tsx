"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./docs.module.css";

const tabs = [
  { href: "/docs" as const, label: "Overview" },
  { href: "/docs/auth" as const, label: "Auth API" },
  { href: "/docs/invitation-codes" as const, label: "Invitation Codes" },
  { href: "/docs/machine-spec" as const, label: "Machine Spec" }
];

export function DocsNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav}>
      {tabs.map((tab) => {
        const active = tab.href === "/docs" ? pathname === "/docs" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? styles.navLinkActive : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
