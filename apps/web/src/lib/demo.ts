/**
 * DEMO DATA. Invented values shown only when the indexer is unreachable. Every surface that
 * renders these must show the "demo data" badge (see Sourced.demo in api.ts).
 */
import { zeroHash, type Address, type Hex } from "viem";
import { MAINNET, type ReasonCode } from "@vyuh/shared";
import type { Attempt, Receipt, VaultView } from "./api";

const E18 = 10n ** 18n;
const E6 = 10n ** 6n;
const NOW = 1_793_000_000n; // fixed so server and client render the same demo rows

const fakeHex = (seed: number, bytes = 32): Hex =>
  `0x${seed.toString(16).padStart(4, "0").repeat(bytes).slice(0, bytes * 2)}` as Hex;
const fakeAddr = (seed: number): Address => fakeHex(seed, 20) as Address;

export const DEMO_VAULT_ADDRESS = fakeAddr(0xd3);

export function demoVault(address: Address = DEMO_VAULT_ADDRESS): VaultView {
  return {
    address,
    owner: fakeAddr(0x0a),
    agent: fakeAddr(0xa6),
    status: "active",
    haltReason: null,
    nav: 25_310n * E18 + 42n * 10n ** 16n,
    pnl: 310n * E18 + 42n * 10n ** 16n,
    tradeCount: 4,
    lastTradeAt: NOW - 540n,
    mandate: {
      version: 3n,
      tightenedByAgent: false,
      maxTradeUsd: 500n * E18,
      maxPositionUsd: 5_000n * E18,
      maxSlippageBps: 50,
      oracleBandBps: 150,
      dailyLossBps: 300,
      cooldownSecs: 300,
      minKycLevel: 1,
      expiry: NOW + 30n * 86_400n,
      allowedTokens: [MAINNET.whsk, MAINNET.usdt],
    },
  };
}

function receipt(i: number, buy: boolean, amountIn: bigint, amountOut: bigint, navDelta: bigint): Receipt {
  return {
    id: `demo-${i}`,
    intentHash: fakeHex(0x1000 + i),
    reasoningHash: fakeHex(0x2000 + i),
    tokenIn: buy ? MAINNET.usdt : MAINNET.whsk,
    tokenOut: buy ? MAINNET.whsk : MAINNET.usdt,
    amountIn,
    amountOut,
    navBefore: 25_000n * E18,
    navAfter: 25_000n * E18 + navDelta,
    txHash: fakeHex(0x3000 + i),
    blockNumber: 4_200_000n - BigInt(i) * 900n,
    timestamp: NOW - BigInt(i) * 1_800n - 540n,
  };
}

export const DEMO_RECEIPTS: Receipt[] = [
  receipt(0, true, 250n * E6, 512n * E18, 120n * E18),
  receipt(1, false, 300n * E18, 148n * E6, 90n * E18),
  receipt(2, true, 400n * E6, 820n * E18, 64n * E18),
  receipt(3, false, 120n * E18, 59n * E6, 36n * E18),
];

function attempt(i: number, code: ReasonCode, refused = false): Attempt {
  return {
    attemptId: fakeHex(0x4000 + i),
    attacker: fakeAddr(0x5000 + i * 7),
    promptHash: fakeHex(0x6000 + i),
    intentHash: refused ? zeroHash : fakeHex(0x7000 + i),
    code,
    llmRefused: refused,
    paid: false,
    txHash: null,
    timestamp: NOW - BigInt(i) * 95n - 20n,
  };
}

export const DEMO_ATTEMPTS: Attempt[] = [
  attempt(0, "ORACLE_BAND"),
  attempt(1, "SPEND_CAP"),
  attempt(2, "OK", true),
  attempt(3, "ALLOWLIST"),
  attempt(4, "SLIPPAGE"),
  attempt(5, "SPEND_CAP"),
  attempt(6, "COOLDOWN"),
  attempt(7, "OK", true),
  attempt(8, "ORACLE_BAND"),
  attempt(9, "DAILY_LOSS"),
];
