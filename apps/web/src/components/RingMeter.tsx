"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { RING_NAMES } from "@vyuh/shared";
import type { RingState } from "@/lib/rings";
import styles from "./RingMeter.module.css";

export interface RingMeterProps {
  /** Exactly seven states, ring 1 first. Missing entries render idle. */
  states: readonly RingState[];
  /** Per-ring detail for tooltips (e.g. the mandate limit). Enables keyboard-focusable tooltips. */
  details?: readonly string[];
  size?: "sm" | "lg";
  label?: string;
}

const WORD: Record<RingState, string> = { held: "held", blocked: "blocked", idle: "not reached" };

// A 270-degree arc on r=8: circumference 50.27, so dash 37.7 and gap 12.6.
function Arc({ state }: { state: RingState }) {
  return (
    <svg viewBox="0 0 24 24" className={`${styles.arc} ${styles[state]}`} aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="37.7 12.6" transform="rotate(135 12 12)" />
    </svg>
  );
}

export function RingMeter({ states, details, size = "sm", label = "Ring meter" }: RingMeterProps) {
  const all = RING_NAMES.map((name, i) => ({ name, n: i + 1, state: states[i] ?? "idle" }));
  const summary = `${label}: ${all.map((r) => `ring ${r.n} ${WORD[r.state]}`).join(", ")}.`;

  if (!details) {
    return (
      <span className={`${styles.meter} ${styles[size]}`} role="img" aria-label={summary}>
        {all.map((r) => (
          <Arc key={r.n} state={r.state} />
        ))}
      </span>
    );
  }

  return (
    <ul className={`${styles.meter} ${styles[size]}`} aria-label={label}>
      {all.map((r, i) => (
        <li key={r.n}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button type="button" className={styles.trigger} aria-label={`Ring ${r.n}, ${r.name}: ${WORD[r.state]}. ${details[i] ?? ""}`}>
                <Arc state={r.state} />
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className={styles.tip} sideOffset={6}>
                <strong>
                  {r.n}. {r.name}
                </strong>{" "}
                <span className={styles[r.state]}>{WORD[r.state]}</span>
                {details[i] ? <span className={styles.detail}>{details[i]}</span> : null}
                <Tooltip.Arrow className={styles.arrow} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </li>
      ))}
    </ul>
  );
}
