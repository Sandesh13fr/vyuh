import { RING_NAMES, explainReason, type ReasonCode } from "@vyuh/shared";

export type RingState = "held" | "blocked" | "idle";

/** Ring number (1..7) per docs/ARCHITECTURE.md ring table. Pre-ring codes have no ring. */
const RING_OF: Partial<Record<ReasonCode, number>> = {
  SPEND_CAP: 1,
  ALLOWLIST: 2,
  ORACLE_BAND: 3,
  ORACLE_STALE: 3,
  SLIPPAGE: 4,
  DAILY_LOSS: 5,
  KYC_TIER: 6,
  COOLDOWN: 7,
};

export function ringForCode(code: ReasonCode): number | null {
  return RING_OF[code] ?? null;
}

export function ringName(ring: number): string {
  return RING_NAMES[ring - 1] ?? `Ring ${ring}`;
}

/** Rings outside the blocking ring held, the blocking ring failed, inner rings never ran. */
export function meterStates(blockedRing: number | null, passed = false): RingState[] {
  return Array.from({ length: 7 }, (_, i): RingState => {
    const ring = i + 1;
    if (passed) return "held";
    if (blockedRing === null) return "idle";
    if (ring < blockedRing) return "held";
    return ring === blockedRing ? "blocked" : "idle";
  });
}

/** Voice per DESIGN.md: name the ring and the reason. */
export function verdict(code: ReasonCode, ring: number | null): string {
  if (code === "OK") return "Passed all seven rings.";
  const why = explainReason(code);
  if (ring && ring >= 1 && ring <= 7) return `Blocked at ring ${ring}, ${ringName(ring)}: ${why}`;
  return `Stopped before the rings: ${why}`;
}
