import { ponder } from "ponder:registry";
import { attacker, attempt, bounty, haltEvent, mandate, navPoint, receipt, vault } from "ponder:schema";
import { REASON_CODES } from "@vyuh/shared";
import { mandateRegistryAbi } from "../abis/vyuh";

const reasonName = (i: number) => REASON_CODES[i] ?? `UNKNOWN_${i}`;

ponder.on("VaultFactory:VaultCreated", async ({ event, context }) => {
  await context.db
    .insert(vault)
    .values({
      address: event.args.vault,
      owner: event.args.owner,
      agent: event.args.agent,
      halted: false,
      nav: 0n,
      pnl: 0n,
      tradeCount: 0,
      createdAt: event.block.timestamp,
    })
    .onConflictDoNothing();
});

ponder.on("VyuhVault:TradeExecuted", async ({ event, context }) => {
  const a = event.args;
  const id = `${event.transaction.hash}-${event.log.logIndex}`;
  await context.db.insert(receipt).values({
    id,
    vault: a.vault,
    intentHash: a.intentHash,
    reasoningHash: a.reasoningHash,
    tokenIn: a.tokenIn,
    tokenOut: a.tokenOut,
    amountIn: a.amountIn,
    amountOut: a.amountOut,
    navBefore: a.navBefore,
    navAfter: a.navAfter,
    txHash: event.transaction.hash,
    blockNumber: event.block.number,
    timestamp: event.block.timestamp,
  });
  await context.db.insert(navPoint).values({ id, vault: a.vault, nav: a.navAfter, timestamp: event.block.timestamp });
  await context.db.update(vault, { address: event.log.address }).set((row) => ({
    nav: a.navAfter,
    pnl: row.pnl + (a.navAfter - a.navBefore),
    tradeCount: row.tradeCount + 1,
    lastTradeAt: event.block.timestamp,
  }));
});

ponder.on("VyuhVault:Halted", async ({ event, context }) => {
  const reason = reasonName(event.args.reason);
  await context.db.insert(haltEvent).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    vault: event.log.address,
    kind: "halt",
    reason,
    caller: event.args.caller,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });
  await context.db.update(vault, { address: event.log.address }).set({ halted: true, haltReason: reason });
});

ponder.on("VyuhVault:Resumed", async ({ event, context }) => {
  await context.db.insert(haltEvent).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    vault: event.log.address,
    kind: "resume",
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });
  await context.db.update(vault, { address: event.log.address }).set({ halted: false, haltReason: null });
});

ponder.on("MandateRegistry:MandateSet", async ({ event, context }) => {
  const { vault: v, mandateHash, version, tightenedByAgent } = event.args;
  // The event carries only a hash; read the full struct at this block for the API.
  const m = await context.client
    .readContract({ abi: mandateRegistryAbi, address: event.log.address, functionName: "getMandate", args: [v] })
    .catch(() => undefined);
  const row = {
    mandateHash,
    version,
    tightenedByAgent,
    owner: m?.owner,
    agent: m?.agent,
    maxTradeUsd: m?.maxTradeUsd,
    maxPositionUsd: m?.maxPositionUsd,
    maxSlippageBps: m?.maxSlippageBps,
    oracleBandBps: m?.oracleBandBps,
    dailyLossBps: m?.dailyLossBps,
    cooldownSecs: m?.cooldownSecs,
    minKycLevel: m?.minKycLevel,
    expiry: m?.expiry,
    allowedTokens: m ? [...m.allowedTokens] : undefined,
    updatedAt: event.block.timestamp,
  };
  await context.db.insert(mandate).values({ vault: v, ...row }).onConflictDoUpdate(row);
});

ponder.on("ArenaBounty:AttemptRecorded", async ({ event, context }) => {
  const a = event.args;
  await context.db.insert(attempt).values({
    attemptId: a.attemptId,
    attacker: a.attacker,
    promptHash: a.promptHash,
    intentHash: a.intentHash,
    code: reasonName(a.code),
    paid: false,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });
  await context.db
    .insert(attacker)
    .values({ address: a.attacker, attempts: 1, tier1Wins: 0, totalPaid: 0n, lastAttemptAt: event.block.timestamp })
    .onConflictDoUpdate((row) => ({ attempts: row.attempts + 1, lastAttemptAt: event.block.timestamp }));
});

ponder.on("ArenaBounty:BountyPaid", async ({ event, context }) => {
  const a = event.args;
  await context.db.insert(bounty).values({
    attemptId: a.attemptId,
    attacker: a.attacker,
    amount: a.amount,
    txHash: event.transaction.hash,
    timestamp: event.block.timestamp,
  });
  await context.db.update(attempt, { attemptId: a.attemptId }).set({ paid: true });
  await context.db
    .insert(attacker)
    .values({ address: a.attacker, attempts: 0, tier1Wins: 1, totalPaid: a.amount, lastAttemptAt: event.block.timestamp })
    .onConflictDoUpdate((row) => ({ tier1Wins: row.tier1Wins + 1, totalPaid: row.totalPaid + a.amount }));
});
