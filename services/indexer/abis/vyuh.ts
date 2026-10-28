import { parseAbi } from "viem";

// ponytail: local event ABIs until @vyuh/shared exports generated ones (abis.ts).
// Signatures follow docs/ARCHITECTURE.md; ReasonCode enums are uint8 on the wire.

/** Assumed factory event (not yet in ARCHITECTURE.md). */
export const vaultFactoryAbi = parseAbi([
  "event VaultCreated(address indexed vault, address indexed owner, address indexed agent)",
]);

export const vyuhVaultAbi = parseAbi([
  "event TradeExecuted(address indexed vault, bytes32 indexed intentHash, bytes32 reasoningHash, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 navBefore, uint256 navAfter)",
  "event Halted(address indexed vault, uint8 reason, address caller)",
  "event Resumed(address indexed vault)",
]);

export const mandateRegistryAbi = parseAbi([
  "struct Mandate { address owner; address agent; uint256 maxTradeUsd; uint256 maxPositionUsd; uint16 maxSlippageBps; uint16 oracleBandBps; uint16 dailyLossBps; uint32 cooldownSecs; uint8 minKycLevel; uint64 expiry; uint64 version; address[] allowedTokens; }",
  "event MandateSet(address indexed vault, bytes32 mandateHash, uint64 version, bool tightenedByAgent)",
  "function getMandate(address vault) view returns (Mandate)",
]);

export const arenaBountyAbi = parseAbi([
  "event AttemptRecorded(bytes32 indexed attemptId, address indexed attacker, bytes32 promptHash, bytes32 intentHash, uint8 code)",
  "event BountyPaid(bytes32 indexed attemptId, address indexed attacker, uint256 amount)",
]);
