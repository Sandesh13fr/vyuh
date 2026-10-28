import { describe, expect, it, vi } from "vitest";
import type { Address, WalletClient } from "viem";
import { buildIntent, guardedSwap, hashReasoning, type ReadClient } from "./index";

const A = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const intent = buildIntent({
  vault: A(1),
  tokenIn: A(2),
  tokenOut: A(3),
  amountIn: 10n ** 18n,
  minAmountOut: 1n,
  nonce: 0n,
  reasoning: { why: "test" },
  now: 0,
});

const reader = (code: number, ring: number) =>
  ({ readContract: vi.fn().mockResolvedValue([code, ring]) }) as unknown as ReadClient;
const wallet = () =>
  ({ account: { address: A(9), type: "json-rpc" }, chain: undefined, writeContract: vi.fn().mockResolvedValue("0xabc") }) as unknown as WalletClient & {
    writeContract: ReturnType<typeof vi.fn>;
  };

describe("hashReasoning", () => {
  it("ignores key order and handles bigint", () => {
    const a = hashReasoning({ b: 1n, a: { y: [1, 2], x: "s" } });
    const b = hashReasoning({ a: { x: "s", y: [1, 2] }, b: 1n });
    expect(a).toBe(b);
    expect(a).not.toBe(hashReasoning({ a: { x: "s", y: [2, 1] }, b: 1n }));
  });
});

describe("guardedSwap", () => {
  it("refuses to send on a non-OK preflight", async () => {
    const w = wallet();
    const r = await guardedSwap(w, intent, { publicClient: reader(6, 2), policyEngine: A(5) });
    expect(r).toMatchObject({ sent: false, ok: false, code: "ALLOWLIST", ring: 2 });
    expect(w.writeContract).not.toHaveBeenCalled();
  });

  it("sends on OK", async () => {
    const w = wallet();
    const r = await guardedSwap(w, intent, { publicClient: reader(0, 0), policyEngine: A(5) });
    expect(r).toMatchObject({ sent: true, hash: "0xabc", code: "OK" });
    expect(w.writeContract).toHaveBeenCalledOnce();
  });
});
