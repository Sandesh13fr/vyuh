/**
 * Typed client for the indexer REST API (docs/ARCHITECTURE.md, services/indexer/src/api).
 * The indexer ships bigints as decimal strings. Any failure falls back to demo data and says so.
 */
import { zeroHash, type Address, type Hex } from "viem";
import { REASON_CODES, type ReasonCode } from "@vyuh/shared";
import { DEMO_ATTEMPTS, DEMO_RECEIPTS, demoVault } from "./demo";

export const INDEXER_URL = (process.env.NEXT_PUBLIC_INDEXER_URL ?? "").replace(/\/$/, "");

/** `demo: true` means the data is invented and the UI must label it. */
export interface Sourced<T> {
  data: T;
  demo: boolean;
}

export interface MandateView {
  version: bigint;
  tightenedByAgent: boolean;
  maxTradeUsd: bigint | null;
  maxPositionUsd: bigint | null;
  maxSlippageBps: number | null;
  oracleBandBps: number | null;
  dailyLossBps: number | null;
  cooldownSecs: number | null;
  minKycLevel: number | null;
  expiry: bigint | null;
  allowedTokens: Address[];
}

export interface VaultView {
  address: Address;
  owner: Address;
  agent: Address;
  status: "active" | "halted";
  haltReason: string | null;
  nav: bigint;
  pnl: bigint;
  tradeCount: number;
  lastTradeAt: bigint | null;
  mandate: MandateView | null;
}

export interface Receipt {
  id: string;
  intentHash: Hex;
  reasoningHash: Hex;
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  amountOut: bigint;
  navBefore: bigint;
  navAfter: bigint;
  txHash: Hex;
  blockNumber: bigint;
  timestamp: bigint;
}

export interface Attempt {
  attemptId: Hex;
  attacker: Address;
  promptHash: Hex;
  intentHash: Hex;
  code: ReasonCode;
  /** Zero intentHash: the LLM held, so no intent ever reached the rings. */
  llmRefused: boolean;
  paid: boolean;
  txHash: Hex | null;
  timestamp: bigint;
}

type Wire = Record<string, unknown>;

const big = (v: unknown): bigint => BigInt(String(v ?? 0));
const bigOrNull = (v: unknown): bigint | null => (v === null || v === undefined ? null : big(v));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const str = <T extends string = string>(v: unknown): T => String(v ?? "") as T;

function parseCode(v: unknown): ReasonCode {
  const s = String(v);
  if ((REASON_CODES as readonly string[]).includes(s)) return s as ReasonCode;
  return REASON_CODES[Number(s)] ?? "OK"; // tolerate the raw uint8 too
}

function parseMandate(m: Wire): MandateView {
  return {
    version: big(m.version),
    tightenedByAgent: Boolean(m.tightenedByAgent),
    maxTradeUsd: bigOrNull(m.maxTradeUsd),
    maxPositionUsd: bigOrNull(m.maxPositionUsd),
    maxSlippageBps: numOrNull(m.maxSlippageBps),
    oracleBandBps: numOrNull(m.oracleBandBps),
    dailyLossBps: numOrNull(m.dailyLossBps),
    cooldownSecs: numOrNull(m.cooldownSecs),
    minKycLevel: numOrNull(m.minKycLevel),
    expiry: bigOrNull(m.expiry),
    allowedTokens: Array.isArray(m.allowedTokens) ? m.allowedTokens.map((a) => str<Address>(a)) : [],
  };
}

function parseVault(v: Wire): VaultView {
  return {
    address: str<Address>(v.address),
    owner: str<Address>(v.owner),
    agent: str<Address>(v.agent),
    status: v.status === "halted" ? "halted" : "active",
    haltReason: v.haltReason ? String(v.haltReason) : null,
    nav: big(v.nav),
    pnl: big(v.pnl),
    tradeCount: Number(v.tradeCount ?? 0),
    lastTradeAt: bigOrNull(v.lastTradeAt),
    mandate: v.mandate ? parseMandate(v.mandate as Wire) : null,
  };
}

function parseReceipt(r: Wire): Receipt {
  return {
    id: str(r.id),
    intentHash: str<Hex>(r.intentHash),
    reasoningHash: str<Hex>(r.reasoningHash),
    tokenIn: str<Address>(r.tokenIn),
    tokenOut: str<Address>(r.tokenOut),
    amountIn: big(r.amountIn),
    amountOut: big(r.amountOut),
    navBefore: big(r.navBefore),
    navAfter: big(r.navAfter),
    txHash: str<Hex>(r.txHash),
    blockNumber: big(r.blockNumber),
    timestamp: big(r.timestamp),
  };
}

function parseAttempt(a: Wire): Attempt {
  const intentHash = str<Hex>(a.intentHash);
  return {
    attemptId: str<Hex>(a.attemptId),
    attacker: str<Address>(a.attacker),
    promptHash: str<Hex>(a.promptHash),
    intentHash,
    code: parseCode(a.code),
    llmRefused: intentHash === zeroHash,
    paid: Boolean(a.paid),
    txHash: a.txHash ? str<Hex>(a.txHash) : null,
    timestamp: big(a.timestamp),
  };
}

async function getJson(path: string): Promise<unknown> {
  if (!INDEXER_URL) throw new Error("NEXT_PUBLIC_INDEXER_URL is not set");
  const res = await fetch(INDEXER_URL + path, { signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

async function sourced<T>(load: () => Promise<T>, demo: () => T): Promise<Sourced<T>> {
  try {
    return { data: await load(), demo: false };
  } catch {
    return { data: demo(), demo: true };
  }
}

function list(j: unknown): Wire[] {
  if (!Array.isArray(j)) throw new Error("expected an array");
  return j as Wire[];
}

export const api = {
  vault: (address: Address) =>
    sourced(async () => parseVault((await getJson(`/vaults/${address}`)) as Wire), () => demoVault(address)),

  receipts: (address: Address, limit = 50) =>
    sourced(
      async () => list(await getJson(`/vaults/${address}/receipts?limit=${limit}`)).map(parseReceipt),
      () => DEMO_RECEIPTS,
    ),

  attempts: (limit = 50) =>
    sourced(async () => list(await getJson(`/arena/attempts?limit=${limit}`)).map(parseAttempt), () => DEMO_ATTEMPTS),
};

/** Direct link to the indexer CSV export, or null when no indexer is configured. */
export function auditCsvUrl(vault: Address): string | null {
  return INDEXER_URL ? `${INDEXER_URL}/audit/${vault}.csv` : null;
}

/** Shape returned by POST /api/arena (and by the agent service behind it). */
export interface ArenaReply {
  /** The honeypot LLM emitted a trade from the attacker text. */
  llmFooled: boolean;
  /** null when the LLM held or its output failed validation. */
  code: ReasonCode | null;
  ring: number | null;
  explanation: string;
  /** True when no agent service is configured and the reply is invented. */
  demo: boolean;
}

export async function sendArenaMessage(message: string, attacker?: Address): Promise<ArenaReply> {
  const res = await fetch("/api/arena", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, attacker }),
  });
  const body = (await res.json()) as Partial<ArenaReply> & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return {
    llmFooled: Boolean(body.llmFooled),
    code: body.code ? parseCode(body.code) : null,
    ring: typeof body.ring === "number" ? body.ring : null,
    explanation: String(body.explanation ?? ""),
    demo: Boolean(body.demo),
  };
}
