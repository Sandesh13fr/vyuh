import { NextResponse } from "next/server";
import { isAddress, zeroAddress, type Address } from "viem";
import { REASON_CODES, explainReason, type ReasonCode } from "@vyuh/shared";
import { ringForCode } from "@/lib/rings";

const MAX_LEN = 2000;

interface Reply {
  llmFooled: boolean;
  code: ReasonCode | null;
  ring: number | null;
  explanation: string;
  demo: boolean;
}

/**
 * POST { message, attacker? } -> { llmFooled, code, ring, explanation, demo }.
 * Forwards to the agent service at `${AGENT_URL}/arena`; with no AGENT_URL it answers with a
 * labelled demo reply so the page works offline. Attempts are free by design (no payment path here).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Send JSON: { message }" }, { status: 400 });
  }
  const { message, attacker } = (body ?? {}) as { message?: unknown; attacker?: unknown };
  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_LEN) {
    return NextResponse.json({ error: `message is over ${MAX_LEN} characters` }, { status: 400 });
  }
  const from: Address = typeof attacker === "string" && isAddress(attacker) ? attacker : zeroAddress;

  const agentUrl = process.env.AGENT_URL?.replace(/\/$/, "");
  if (!agentUrl) return NextResponse.json(demoReply(message));

  try {
    const res = await fetch(`${agentUrl}/arena`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, attacker: from }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`agent HTTP ${res.status}`);
    const r = (await res.json()) as Record<string, unknown>;
    const code = typeof r.code === "string" && (REASON_CODES as readonly string[]).includes(r.code) ? (r.code as ReasonCode) : null;
    const reply: Reply = {
      llmFooled: Boolean(r.llmFooled),
      code,
      ring: typeof r.ring === "number" && r.ring > 0 ? r.ring : null,
      explanation: typeof r.explanation === "string" ? r.explanation : code ? explainReason(code) : "",
      demo: false,
    };
    return NextResponse.json(reply);
  } catch (e) {
    console.error("arena forward failed", e);
    return NextResponse.json({ error: "The agent is unreachable. Try again in a moment." }, { status: 502 });
  }
}

/** DEMO: keyword guess at which ring a real run would hit. Never presented as a real result. */
function demoReply(message: string): Reply {
  const m = message.toLowerCase();
  const pick = (code: ReasonCode): Reply => ({
    llmFooled: true,
    code,
    ring: ringForCode(code),
    explanation: `Demo reply, no agent connected. ${explainReason(code)}`,
    demo: true,
  });
  if (/\b(all|everything|max|entire|100%|drain)\b/.test(m)) return pick("SPEND_CAP");
  if (/\b(meme|pepe|doge|shib|new token|0x[0-9a-f]{6,})/.test(m)) return pick("ALLOWLIST");
  if (/\b(price|pump|premium|above market|oracle)\b/.test(m)) return pick("ORACLE_BAND");
  if (/\b(slippage|min out|minimum|zero out)\b/.test(m)) return pick("SLIPPAGE");
  if (/\b(again|repeat|loop|spam|now now)\b/.test(m)) return pick("COOLDOWN");
  if (/\b(loss|lose|dump|sell everything)\b/.test(m)) return pick("DAILY_LOSS");
  return {
    llmFooled: false,
    code: null,
    ring: null,
    explanation: "Demo reply, no agent connected. The agent held: no trade proposed, so nothing reached the rings.",
    demo: true,
  };
}
