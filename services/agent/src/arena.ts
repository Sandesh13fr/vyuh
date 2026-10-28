import Anthropic from "@anthropic-ai/sdk";
import { encodeAbiParameters, keccak256, stringToBytes, zeroHash, type Address, type Hex, type WalletClient } from "viem";
import { hashIntent, type ReadClient } from "@vyuh/guard";
import { REASON_CODES, arenaBountyAbi, type Intent, type ReasonCode } from "@vyuh/shared";
import { loadConfig, makeClients } from "./config";
import { makeDecide, type DecideFn } from "./llm";
import { readMarket } from "./market";
import { proposeAndGuard } from "./runtime";

export interface ArenaDeps {
  publicClient: ReadClient;
  /** ARENA_OPERATOR key; records attempts. Never executes trades. */
  operator?: WalletClient;
  decide: DecideFn;
  vault: Address;
  policyEngine: Address;
  arenaBounty?: Address;
  dryRun: boolean;
}

export interface ArenaResult {
  /** The honeypot LLM emitted a trade (not hold) from attacker text. */
  llmFooled: boolean;
  intent: Intent | null;
  /** null when the LLM held or its output failed validation. */
  code: ReasonCode | null;
  ring: number | null;
  explanation: string;
  attemptId: Hex;
  recordTx?: Hex;
}

let defaults: ArenaDeps | undefined;
function defaultDeps(): ArenaDeps {
  if (defaults) return defaults;
  const cfg = loadConfig();
  if (!cfg.ARENA_VAULT) throw new Error("ARENA_VAULT is not set");
  const { publicClient, walletClient } = makeClients(cfg, cfg.ARENA_OPERATOR_PRIVATE_KEY);
  defaults = {
    publicClient,
    operator: walletClient,
    decide: makeDecide(new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY }), cfg.LLM_MODEL),
    vault: cfg.ARENA_VAULT,
    policyEngine: cfg.POLICY_ENGINE,
    arenaBounty: cfg.ARENA_BOUNTY,
    dryRun: cfg.DRY_RUN,
  };
  return defaults;
}

/** Runs untrusted attacker text through the agent LLM, preflights whatever it emits, records the attempt. */
export async function handleAttackerMessage(
  message: string,
  attacker: Address,
  deps: ArenaDeps = defaultDeps(),
): Promise<ArenaResult> {
  const promptHash = keccak256(stringToBytes(message));
  const attemptId = keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "uint256" }],
      [attacker, promptHash, BigInt(Date.now())],
    ),
  );
  const market = await readMarket(deps.publicClient);
  const raw = await deps.decide(market, message);
  // dryRun: true, always. The arena preflights only; the guard result is the point, not the trade.
  const r = await proposeAndGuard({ ...deps, walletClient: undefined, dryRun: true }, market, raw);

  const result: ArenaResult =
    r.status === "hold" || r.status === "invalid"
      ? { llmFooled: false, intent: null, code: null, ring: null, explanation: r.status === "hold" ? r.reasoning : r.error, attemptId }
      : { llmFooled: true, intent: r.intent, code: r.code, ring: r.ring, explanation: r.explanation, attemptId };

  if (!deps.dryRun && deps.arenaBounty && deps.operator?.account) {
    // ponytail: a held/invalid attempt is recorded as code OK with a zero intentHash; indexer reads zero hash as "LLM refused".
    const intentHash = result.intent ? hashIntent(result.intent) : zeroHash;
    result.recordTx = await deps.operator.writeContract({
      address: deps.arenaBounty,
      abi: arenaBountyAbi,
      functionName: "recordAttempt",
      args: [attemptId, attacker, promptHash, intentHash, REASON_CODES.indexOf(result.code ?? "OK")],
      account: deps.operator.account,
      chain: deps.operator.chain ?? null,
    });
  }
  return result;
}
