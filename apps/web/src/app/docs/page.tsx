import type { Metadata } from "next";
import Link from "next/link";
import { REASON_CODES, RING_NAMES, explainReason } from "@vyuh/shared";
import styles from "./docs.module.css";

export const metadata: Metadata = {
  title: "Docs",
  description: "Get an AI trading agent behind Vyuh's seven onchain rings in a few minutes.",
};

const TOC = [
  { id: "model", label: "The model" },
  { id: "sdk", label: "Guard a swap" },
  { id: "mandate", label: "Sign a mandate" },
  { id: "mcp", label: "MCP tools" },
  { id: "rings", label: "Rings" },
  { id: "codes", label: "Reason codes" },
] as const;

const SDK = `import { buildIntent, guardedSwap } from "@vyuh/guard";

const intent = buildIntent({
  vault, tokenIn, tokenOut, amountIn, minAmountOut, nonce,
  reasoning: llmReasoningJson, // hashed into reasoningHash
});

// Preflights PolicyEngine.checkIntent (free eth_call). Sends only on OK.
const r = await guardedSwap(walletClient, intent, { publicClient, policyEngine });
if (!r.ok) console.log(r.code, r.ring, r.explanation); // e.g. ORACLE_BAND 3`;

const MANDATE = `import { signMandate } from "@vyuh/guard";

const sig = await signMandate(ownerWallet, mandate, MANDATE_REGISTRY, 177);
// then MandateRegistry.setMandate(vault, mandate, sig)`;

export default function DocsPage() {
  return (
    <div className={`page ${styles.layout}`}>
      <nav className={styles.sidebar} aria-label="On this page">
        <ul>
          {TOC.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`}>{t.label}</a>
            </li>
          ))}
        </ul>
      </nav>

      <article className={styles.article}>
        <h1>Getting started</h1>
        <p>
          Vyuh puts an onchain policy between your agent and its money. The LLM proposes. The contract decides. This
          page gets you from zero to a guarded swap on HashKey Chain.
        </p>

        <h2 id="model">The model</h2>
        <ul>
          <li>The owner deposits into a <code>VyuhVault</code> and signs a mandate (EIP-712).</li>
          <li>The agent key is an operator. It can propose trades and tighten limits. It can never withdraw or loosen.</li>
          <li>
            Every <code>execute(intent)</code> runs seven rings in order. First failure reverts with{" "}
            <code>PolicyViolation(code, ring)</code>.
          </li>
          <li>The owner can halt, resume and withdraw at any time, including while halted.</li>
        </ul>

        <h2 id="sdk">Guard a swap</h2>
        <p>
          Install <code>@vyuh/guard</code> and <code>viem</code> in your agent. <code>guardedSwap</code> preflights first,
          so a rejected trade costs no gas and returns the reason in plain words.
        </p>
        <pre className={styles.code}>
          <code>{SDK}</code>
        </pre>

        <h2 id="mandate">Sign a mandate</h2>
        <p>
          The <Link href="/console">Console</Link> signs mandates from your wallet. From code:
        </p>
        <pre className={styles.code}>
          <code>{MANDATE}</code>
        </pre>

        <h2 id="mcp">MCP tools</h2>
        <p>
          External LLM clients connect to the Vyuh MCP server. Tools: <code>get_mandate</code>, <code>quote</code>,{" "}
          <code>propose_trade</code>, <code>get_positions</code>, <code>get_pnl</code>, <code>explain_rejection</code>.{" "}
          <code>propose_trade</code> always preflights and returns the reason code before anything is sent.
        </p>

        <h2 id="rings">Rings</h2>
        <ol>
          {RING_NAMES.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>

        <h2 id="codes">Reason codes</h2>
        <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Reason codes">
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Code</th>
                <th scope="col">Meaning</th>
              </tr>
            </thead>
            <tbody>
              {REASON_CODES.map((c, i) => (
                <tr key={c}>
                  <td className="mono">{i}</td>
                  <td className="mono">{c}</td>
                  <td>{explainReason(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
