import { db } from "ponder:api";
import { attacker, attempt, haltEvent, mandate, navPoint, receipt, vault } from "ponder:schema";
import { Hono } from "hono";
import { asc, desc, eq, inArray } from "ponder";
import { isAddress, type Hex } from "viem";

const app = new Hono();

// bigint is not JSON; ship amounts as decimal strings (clients parse with BigInt()).
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { "content-type": "application/json" },
  });

const addrParam = (raw: string | undefined): Hex | undefined =>
  raw && isAddress(raw, { strict: false }) ? (raw.toLowerCase() as Hex) : undefined;

const limitParam = (raw: string | undefined, def: number, max: number) =>
  Math.min(Math.max(Number.parseInt(raw ?? "", 10) || def, 1), max);

app.get("/vaults/:address", async (c) => {
  const a = addrParam(c.req.param("address"));
  if (!a) return c.json({ error: "bad address" }, 400);
  const [v] = await db.select().from(vault).where(eq(vault.address, a)).limit(1);
  if (!v) return json({ error: "vault not found" }, 404);
  const [m] = await db.select().from(mandate).where(eq(mandate.vault, a)).limit(1);
  return json({
    address: v.address,
    owner: v.owner,
    agent: v.agent,
    mandate: m ?? null,
    status: v.halted ? "halted" : "active",
    haltReason: v.haltReason,
    nav: v.nav,
    pnl: v.pnl,
    tradeCount: v.tradeCount,
    lastTradeAt: v.lastTradeAt,
  });
});

app.get("/vaults/:address/receipts", async (c) => {
  const a = addrParam(c.req.param("address"));
  if (!a) return c.json({ error: "bad address" }, 400);
  const rows = await db
    .select()
    .from(receipt)
    .where(eq(receipt.vault, a))
    .orderBy(desc(receipt.timestamp))
    .limit(limitParam(c.req.query("limit"), 100, 1000));
  return json(rows);
});

app.get("/vaults/:address/nav", async (c) => {
  const a = addrParam(c.req.param("address"));
  if (!a) return c.json({ error: "bad address" }, 400);
  const rows = await db
    .select({ timestamp: navPoint.timestamp, nav: navPoint.nav })
    .from(navPoint)
    .where(eq(navPoint.vault, a))
    .orderBy(asc(navPoint.timestamp));
  return json(rows);
});

app.get("/arena/attempts", async (c) => {
  const rows = await db
    .select()
    .from(attempt)
    .orderBy(desc(attempt.timestamp))
    .limit(limitParam(c.req.query("limit"), 50, 500));
  return json(rows);
});

app.get("/arena/leaderboard", async (c) => {
  const rows = await db
    .select()
    .from(attacker)
    .orderBy(desc(attacker.tier1Wins), desc(attacker.attempts))
    .limit(limitParam(c.req.query("limit"), 100, 500));
  return json(rows);
});

// ponytail: agent id = operator address; reputation is aggregated from its vaults.
// Switch to AgentRegistry events once that contract's events are in ARCHITECTURE.md.
app.get("/agents/:id", async (c) => {
  const a = addrParam(c.req.param("id"));
  if (!a) return c.json({ error: "agent id must be the operator address" }, 400);
  const vaults = await db.select().from(vault).where(eq(vault.agent, a));
  if (vaults.length === 0) return json({ error: "agent not found" }, 404);
  const halts = await db
    .select({ id: haltEvent.id })
    .from(haltEvent)
    .where(inArray(haltEvent.vault, vaults.map((v) => v.address)));
  return json({
    id: a,
    vaults: vaults.map((v) => v.address),
    trades: vaults.reduce((n, v) => n + v.tradeCount, 0),
    pnl: vaults.reduce((n, v) => n + v.pnl, 0n),
    halts: halts.length,
  });
});

const CSV_HEADER = [
  "timestamp", "intentHash", "reasoningHash", "tokenIn", "tokenOut",
  "amountIn", "amountOut", "navBefore", "navAfter", "txHash",
] as const;

// Hono cannot split ":vault.csv" into param + suffix, so match the whole segment.
app.get("/audit/:file", async (c) => {
  const file = c.req.param("file");
  const a = file.endsWith(".csv") ? addrParam(file.slice(0, -4)) : undefined;
  if (!a) return c.json({ error: "use /audit/<vault>.csv" }, 400);
  const rows = await db.select().from(receipt).where(eq(receipt.vault, a)).orderBy(asc(receipt.timestamp));
  // Every field is hex, a number or an ISO date, so no CSV quoting is needed.
  const lines = rows.map((r) =>
    [
      new Date(Number(r.timestamp) * 1000).toISOString(),
      r.intentHash, r.reasoningHash, r.tokenIn, r.tokenOut,
      r.amountIn, r.amountOut, r.navBefore, r.navAfter, r.txHash,
    ].join(","),
  );
  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header("Content-Disposition", `attachment; filename="vyuh-audit-${a}.csv"`);
  return c.body([CSV_HEADER.join(","), ...lines].join("\n") + "\n");
});

export default app;
