import { describe, expect, it, vi } from "vitest";
import { isAddressEqual, type Address, type WalletClient } from "viem";
import { MAINNET } from "@vyuh/shared";
import { guardedSwap, type ReadClient } from "@vyuh/guard";
import { parseDecision } from "./decision";
import type { Market } from "./market";
import { proposeAndGuard } from "./runtime";

vi.mock("@vyuh/guard", async (orig) => {
  const mod = await orig<typeof import("@vyuh/guard")>();
  return { ...mod, guardedSwap: vi.fn(mod.guardedSwap) };
});

const ATTACKER = "0x000000000000000000000000000000000000dEaD" as Address;
const market: Market = {
  pool: MAINNET.whskUsdtPool,
  token0: MAINNET.whsk,
  token1: MAINNET.usdt,
  decimals0: 18,
  decimals1: 6,
  fee: 3000,
  sqrtPriceX96: 1n << 96n,
  oraclePrice: 50_000_000n,
  oracleDecimals: 8,
  oracleUpdatedAt: 0n,
};
const decision = (tokenOut: Address) => ({
  action: "sell",
  tokenIn: MAINNET.whsk,
  tokenOut,
  amountIn: "1000000000000000000",
  maxSlippageBps: 50,
  reasoning: "test",
});

// Fake chain: vault nonce 0, PolicyEngine enforces the allowlist ring like the contract.
const allow = [MAINNET.whsk, MAINNET.usdt];
const publicClient = {
  readContract: vi.fn(async ({ functionName, args }: { functionName: string; args?: [{ tokenOut: Address }] }) => {
    if (functionName === "nonce") return 0n;
    const ok = allow.some((a) => isAddressEqual(a, args![0].tokenOut));
    return ok ? [0, 0] : [6, 2];
  }),
} as unknown as ReadClient;
const walletClient = {
  account: { address: ATTACKER, type: "json-rpc" },
  writeContract: vi.fn().mockResolvedValue("0x01"),
} as unknown as WalletClient & { writeContract: ReturnType<typeof vi.fn> };
const deps = { publicClient, walletClient, vault: MAINNET.whsk, policyEngine: MAINNET.usdc, dryRun: false };

describe("decision validation", () => {
  it("accepts a well-formed decision and makes amountIn a bigint", () => {
    const r = parseDecision(decision(MAINNET.usdt));
    expect(r.success && r.data.amountIn).toBe(10n ** 18n);
  });
  it.each([
    { ...decision(MAINNET.usdt), action: "yolo" },
    { ...decision(MAINNET.usdt), tokenOut: "not-an-address" },
    { ...decision(MAINNET.usdt), amountIn: "-5" },
    { ...decision(MAINNET.usdt), amountIn: "1e18" },
    { ...decision(MAINNET.usdt), maxSlippageBps: 20_000 },
    { ...decision(MAINNET.usdt), reasoning: "" },
  ])("rejects malformed output %#", (raw) => {
    expect(parseDecision(raw).success).toBe(false);
  });
});

describe("proposeAndGuard", () => {
  it("never reaches guardedSwap when tokenOut is not allowlisted", async () => {
    const r = await proposeAndGuard(deps, market, decision(ATTACKER));
    expect(r).toMatchObject({ status: "blocked", code: "ALLOWLIST", ring: 2 });
    expect(guardedSwap).not.toHaveBeenCalled();
    expect(walletClient.writeContract).not.toHaveBeenCalled();
  });

  it("invalid LLM output never reaches guardedSwap", async () => {
    const r = await proposeAndGuard(deps, market, { action: "sell", tokenOut: ATTACKER });
    expect(r.status).toBe("invalid");
    expect(guardedSwap).not.toHaveBeenCalled();
  });

  it("sends an allowlisted trade through guardedSwap", async () => {
    const r = await proposeAndGuard(deps, market, decision(MAINNET.usdt));
    expect(r.status).toBe("sent");
    expect(guardedSwap).toHaveBeenCalledOnce();
  });
});
