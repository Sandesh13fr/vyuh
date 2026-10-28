import { describe, expect, it } from "vitest";
import { explainRejection, formatPreflight, minOutFor, parseReason, spotAmountOut } from "./pure";

describe("parseReason", () => {
  it("accepts names, indexes and any case", () => {
    expect(parseReason("slippage")).toBe("SLIPPAGE");
    expect(parseReason(5)).toBe("SPEND_CAP");
    expect(parseReason("0")).toBe("OK");
    expect(() => parseReason("NOPE")).toThrow(/Unknown ReasonCode/);
    expect(() => parseReason(99)).toThrow();
  });
});

describe("formatPreflight", () => {
  it("names the ring and says it was not sent when blocked", () => {
    const text = formatPreflight({
      code: "SPEND_CAP",
      ring: 1,
      submission: { status: "skipped", why: "policy rejected the intent" },
    });
    expect(text).toBe(
      "Preflight BLOCKED. SPEND_CAP at ring 1 (Spend cap): Trade size is above the per-trade cap.\n" +
        "Not submitted: policy rejected the intent",
    );
  });
  it("reports the tx hash on pass", () => {
    const text = formatPreflight({ code: "OK", ring: 0, submission: { status: "submitted", txHash: "0xabc" } });
    expect(text).toContain("Preflight PASS. OK: Passed all seven rings.");
    expect(text).toContain("0xabc");
  });
  it("labels pre-ring checks", () => {
    expect(explainRejection("HALTED", 0)).toBe("HALTED at pre-ring vault check: Vault is halted. Only the owner can resume it.");
  });
});

describe("spot quote", () => {
  it("price 1 (sqrtP = 2^96) with 0.3% fee and 50 bps slippage", () => {
    const q = spotAmountOut(1_000_000n, 1n << 96n, true, 3000);
    expect(q).toBe(997_000n);
    expect(spotAmountOut(1_000_000n, 1n << 96n, false, 3000)).toBe(997_000n);
    expect(minOutFor(q, 50)).toBe(992_015n);
  });
  it("price 4 (sqrtP = 2 * 2^96): token0 -> token1 multiplies, reverse divides", () => {
    expect(spotAmountOut(1000n, 2n << 96n, true, 0)).toBe(4000n);
    expect(spotAmountOut(1000n, 2n << 96n, false, 0)).toBe(250n);
  });
});
