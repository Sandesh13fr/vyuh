/** Mirrors `enum ReasonCode` in contracts/src/types/VyuhTypes.sol. Order must match exactly. */
export const REASON_CODES = [
  "OK",
  "HALTED",
  "NOT_AGENT",
  "EXPIRED",
  "BAD_NONCE",
  "SPEND_CAP",
  "ALLOWLIST",
  "ORACLE_BAND",
  "ORACLE_STALE",
  "SLIPPAGE",
  "DAILY_LOSS",
  "KYC_TIER",
  "COOLDOWN",
  "POSITION_CAP",
] as const;

export type ReasonCode = (typeof REASON_CODES)[number];

export const RING_NAMES = [
  "Spend cap",
  "Allowlist",
  "Oracle band",
  "Slippage",
  "Daily loss",
  "KYC tier",
  "Cooldown",
] as const;

const EXPLAIN: Record<ReasonCode, string> = {
  OK: "Passed all seven rings.",
  HALTED: "Vault is halted. Only the owner can resume it.",
  NOT_AGENT: "Caller is not the vault's registered agent.",
  EXPIRED: "Mandate or intent deadline has passed.",
  BAD_NONCE: "Intent nonce already used or out of order.",
  SPEND_CAP: "Trade size is above the per-trade cap.",
  ALLOWLIST: "Token is not on the mandate allowlist.",
  ORACLE_BAND: "Trade price is too far from the oracle price.",
  ORACLE_STALE: "Oracle price is stale, so trading is paused.",
  SLIPPAGE: "Minimum output allows more slippage than the mandate.",
  DAILY_LOSS: "Daily loss limit reached. Vault halts until tomorrow or owner resumes.",
  KYC_TIER: "Owner's KYC level is below the mandate minimum.",
  COOLDOWN: "Too soon after the last trade.",
  POSITION_CAP: "Trade would push the position above its cap.",
};

export function reasonFromIndex(i: number): ReasonCode {
  const r = REASON_CODES[i];
  if (!r) throw new Error(`Unknown reason code ${i}`);
  return r;
}

export function explainReason(code: ReasonCode): string {
  return EXPLAIN[code];
}
