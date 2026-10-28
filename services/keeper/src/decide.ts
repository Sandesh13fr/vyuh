import type { ReasonCode } from "@vyuh/shared";

export interface VaultState {
  halted: boolean;
  /** Block timestamp, seconds. */
  now: bigint;
  oracleUpdatedAt: bigint;
  maxOracleAgeSecs: bigint;
  nav: bigint;
  dayStartNav: bigint;
  dailyLossBps: number;
  /** null when no KYC SBT is configured (mainnet allowlist fallback). */
  kycLevel: number | null;
  minKycLevel: number;
}

/** Halt reason the keeper believes holds, or null. The onchain halt() simulation is the final word. */
export function haltReason(s: VaultState): ReasonCode | null {
  if (s.halted) return null;
  if (s.now - s.oracleUpdatedAt > s.maxOracleAgeSecs) return "ORACLE_STALE";
  // DailyLossPolicy passes while drop < dailyLossBps, so drop >= limit halts.
  if (s.dayStartNav > 0n && (s.dayStartNav - s.nav) * 10_000n >= BigInt(s.dailyLossBps) * s.dayStartNav)
    return "DAILY_LOSS";
  if (s.kycLevel !== null && s.kycLevel < s.minKycLevel) return "KYC_TIER";
  return null;
}
