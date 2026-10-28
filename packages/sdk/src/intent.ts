import { encodeAbiParameters, keccak256, stringToBytes, type Address, type Hex } from "viem";
import { INTENT_COMPONENTS, type Intent } from "@vyuh/shared";

/** Sorted keys, no whitespace, bigints as decimal strings, undefined keys dropped. Same input, same bytes. */
export function canonicalJson(v: unknown): string {
  if (typeof v === "bigint") return JSON.stringify(v.toString());
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}

/** keccak256 of the canonical JSON of the agent's reasoning. Goes onchain as `reasoningHash`. */
export function hashReasoning(json: unknown): Hex {
  return keccak256(stringToBytes(canonicalJson(json)));
}

export interface BuildIntentParams {
  vault: Address;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  nonce: bigint;
  /** Reasoning object; hashed with hashReasoning. */
  reasoning: unknown;
  /** V3 pool fee tier, default 3000. */
  fee?: number;
  /** Seconds until the intent expires, default 300. */
  ttlSecs?: number;
  /** Clock in ms, for tests. */
  now?: number;
}

export function buildIntent(p: BuildIntentParams): Intent {
  const nowSecs = Math.floor((p.now ?? Date.now()) / 1000);
  return {
    vault: p.vault,
    tokenIn: p.tokenIn,
    tokenOut: p.tokenOut,
    amountIn: p.amountIn,
    minAmountOut: p.minAmountOut,
    fee: p.fee ?? 3000,
    deadline: BigInt(nowSecs + (p.ttlSecs ?? 300)),
    nonce: p.nonce,
    reasoningHash: hashReasoning(p.reasoning),
  };
}

/** keccak256(abi.encode(intent)). Matches the contract only if it hashes the same way; used for arena records. */
export function hashIntent(intent: Intent): Hex {
  return keccak256(encodeAbiParameters([{ type: "tuple", components: INTENT_COMPONENTS }], [intent]));
}
