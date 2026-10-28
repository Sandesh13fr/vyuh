import type { Address, Hex } from "viem";

/** Mirrors `struct Mandate`. Amounts in 1e18 USD. */
export interface Mandate {
  owner: Address;
  agent: Address;
  maxTradeUsd: bigint;
  maxPositionUsd: bigint;
  maxSlippageBps: number;
  oracleBandBps: number;
  dailyLossBps: number;
  cooldownSecs: number;
  minKycLevel: number;
  expiry: bigint;
  version: bigint;
  allowedTokens: Address[];
}

/** Mirrors `struct Intent`. */
export interface Intent {
  vault: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  fee: number;
  deadline: bigint;
  nonce: bigint;
  reasoningHash: Hex;
}

export const EIP712_DOMAIN_NAME = "Vyuh";
export const EIP712_DOMAIN_VERSION = "1";

export const MANDATE_TYPES = {
  Mandate: [
    { name: "owner", type: "address" },
    { name: "agent", type: "address" },
    { name: "maxTradeUsd", type: "uint256" },
    { name: "maxPositionUsd", type: "uint256" },
    { name: "maxSlippageBps", type: "uint16" },
    { name: "oracleBandBps", type: "uint16" },
    { name: "dailyLossBps", type: "uint16" },
    { name: "cooldownSecs", type: "uint32" },
    { name: "minKycLevel", type: "uint8" },
    { name: "expiry", type: "uint64" },
    { name: "version", type: "uint64" },
    { name: "allowedTokens", type: "address[]" },
  ],
} as const;
