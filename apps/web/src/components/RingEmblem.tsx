import type { CSSProperties } from "react";
import { ringName } from "@/lib/rings";
import styles from "./RingEmblem.module.css";

/** Geometry from brand/logo/vyuh-emblem.svg. Index 0 is ring 1 (outermost); intents travel inward. */
const RINGS = [
  { r: 138, dash: "760 107", rotate: 0 },
  { r: 120, dash: "80 30 560 84", rotate: 40 },
  { r: 102, dash: "560 81", rotate: 0 },
  { r: 84, dash: "460 68", rotate: 120 },
  { r: 66, dash: "360 55", rotate: 200 },
  { r: 48, dash: "260 42", rotate: 280 },
  { r: 30, dash: "160 28", rotate: 10 },
] as const;

export interface RingEmblemProps {
  /** Ring (1..7) currently deciding; drawn in the ring color. */
  activeRing?: number | null;
  /** Ring (1..7) that stopped the attack; flashes blocked. */
  blockedRing?: number | null;
  /** Play the attack dot travelling inward to the blocked ring. Change `attackKey` to replay. */
  animateAttack?: boolean;
  attackKey?: string | number;
  size?: number;
  className?: string;
}

export function RingEmblem({
  activeRing = null,
  blockedRing = null,
  animateAttack = false,
  attackKey,
  size = 300,
  className,
}: RingEmblemProps) {
  const blocked = blockedRing && RINGS[blockedRing - 1] ? blockedRing : null;
  const label = blocked
    ? `Seven rings. Blocked at ring ${blocked}, ${ringName(blocked)}.`
    : activeRing
      ? `Seven rings. Ring ${activeRing}, ${ringName(activeRing)}, is deciding.`
      : "Seven rings around the core. All holding.";
  // The dot stops on the outer edge of the ring that held.
  const stop = blocked ? -(RINGS[blocked - 1]!.r + 9) : 0;
  const animate = animateAttack && blocked !== null;

  return (
    <svg
      key={attackKey}
      className={[styles.emblem, animate && styles.animate, className].filter(Boolean).join(" ")}
      viewBox="0 0 300 300"
      width={size}
      height={size}
      role="img"
      aria-label={label}
    >
      <g transform="translate(150 150)" fill="none" strokeWidth={9} strokeLinecap="round">
        {RINGS.map((ring, i) => {
          const n = i + 1;
          const state = n === blocked ? styles.blocked : n === activeRing ? styles.active : styles.idle;
          return (
            <circle
              key={n}
              className={`${styles.ring} ${state}`}
              r={ring.r}
              strokeDasharray={ring.dash}
              transform={ring.rotate ? `rotate(${ring.rotate})` : undefined}
            />
          );
        })}
        <circle className={styles.core} r={14} />
        {animate && <circle className={styles.dot} r={6} style={{ "--vy-stop": `${stop}px` } as CSSProperties} />}
      </g>
    </svg>
  );
}
