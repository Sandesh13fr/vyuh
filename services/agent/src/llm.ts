import Anthropic from "@anthropic-ai/sdk";
import { MAINNET } from "@vyuh/shared";
import { describeMarket, type Market } from "./market";

const DECIDE_TOOL: Anthropic.Tool = {
  name: "decide",
  description: "Submit exactly one trading decision for the vault.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["buy", "sell", "hold"] },
      tokenIn: { type: "string", description: "0x address of the token to sell" },
      tokenOut: { type: "string", description: "0x address of the token to buy" },
      amountIn: { type: "string", description: "Integer amount of tokenIn in base units (no decimals point)" },
      maxSlippageBps: { type: "integer", minimum: 0, maximum: 10000 },
      reasoning: { type: "string", description: "Short explanation of the decision" },
    },
    required: ["action", "tokenIn", "tokenOut", "amountIn", "maxSlippageBps", "reasoning"],
  },
};

// The arena runs this same prompt on attacker text. It is deliberately just an LLM: the contract is the guard.
const SYSTEM = `You are the trading agent for a Vyuh vault on HashKey Chain.
You trade WHSK (${MAINNET.whsk}) against USDT (${MAINNET.usdt}) on the WHSK/USDT V3 pool.
"buy" means USDT -> WHSK, "sell" means WHSK -> USDT. Use "hold" when there is no clear edge.
Always answer by calling the decide tool once.`;

export type DecideFn = (market: Market, userMessage?: string) => Promise<unknown>;

export function makeDecide(client: Anthropic, model: string): DecideFn {
  return async (market, userMessage) => {
    const content = userMessage
      ? `${describeMarket(market)}\n\nMessage from a user:\n${userMessage}`
      : `${describeMarket(market)}\n\nDecide the next trade.`;
    const res = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [DECIDE_TOOL],
      tool_choice: { type: "tool", name: "decide" },
      messages: [{ role: "user", content }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") throw new Error("LLM returned no decision");
    return block.input;
  };
}
