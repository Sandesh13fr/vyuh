import { REASON_CODES, RING_NAMES, explainReason, type ReasonCode } from "@vyuh/shared";

/** Accepts a ReasonCode name ("SLIPPAGE") or its enum index ("9" / 9). */
export function parseReason(input: string | number): ReasonCode {
  const s = String(input).trim().toUpperCase();
  const byIndex = /^\d+$/.test(s) ? REASON_CODES[Number(s)] : undefined;
  const code = byIndex ?? REASON_CODES.find((c) => c === s);
  if (!code) throw new Error(`Unknown ReasonCode "${input}". Valid: ${REASON_CODES.join(", ")}`);
  return code;
}

/** Ring is 1..7 for policy modules; 0 means a pre-ring vault check (or OK). */
export function ringLabel(ring: number): string {
  const name = RING_NAMES[ring - 1];
  return name ? `ring ${ring} (${name})` : "pre-ring vault check";
}

export function explainRejection(code: ReasonCode, ring = 0): string {
  if (code === "OK") return `OK: ${explainReason(code)}`;
  return `${code} at ${ringLabel(ring)}: ${explainReason(code)}`;
}

export type Submission =
  | { status: "submitted"; txHash: string }
  | { status: "skipped"; why: string };

/** Plain-words preflight verdict, as required by ARCHITECTURE.md for propose_trade. */
export function formatPreflight(r: { code: ReasonCode; ring: number; submission: Submission }): string {
  const verdict = r.code === "OK" ? "PASS" : "BLOCKED";
  const sub =
    r.submission.status === "submitted"
      ? `Submitted VyuhVault.execute: ${r.submission.txHash}`
      : `Not submitted: ${r.submission.why}`;
  return [`Preflight ${verdict}. ${explainRejection(r.code, r.ring)}`, sub].join("\n");
}

const Q192 = 1n << 192n;

/**
 * Spot V3 quote from slot0, after the pool fee, before price impact.
 * Raw token units in and out; fee in hundredths of a bip (3000 = 0.3%).
 */
export function spotAmountOut(amountIn: bigint, sqrtPriceX96: bigint, zeroForOne: boolean, fee: number): bigint {
  const afterFee = (amountIn * BigInt(1_000_000 - fee)) / 1_000_000n;
  const p = sqrtPriceX96 * sqrtPriceX96;
  return zeroForOne ? (afterFee * p) / Q192 : (afterFee * Q192) / p;
}

export const minOutFor = (quote: bigint, slippageBps: number) => (quote * BigInt(10_000 - slippageBps)) / 10_000n;

/** JSON with bigint as decimal strings, for tool output. */
export const toJson = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x), 2);
