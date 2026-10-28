import type { Address, Hex, WalletClient } from "viem";
import { guardedSwap, preflight, type ReadClient } from "@vyuh/guard";
import { vyuhVaultAbi, type Intent, type ReasonCode } from "@vyuh/shared";
import { decisionToIntent, parseDecision } from "./decision";
import type { Market } from "./market";

export interface GuardDeps {
  publicClient: ReadClient;
  walletClient?: WalletClient;
  vault: Address;
  policyEngine: Address;
  dryRun: boolean;
}

export type StepResult =
  | { status: "hold"; reasoning: string }
  | { status: "invalid"; error: string }
  | {
      status: "blocked" | "dry-run" | "sent";
      intent: Intent;
      reasoning: unknown;
      code: ReasonCode;
      ring: number;
      explanation: string;
      hash?: Hex;
    };

/** raw LLM output -> zod -> intent -> preflight -> guardedSwap. Non-OK never reaches guardedSwap. */
export async function proposeAndGuard(d: GuardDeps, market: Market, raw: unknown): Promise<StepResult> {
  const parsed = parseDecision(raw);
  if (!parsed.success) return { status: "invalid", error: parsed.error.message };
  const decision = parsed.data;
  if (decision.action === "hold") return { status: "hold", reasoning: decision.reasoning };

  const nonce = await d.publicClient.readContract({ address: d.vault, abi: vyuhVaultAbi, functionName: "nonce" });
  const intent = decisionToIntent(decision, { vault: d.vault, nonce, market });
  const base = { intent, reasoning: decision };

  const pf = await preflight(d.publicClient, intent, d.policyEngine);
  if (!pf.ok) return { status: "blocked", ...base, ...pf };
  if (d.dryRun || !d.walletClient) return { status: "dry-run", ...base, ...pf };

  // guardedSwap preflights again: state can change between the two calls.
  const r = await guardedSwap(d.walletClient, intent, { publicClient: d.publicClient, policyEngine: d.policyEngine });
  return r.sent ? { status: "sent", ...base, ...r } : { status: "blocked", ...base, ...r };
}
