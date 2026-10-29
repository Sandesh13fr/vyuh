import { BaseError, ContractFunctionRevertedError, type Address, type Hex, type PublicClient, type WalletClient } from "viem";
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

const result = (codeIdx: number, ring: number): PreflightResult => {
  const code = reasonFromIndex(codeIdx);
  return { ok: code === "OK", code, ring, explanation: explainReason(code) };
};

/**
 * Free eth_call to PolicyEngine.checkIntent. Mirrors the onchain check; never replaces it.
 * checkIntent can revert with PolicyViolation (e.g. a stale oracle inside nav()); that is decoded into a
 * blocked result. Any other revert is rethrown so callers fail closed.
 */
export async function preflight(
  client: ReadClient,
  intent: Intent,
  policyEngine: Address,
  /** eth_call `from`. checkIntent requires msg.sender == vault agent; defaults to the vault's agent. */
  account?: Address,
): Promise<PreflightResult> {
  if (intent.tokenIn.toLowerCase() === intent.tokenOut.toLowerCase()) {
    throw new Error("preflight: tokenIn and tokenOut must differ (the vault rejects same-token intents)");
  }
  const from =
    account ??
    (await client.readContract({ address: intent.vault, abi: vyuhVaultAbi, functionName: "agent" }));
  try {
    const [codeIdx, ring] = await client.readContract({
      address: policyEngine,
      abi: policyEngineAbi,
      functionName: "checkIntent",
      args: [intent],
      account: from,
    });
    return result(codeIdx, ring);
  } catch (err) {
    const reverted =
      err instanceof BaseError ? err.walk((e) => e instanceof ContractFunctionRevertedError) : null;
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName === "PolicyViolation") {
      const [codeIdx, ring] = reverted.data.args as readonly [number, number];
      return result(Number(codeIdx), Number(ring));
    }
    throw err;
  }
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
  const account = walletClient.account;
  if (!account) throw new Error("guardedSwap: walletClient has no account");
  const pf = await preflight(opts.publicClient, intent, opts.policyEngine, account.address);
  if (!pf.ok) return { ...pf, sent: false };
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
