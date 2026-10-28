import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { reasonFromIndex, type Intent } from "@vyuh/shared";
import { isAddress, keccak256, toBytes, type Address } from "viem";
import { z } from "zod";

// Claude Desktop does not set cwd, so load the repo .env by path before chain.ts reads env.
try {
  process.loadEnvFile(new URL("../../../.env", import.meta.url));
} catch {
  // no .env: rely on env passed by the MCP client config
}
const chain = await import("./chain");
const { explainRejection, formatPreflight, minOutFor, parseReason, spotAmountOut, toJson } = await import("./pure");

const INDEXER_URL = process.env.INDEXER_URL ?? "http://localhost:42069";

const address = z.string().refine((s) => isAddress(s), "must be a 0x address").transform((s) => s as Address);
const uint = z.string().regex(/^\d+$/, "raw integer amount in token base units, as a string");

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const fail = (e: unknown) => ({ ...text(`Error: ${e instanceof Error ? e.message : String(e)}`), isError: true });

type VaultView = { mandate: { allowedTokens?: Address[] | null } | null; nav: string; pnl: string };

async function indexerVault(vault: Address): Promise<VaultView | undefined> {
  try {
    const res = await fetch(`${INDEXER_URL}/vaults/${vault}`);
    return res.ok ? ((await res.json()) as VaultView) : undefined;
  } catch {
    return undefined; // indexer down: callers fall back to chain reads
  }
}

const server = new McpServer({ name: "vyuh", version: "0.1.0" });

server.registerTool(
  "get_mandate",
  {
    description: "Read the owner-signed mandate (caps, allowlist, slippage, cooldown, expiry) that bounds what a Vyuh vault's agent may trade.",
    inputSchema: { vault: address },
  },
  async ({ vault }) => {
    try {
      const m = (await indexerVault(vault))?.mandate;
      return text(toJson(m ?? (await chain.readMandate(vault))));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "quote",
  {
    description: "Spot quote from the HSKSwap V3 pool (after pool fee, before price impact), plus a minAmountOut for a given slippage. Amounts are raw base units.",
    inputSchema: {
      tokenIn: address,
      tokenOut: address,
      amountIn: uint,
      fee: z.number().int().default(500).describe("V3 fee tier; WHSK/USDT main pool is 500"),
      slippageBps: z.number().int().min(0).max(10_000).default(50),
    },
  },
  async ({ tokenIn, tokenOut, amountIn, fee, slippageBps }) => {
    try {
      const spot = await chain.poolSpot(tokenIn, tokenOut, fee);
      const amountOut = spotAmountOut(BigInt(amountIn), spot.sqrtPriceX96, spot.zeroForOne, fee);
      return text(toJson({ pool: spot.pool, amountIn, amountOut, minAmountOut: minOutFor(amountOut, slippageBps), slippageBps }));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "propose_trade",
  {
    description:
      "Build a trade intent for a Vyuh vault and preflight it against the seven onchain policy rings (PolicyEngine.checkIntent). " +
      "Returns the verdict in plain words. Submits only if the verdict is OK and the server runs with ALLOW_SUBMIT=true.",
    inputSchema: {
      vault: address,
      tokenIn: address,
      tokenOut: address,
      amountIn: uint,
      minAmountOut: uint.optional().describe("defaults to the spot quote minus slippageBps"),
      slippageBps: z.number().int().min(0).max(10_000).default(50),
      fee: z.number().int().default(500),
      reasoning: z.string().min(1).describe("why this trade; hashed into reasoningHash for the audit trail"),
      deadlineSecs: z.number().int().positive().default(300),
      nonce: uint.optional().describe("defaults to vault nonce() (next expected)"),
    },
  },
  async (a) => {
    try {
      let minAmountOut = a.minAmountOut ? BigInt(a.minAmountOut) : undefined;
      if (minAmountOut === undefined) {
        const spot = await chain.poolSpot(a.tokenIn, a.tokenOut, a.fee);
        minAmountOut = minOutFor(spotAmountOut(BigInt(a.amountIn), spot.sqrtPriceX96, spot.zeroForOne, a.fee), a.slippageBps);
      }
      const intent: Intent = {
        vault: a.vault,
        tokenIn: a.tokenIn,
        tokenOut: a.tokenOut,
        amountIn: BigInt(a.amountIn),
        minAmountOut,
        fee: a.fee,
        deadline: BigInt(Math.floor(Date.now() / 1000) + a.deadlineSecs),
        nonce: a.nonce ? BigInt(a.nonce) : await chain.nextNonce(a.vault),
        reasoningHash: keccak256(toBytes(JSON.stringify({ reasoning: a.reasoning }))),
      };
      const pre = await chain.checkIntent(intent);
      const code = reasonFromIndex(pre.code);
      const submission =
        code !== "OK"
          ? { status: "skipped" as const, why: "policy rejected the intent" }
          : !chain.allowSubmit
            ? { status: "skipped" as const, why: "ALLOW_SUBMIT is not true (preflight only)" }
            : { status: "submitted" as const, txHash: await chain.execute(intent) };
      return text(`${formatPreflight({ code, ring: pre.ring, submission })}\n\nIntent:\n${toJson(intent)}`);
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "get_positions",
  {
    description: "Token balances held by a Vyuh vault, for every token on its mandate allowlist.",
    inputSchema: { vault: address },
  },
  async ({ vault }) => {
    try {
      const tokens = (await indexerVault(vault))?.mandate?.allowedTokens ?? (await chain.readMandate(vault)).allowedTokens;
      return text(toJson(await Promise.all(tokens.map((t) => chain.tokenBalance(t, vault)))));
    } catch (e) {
      return fail(e);
    }
  },
);

server.registerTool(
  "get_pnl",
  {
    description: "Vault NAV and trading P&L (sum of NAV change across executed trades; deposits excluded), from the Vyuh indexer.",
    inputSchema: { vault: address },
  },
  async ({ vault }) => {
    const v = await indexerVault(vault);
    return v ? text(toJson(v)) : fail(`indexer at ${INDEXER_URL} has no data for ${vault}`);
  },
);

server.registerTool(
  "explain_rejection",
  {
    description: "Explain a Vyuh ReasonCode (name like SLIPPAGE or enum index like 9) and the policy ring that raised it.",
    inputSchema: {
      code: z.union([z.string(), z.number().int()]),
      ring: z.number().int().min(0).max(7).default(0).describe("1..7 policy ring; 0 for pre-ring vault checks"),
    },
  },
  async ({ code, ring }) => {
    try {
      return text(explainRejection(parseReason(code), ring));
    } catch (e) {
      return fail(e);
    }
  },
);

await server.connect(new StdioServerTransport());
console.error(`vyuh mcp ready (chain ${process.env.CHAIN_ID ?? 177}, submit ${chain.allowSubmit ? "ON" : "OFF"})`);
