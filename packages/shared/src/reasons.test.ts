import { describe, expect, it } from "vitest";
import { REASON_CODES, RING_NAMES, explainReason, reasonFromIndex } from "./reasons";

describe("reasons", () => {
  it("keeps OK at index 0 and 7 rings", () => {
    expect(reasonFromIndex(0)).toBe("OK");
    expect(RING_NAMES).toHaveLength(7);
  });
  it("explains every code", () => {
    for (const c of REASON_CODES) expect(explainReason(c).length).toBeGreaterThan(0);
  });
});
