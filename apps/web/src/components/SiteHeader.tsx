"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/arena", label: "Arena" },
  { href: "/console", label: "Console" },
  { href: "/docs", label: "Docs" },
] as const;

/** Mark drawn inline so it follows the theme (brand/logo/vyuh-mark*.svg geometry). */
function Mark() {
  return (
    <svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true">
      <g fill="none" stroke="var(--vy-ring)" strokeWidth="6" strokeLinecap="round">
        <circle cx="32" cy="32" r="27" strokeDasharray="140 30" transform="rotate(-60 32 32)" />
        <circle cx="32" cy="32" r="16" strokeDasharray="80 20" transform="rotate(120 32 32)" />
      </g>
      <circle cx="32" cy="32" r="6" fill="var(--vy-core)" />
    </svg>
  );
}

export function SiteHeader() {
  const path = usePathname();
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Vyuh home">
          <Mark />
          <span className={styles.word}>vyuh</span>
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={styles.link} aria-current={path.startsWith(n.href) ? "page" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className={styles.tools}>
          <ThemeToggle />
          <ConnectButton
            showBalance={false}
            chainStatus={{ smallScreen: "none", largeScreen: "icon" }}
            accountStatus={{ smallScreen: "avatar", largeScreen: "address" }}
            label="Connect"
          />
        </div>
      </div>
    </header>
  );
}
