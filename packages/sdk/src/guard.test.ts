import { describe, expect, it, vi } from "vitest";
import { ContractFunctionExecutionError, ContractFunctionRevertedError, encodeErrorResult, type Address, type WalletClient } from "viem";
import { policyEngineAbi } from "@vyuh/shared";
import { buildIntent, guardedSwap, hashReasoning, preflight, type ReadClient } from "./index";

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
  ({
    readContract: vi.fn(async ({ functionName }: { functionName: string }) =>
      functionName === "agent" ? A(9) : [code, ring],
    ),
  }) as unknown as ReadClient;
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

  it("decodes a PolicyViolation revert from checkIntent as blocked", async () => {
    const data = encodeErrorResult({ abi: policyEngineAbi, errorName: "PolicyViolation", args: [8, 3] }); // ORACLE_STALE, ring 3
    const reverted = new ContractFunctionRevertedError({ abi: policyEngineAbi, data, functionName: "checkIntent" });
    const err = new ContractFunctionExecutionError(reverted, {
      abi: policyEngineAbi,
      functionName: "checkIntent",
      args: [intent],
      contractAddress: A(5),
    });
    const client = { readContract: vi.fn().mockRejectedValue(err) } as unknown as ReadClient;
    const w = wallet();
    const r = await guardedSwap(w, intent, { publicClient: client, policyEngine: A(5) });
    expect(r).toMatchObject({ sent: false, ok: false, code: "ORACLE_STALE", ring: 3 });
    expect(w.writeContract).not.toHaveBeenCalled();
  });

  it("fails closed on an unknown revert", async () => {
    const client = { readContract: vi.fn().mockRejectedValue(new Error("rpc down")) } as unknown as ReadClient;
    const w = wallet();
    await expect(guardedSwap(w, intent, { publicClient: client, policyEngine: A(5) })).rejects.toThrow("rpc down");
    expect(w.writeContract).not.toHaveBeenCalled();
  });

  it("rejects same-token intents before any call", async () => {
    const w = wallet();
    await expect(
      guardedSwap(w, { ...intent, tokenOut: intent.tokenIn }, { publicClient: reader(0, 0), policyEngine: A(5) }),
    ).rejects.toThrow("must differ");
  });

  it("preflights as the vault agent when no account is given", async () => {
    const r = reader(0, 0);
    const res = await preflight(r, intent, A(5));
    expect(res.ok).toBe(true);
    const calls = (r.readContract as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls[0]).toMatchObject({ address: intent.vault, functionName: "agent" });
    expect(calls[1]).toMatchObject({ functionName: "checkIntent", account: A(9) });
  });
});
