import { describe, expect, it } from "vitest";
import { haltReason, type VaultState } from "./decide";

const healthy: VaultState = {
  halted: false,
  now: 10_000n,
  oracleUpdatedAt: 9_900n,
  maxOracleAgeSecs: 3_600n,
  nav: 1_000n,
  dayStartNav: 1_000n,
  dailyLossBps: 500,
  kycLevel: 2,
  minKycLevel: 1,
};

describe("haltReason", () => {
  it("does nothing for a healthy vault", () => expect(haltReason(healthy)).toBeNull());
  it("does nothing for an already halted vault", () =>
    expect(haltReason({ ...healthy, halted: true, oracleUpdatedAt: 0n })).toBeNull());
  it("halts on a stale oracle", () => expect(haltReason({ ...healthy, oracleUpdatedAt: 6_399n })).toBe("ORACLE_STALE"));
  it("allows an oracle exactly at max age", () => expect(haltReason({ ...healthy, oracleUpdatedAt: 6_400n })).toBeNull());
  it("halts at the daily loss limit, not below", () => {
    expect(haltReason({ ...healthy, nav: 951n })).toBeNull();
    expect(haltReason({ ...healthy, nav: 950n })).toBe("DAILY_LOSS");
  });
  it("ignores gains", () => expect(haltReason({ ...healthy, nav: 2_000n })).toBeNull());
  it("halts when KYC drops below the mandate", () => expect(haltReason({ ...healthy, kycLevel: 0 })).toBe("KYC_TIER"));
  it("skips KYC when no SBT is configured", () =>
    expect(haltReason({ ...healthy, kycLevel: null, minKycLevel: 4 })).toBeNull());
  it("reports the oracle first when several fail", () =>
    expect(haltReason({ ...healthy, oracleUpdatedAt: 0n, nav: 0n, kycLevel: 0 })).toBe("ORACLE_STALE"));
});
