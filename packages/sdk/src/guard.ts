import type { Address, Hex, PublicClient, WalletClient } from "viem";
import {
  explainReason,
  policyEngineAbi,
  reasonFromIndex,
  vyuhVaultAbi,
  type Intent,
  type ReasonCode,
} from "@vyuh/shared";

export interface PreflightResult {
  ok: boolean;
  code: ReasonCode;
  /** 1..7 for a ring failure, 0 for pre-ring checks or OK. */
  ring: number;
  explanation: string;
}

export type ReadClient = Pick<PublicClient, "readContract">;

/** Free eth_call to PolicyEngine.checkIntent. Mirrors the onchain check; never replaces it. */
export async function preflight(
  client: ReadClient,
  intent: Intent,
  policyEngine: Address,
): Promise<PreflightResult> {
  const [codeIdx, ring] = await client.readContract({
    address: policyEngine,
    abi: policyEngineAbi,
    functionName: "checkIntent",
    args: [intent],
  });
  const code = reasonFromIndex(codeIdx);
  return { ok: code === "OK", code, ring, explanation: explainReason(code) };
}

export type GuardedSwapResult = PreflightResult & ({ sent: false } | { sent: true; hash: Hex });

export interface GuardOptions {
  publicClient: ReadClient;
  policyEngine: Address;
}

/** Sends VyuhVault.execute only when preflight returns OK. Otherwise returns the reason, sends nothing. */
export async function guardedSwap(
  walletClient: WalletClient,
  intent: Intent,
  opts: GuardOptions,
): Promise<GuardedSwapResult> {
  const pf = await preflight(opts.publicClient, intent, opts.policyEngine);
  if (!pf.ok) return { ...pf, sent: false };
  const account = walletClient.account;
  if (!account) throw new Error("guardedSwap: walletClient has no account");
  const hash = await walletClient.writeContract({
    address: intent.vault,
    abi: vyuhVaultAbi,
    functionName: "execute",
    args: [intent],
    account,
    chain: walletClient.chain ?? null,
  });
  return { ...pf, sent: true, hash };
}
