"use client";

import type { ReasonCode } from "@vyuh/shared";
import { useEffect, useState } from "react";
import { ringForCode, verdict } from "@/lib/rings";
import { RingEmblem } from "./RingEmblem";
import styles from "./AttackLoop.module.css";

export interface AttackLoopProps {
  /** Recent reason codes, newest first. Only codes that map to a ring are replayed. */
  codes: readonly ReasonCode[];
  demo: boolean;
}

const FALLBACK: ReasonCode[] = ["ORACLE_BAND", "SPEND_CAP", "SLIPPAGE", "ALLOWLIST"];

/** Replays recent attacks on the emblem. Under reduced motion it shows the latest one, still. */
export function AttackLoop({ codes, demo }: AttackLoopProps) {
  const ringed = codes.filter((c) => ringForCode(c) !== null).slice(0, 8);
  const list = ringed.length > 0 ? ringed : FALLBACK;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % list.length), 3200);
    return () => window.clearInterval(id);
  }, [list.length]);

  const code = list[i % list.length] ?? "SPEND_CAP";
  const ring = ringForCode(code);

  return (
    <figure className={styles.figure}>
      <RingEmblem blockedRing={ring} animateAttack attackKey={i} size={360} />
      <figcaption className={styles.caption} aria-live="polite">
        <span className="mono">{code}</span> {verdict(code, ring)}
        {(demo || ringed.length === 0) && <span className="demo-badge">demo data</span>}
      </figcaption>
    </figure>
  );
}
