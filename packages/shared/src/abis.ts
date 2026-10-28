/**
 * Hand-written viem ABIs derived from docs/ARCHITECTURE.md, used until Foundry output exists.
 * ReasonCode is an enum, so it is `uint8` on the wire.
 * Views marked ASSUMED are not in ARCHITECTURE.md yet; contracts must expose them or these reads fail.
 */
export { erc20Abi } from "viem";

export const INTENT_COMPONENTS = [
  { name: "vault", type: "address" },
  { name: "tokenIn", type: "address" },
  { name: "tokenOut", type: "address" },
  { name: "amountIn", type: "uint256" },
  { name: "minAmountOut", type: "uint256" },
  { name: "fee", type: "uint24" },
  { name: "deadline", type: "uint64" },
  { name: "nonce", type: "uint256" },
  { name: "reasoningHash", type: "bytes32" },
] as const;

export const MANDATE_COMPONENTS = [
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
] as const;

export const mandateRegistryAbi = [
  {
    type: "function",
    name: "setMandate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "m", type: "tuple", components: MANDATE_COMPONENTS },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "tighten",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "m", type: "tuple", components: MANDATE_COMPONENTS },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getMandate",
    stateMutability: "view",
    inputs: [{ name: "vault", type: "address" }],
    outputs: [{ name: "", type: "tuple", components: MANDATE_COMPONENTS }],
  },
  {
    type: "event",
    name: "MandateSet",
    inputs: [
      { name: "vault", type: "address", indexed: true },
      { name: "mandateHash", type: "bytes32", indexed: false },
      { name: "version", type: "uint64", indexed: false },
      { name: "tightenedByAgent", type: "bool", indexed: false },
    ],
  },
] as const;

export const policyEngineAbi = [
  {
    type: "function",
    name: "checkIntent",
    stateMutability: "view",
    inputs: [{ name: "intent", type: "tuple", components: INTENT_COMPONENTS }],
    outputs: [
      { name: "code", type: "uint8" },
      { name: "ring", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "enforce",
    stateMutability: "view",
    inputs: [{ name: "intent", type: "tuple", components: INTENT_COMPONENTS }],
    outputs: [],
  },
  {
    type: "error",
    name: "PolicyViolation",
    inputs: [
      { name: "code", type: "uint8" },
      { name: "ring", type: "uint8" },
    ],
  },
] as const;

const view = <N extends string, T extends string>(name: N, type: T) =>
  ({
    type: "function",
    name,
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type }],
  }) as const;

export const vyuhVaultAbi = [
  {
    type: "function",
    name: "execute",
    stateMutability: "nonpayable",
    inputs: [{ name: "intent", type: "tuple", components: INTENT_COMPONENTS }],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "halt",
    stateMutability: "nonpayable",
    inputs: [{ name: "reason", type: "uint8" }],
    outputs: [],
  },
  { type: "function", name: "ownerHalt", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "resume", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  view("nav", "uint256"),
  // ASSUMED views (keeper and agent read these):
  view("owner", "address"),
  view("agent", "address"),
  view("halted", "bool"),
  view("nonce", "uint256"), // next expected intent nonce
  view("dayStartNav", "uint256"), // NAV at UTC day start
  {
    type: "event",
    name: "TradeExecuted",
    inputs: [
      { name: "vault", type: "address", indexed: true },
      { name: "intentHash", type: "bytes32", indexed: true },
      { name: "reasoningHash", type: "bytes32", indexed: false },
      { name: "tokenIn", type: "address", indexed: false },
      { name: "tokenOut", type: "address", indexed: false },
      { name: "amountIn", type: "uint256", indexed: false },
      { name: "amountOut", type: "uint256", indexed: false },
      { name: "navBefore", type: "uint256", indexed: false },
      { name: "navAfter", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Halted",
    inputs: [
      { name: "vault", type: "address", indexed: true },
      { name: "reason", type: "uint8", indexed: false },
      { name: "caller", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Resumed",
    inputs: [{ name: "vault", type: "address", indexed: true }],
  },
] as const;

export const arenaBountyAbi = [
  {
    type: "function",
    name: "recordAttempt",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attemptId", type: "bytes32" },
      { name: "attacker", type: "address" },
      { name: "promptHash", type: "bytes32" },
      { name: "intentHash", type: "bytes32" },
      { name: "code", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "payTier1",
    stateMutability: "nonpayable",
    inputs: [{ name: "attemptId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "event",
    name: "AttemptRecorded",
    inputs: [
      { name: "attemptId", type: "bytes32", indexed: true },
      { name: "attacker", type: "address", indexed: true },
      { name: "promptHash", type: "bytes32", indexed: false },
      { name: "intentHash", type: "bytes32", indexed: false },
      { name: "code", type: "uint8", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BountyPaid",
    inputs: [
      { name: "attemptId", type: "bytes32", indexed: true },
      { name: "attacker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;
