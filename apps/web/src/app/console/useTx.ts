"use client";

import { BaseError, ContractFunctionRevertedError, type Hex } from "viem";
import { usePublicClient } from "wagmi";
import { reasonFromIndex, type ReasonCode } from "@vyuh/shared";
import { useToast } from "@/components/Toast";
import { ringForCode, verdict } from "@/lib/rings";

/** Turn a viem error into one honest sentence; PolicyViolation names the ring. */
export function describeError(e: unknown): string {
  if (e instanceof BaseError) {
    const revert = e.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError && revert.data?.errorName === "PolicyViolation") {
      const [codeIdx] = (revert.data.args ?? []) as readonly [number?];
      if (typeof codeIdx === "number") {
        const code: ReasonCode = reasonFromIndex(codeIdx);
        return verdict(code, ringForCode(code));
      }
    }
    return e.shortMessage;
  }
  return e instanceof Error ? e.message : String(e);
}

/** Sends a tx, toasts submitted / confirmed / reverted. Resolves true on success. */
export function useTx() {
  const toast = useToast();
  const client = usePublicClient();

  return async function run(label: string, send: () => Promise<Hex>): Promise<boolean> {
    try {
      const hash = await send();
      toast({ title: `${label}: submitted`, description: hash });
      const receipt = await client?.waitForTransactionReceipt({ hash });
      if (receipt && receipt.status !== "success") {
        toast({ title: `${label}: reverted`, description: hash, tone: "blocked" });
        return false;
      }
      toast({ title: `${label}: confirmed`, description: hash, tone: "held" });
      return true;
    } catch (e) {
      toast({ title: `${label}: not sent`, description: describeError(e), tone: "blocked" });
      return false;
    }
  };
}
