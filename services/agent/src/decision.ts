import { z } from "zod";
import type { Address } from "viem";
import { buildIntent } from "@vyuh/guard";
import type { Intent } from "@vyuh/shared";
import { zAddress } from "./config";
import { quoteOut, type Market } from "./market";

/** LLM output is untrusted: everything is re-validated here, amounts become bigint. */
export const DecisionSchema = z.object({
  action: z.enum(["buy", "sell", "hold"]),
  tokenIn: zAddress,
  tokenOut: zAddress,
  amountIn: z
    .union([z.string().regex(/^\d{1,78}$/), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)])
    .transform((v) => BigInt(v)),
  maxSlippageBps: z.number().int().min(0).max(10_000),
  reasoning: z.string().min(1).max(4_000),
});
export type Decision = z.infer<typeof DecisionSchema>;

export function parseDecision(raw: unknown) {
  return DecisionSchema.safeParse(raw);
}

/** minAmountOut = pool quote minus the LLM's slippage. The SlippagePolicy ring re-checks against the oracle. */
export function decisionToIntent(
  d: Decision,
  ctx: { vault: Address; nonce: bigint; market: Market; now?: number },
): Intent {
  const quote = quoteOut(ctx.market, d.tokenIn, d.amountIn);
  return buildIntent({
    vault: ctx.vault,
    tokenIn: d.tokenIn,
    tokenOut: d.tokenOut,
    amountIn: d.amountIn,
    minAmountOut: (quote * BigInt(10_000 - d.maxSlippageBps)) / 10_000n,
    nonce: ctx.nonce,
    fee: ctx.market.fee,
    reasoning: d,
    now: ctx.now,
  });
}
