import { index, onchainTable } from "ponder";

export const vault = onchainTable("vault", (t) => ({
  address: t.hex().primaryKey(),
  owner: t.hex().notNull(),
  agent: t.hex().notNull(),
  halted: t.boolean().notNull(),
  haltReason: t.text(),
  nav: t.bigint().notNull(),
  /** Sum of (navAfter - navBefore) over trades; excludes deposits/withdrawals. */
  pnl: t.bigint().notNull(),
  tradeCount: t.integer().notNull(),
  lastTradeAt: t.bigint(),
  createdAt: t.bigint().notNull(),
}));

/** Latest mandate per vault. Fields come from getMandate() at MandateSet time. */
export const mandate = onchainTable("mandate", (t) => ({
  vault: t.hex().primaryKey(),
  mandateHash: t.hex().notNull(),
  version: t.bigint().notNull(),
  tightenedByAgent: t.boolean().notNull(),
  owner: t.hex(),
  agent: t.hex(),
  maxTradeUsd: t.bigint(),
  maxPositionUsd: t.bigint(),
  maxSlippageBps: t.integer(),
  oracleBandBps: t.integer(),
  dailyLossBps: t.integer(),
  cooldownSecs: t.integer(),
  minKycLevel: t.integer(),
  expiry: t.bigint(),
  allowedTokens: t.hex().array(),
  updatedAt: t.bigint().notNull(),
}));

export const receipt = onchainTable(
  "receipt",
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    intentHash: t.hex().notNull(),
    reasoningHash: t.hex().notNull(),
    tokenIn: t.hex().notNull(),
    tokenOut: t.hex().notNull(),
    amountIn: t.bigint().notNull(),
    amountOut: t.bigint().notNull(),
    navBefore: t.bigint().notNull(),
    navAfter: t.bigint().notNull(),
    txHash: t.hex().notNull(),
    blockNumber: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (t) => ({ vaultIdx: index().on(t.vault) }),
);

export const navPoint = onchainTable(
  "nav_point",
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    nav: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (t) => ({ vaultIdx: index().on(t.vault) }),
);

export const haltEvent = onchainTable(
  "halt_event",
  (t) => ({
    id: t.text().primaryKey(),
    vault: t.hex().notNull(),
    /** "halt" or "resume". */
    kind: t.text().notNull(),
    reason: t.text(),
    caller: t.hex(),
    txHash: t.hex().notNull(),
    timestamp: t.bigint().notNull(),
  }),
  (t) => ({ vaultIdx: index().on(t.vault) }),
);

export const attempt = onchainTable("attempt", (t) => ({
  attemptId: t.hex().primaryKey(),
  attacker: t.hex().notNull(),
  promptHash: t.hex().notNull(),
  intentHash: t.hex().notNull(),
  code: t.text().notNull(),
  paid: t.boolean().notNull(),
  txHash: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const bounty = onchainTable("bounty", (t) => ({
  attemptId: t.hex().primaryKey(),
  attacker: t.hex().notNull(),
  amount: t.bigint().notNull(),
  txHash: t.hex().notNull(),
  timestamp: t.bigint().notNull(),
}));

export const attacker = onchainTable("attacker", (t) => ({
  address: t.hex().primaryKey(),
  attempts: t.integer().notNull(),
  tier1Wins: t.integer().notNull(),
  totalPaid: t.bigint().notNull(),
  lastAttemptAt: t.bigint().notNull(),
}));
