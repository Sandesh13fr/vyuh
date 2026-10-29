import Link from "next/link";
import { RING_NAMES } from "@vyuh/shared";
import { AttackLoop } from "@/components/AttackLoop";
import { Button } from "@/components/Button";
import { api } from "@/lib/api";
import styles from "./page.module.css";

// The counter must be live, never a build-time snapshot.
export const dynamic = "force-dynamic";

const LIMIT = 500;

const RING_CHECKS = [
  "Trade size under the per-trade cap.",
  "Both tokens on the mandate allowlist.",
  "Price within the band of the APRO oracle, and the oracle is fresh.",
  "Minimum output within the slippage limit.",
  "NAV drop since UTC midnight under the daily loss limit.",
  "Owner KYC level at or above the mandate minimum.",
  "Enough time since the last trade.",
] as const;

export default async function Landing() {
  const { data: attempts, demo } = await api.attempts(LIMIT);
  // An attempt is stopped when the LLM refused or a ring said no. Anything else is a breach.
  const stopped = attempts.filter((a) => a.llmRefused || a.code !== "OK").length;
  const breaches = attempts.length - stopped;

  return (
    <div className="page">
      <section className={styles.hero} aria-labelledby="thesis">
        <div className={styles.copy}>
          <h1 id="thesis" className={styles.thesis}>
            Agents trade. Vyuh holds.
          </h1>
          <p className={styles.lede}>
            The LLM proposes a trade. Seven policy rings on HashKey Chain accept or reject it before any token moves. The
            Arena lets anyone try to talk a real-money agent into a bad trade.
          </p>

          <div className={styles.counter}>
            <span className={styles.count}>
              {stopped}
              {attempts.length >= LIMIT ? "+" : ""}
            </span>
            <span className={styles.countLabel}>
              attacks stopped · <span className="mono">{breaches}</span> breaches
              {demo && <span className="demo-badge">demo data</span>}
            </span>
          </div>

          <div className={styles.ctas}>
            <Button asChild>
              <Link href="/arena">Break the Vyuh</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/console">Open the console</Link>
            </Button>
          </div>
        </div>

        <AttackLoop codes={attempts.map((a) => a.code)} demo={demo} />
      </section>

      <section className={styles.section} aria-labelledby="rings">
        <h2 id="rings" className={styles.h2}>
          Seven rings. First failure wins.
        </h2>
        <ol className={styles.rings}>
          {RING_NAMES.map((name, i) => (
            <li key={name} className={styles.ring}>
              <span className={styles.ringNo}>{i + 1}</span>
              <span>
                <strong>{name}</strong>
                <span className={styles.ringCheck}>{RING_CHECKS[i]}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="how">
        <h2 id="how" className={styles.h2}>
          The LLM proposes. The contract decides.
        </h2>
        <ol className={styles.steps}>
          <li>
            <strong>Propose.</strong> The agent emits a structured intent with a hash of its reasoning.
          </li>
          <li>
            <strong>Preflight.</strong> A free <code>checkIntent</code> call runs the same seven rings offchain and
            names the reason before any gas is spent.
          </li>
          <li>
            <strong>Enforce.</strong> <code>VyuhVault.execute</code> runs the rings again onchain. One failure reverts
            with a reason code. A pass leaves a receipt.
          </li>
        </ol>
        <p className={styles.note}>
          Non-custodial. The agent key is an operator, never an owner. The owner can always withdraw, even when the
          vault is halted.
        </p>
      </section>
    </div>
  );
}
