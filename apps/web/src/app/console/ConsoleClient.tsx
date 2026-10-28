"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { DownloadIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import { REASON_CODES, RING_NAMES, vyuhVaultAbi, type ReasonCode } from "@vyuh/shared";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useWriteContract } from "wagmi";
import { Button } from "@/components/Button";
import { DataTable, type Column } from "@/components/DataTable";
import { Dialog, DialogActions, DialogClose } from "@/components/Dialog";
import { RingMeter } from "@/components/RingMeter";
import { api, auditCsvUrl, type MandateView, type Receipt, type VaultView } from "@/lib/api";
import { DEMO_VAULT_ADDRESS } from "@/lib/demo";
import { formatToken, formatUsd, shortHex, timeAgo, tokenInfo } from "@/lib/format";
import { meterStates, ringForCode } from "@/lib/rings";
import { PUBLIC_ADDRESSES } from "@/lib/wagmi";
import { MandateDialog } from "./MandateDialog";
import { WithdrawDialog } from "./WithdrawDialog";
import { useTx } from "./useTx";
import styles from "./console.module.css";

const pct = (bps: number | null) => (bps === null ? "unset" : `${(bps / 100).toFixed(2)}%`);

function mandateDetails(m: MandateView | null): string[] | undefined {
  if (!m) return undefined;
  return [
    m.maxTradeUsd === null ? "unset" : `max ${formatUsd(m.maxTradeUsd, 0)} per trade`,
    m.allowedTokens.length ? m.allowedTokens.map((t) => tokenInfo(t).symbol).join(", ") : "no tokens",
    `within ${pct(m.oracleBandBps)} of oracle`,
    `max ${pct(m.maxSlippageBps)} slippage`,
    `halt at ${pct(m.dailyLossBps)} daily loss`,
    `KYC level ${m.minKycLevel ?? "unset"} or higher`,
    m.cooldownSecs === null ? "unset" : `${m.cooldownSecs}s between trades`,
  ];
}

function mandateStates(v: VaultView) {
  if (!v.mandate) return meterStates(null);
  if (v.status === "halted") {
    const code = REASON_CODES.find((c) => c === v.haltReason) as ReasonCode | undefined;
    return meterStates(code ? ringForCode(code) : null);
  }
  return meterStates(null, true);
}

const RECEIPT_COLUMNS: Column<Receipt>[] = [
  { key: "when", header: "When", mono: true, render: (r) => timeAgo(r.timestamp) },
  { key: "in", header: "Sold", mono: true, align: "end", render: (r) => formatToken(r.amountIn, r.tokenIn) },
  { key: "out", header: "Bought", mono: true, align: "end", render: (r) => formatToken(r.amountOut, r.tokenOut) },
  { key: "nav", header: "NAV change", mono: true, align: "end", render: (r) => formatUsd(r.navAfter - r.navBefore) },
  { key: "reason", header: "Reasoning", mono: true, render: (r) => <span title={r.reasoningHash}>{shortHex(r.reasoningHash)}</span> },
  { key: "tx", header: "Tx", mono: true, render: (r) => <span title={r.txHash}>{shortHex(r.txHash)}</span> },
];

export function ConsoleClient({ vaultParam }: { vaultParam: Address | null }) {
  const vaultAddr = vaultParam ?? PUBLIC_ADDRESSES.arenaVault ?? DEMO_VAULT_ADDRESS;
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const run = useTx();
  const [haltOpen, setHaltOpen] = useState(false);

  const vaultQ = useQuery({ queryKey: ["vault", vaultAddr], queryFn: () => api.vault(vaultAddr), refetchInterval: 15_000 });
  const receiptsQ = useQuery({ queryKey: ["receipts", vaultAddr], queryFn: () => api.receipts(vaultAddr), refetchInterval: 15_000 });

  const vault = vaultQ.data?.data;
  const demo = Boolean(vaultQ.data?.demo || receiptsQ.data?.demo);
  const isOwner = Boolean(vault && address && vault.owner.toLowerCase() === address.toLowerCase());
  const canAct = isOwner && !vaultQ.data?.demo;
  const blockedWhy = vaultQ.data?.demo
    ? "Demo vault. Nothing to sign."
    : !address
      ? "Connect the owner wallet to act."
      : !isOwner
        ? "Only the vault owner can halt, resume or withdraw."
        : null;

  const refresh = () => {
    void vaultQ.refetch();
    void receiptsQ.refetch();
  };

  async function toggleHalt() {
    if (!vault) return;
    const halted = vault.status === "halted";
    const ok = await run(halted ? "Resume" : "Halt", () =>
      halted
        ? writeContractAsync({ address: vault.address, abi: vyuhVaultAbi, functionName: "resume" })
        : writeContractAsync({ address: vault.address, abi: vyuhVaultAbi, functionName: "ownerHalt" }),
    );
    setHaltOpen(false);
    if (ok) refresh();
  }

  if (!vault) {
    return (
      <div className="page">
        <p className={styles.muted}>Loading vault…</p>
      </div>
    );
  }

  const halted = vault.status === "halted";
  const csv = auditCsvUrl(vault.address);

  return (
    <div className="page">
      <section className={styles.header} aria-labelledby="vault-title">
        <div className={styles.idRow}>
          <h1 id="vault-title" className={styles.title}>
            Vault
          </h1>
          <code className={styles.addr} title={vault.address}>
            {shortHex(vault.address, 8, 6)}
          </code>
          <span className={`${styles.status} ${halted ? styles.halted : styles.active}`}>
            <span className={styles.dot} aria-hidden="true" />
            {halted ? `Halted${vault.haltReason ? `: ${vault.haltReason}` : ""}` : "Active"}
          </span>
          {demo && <span className="demo-badge">demo data</span>}
        </div>

        <dl className={styles.stats}>
          <div className={styles.focal}>
            <dt>NAV</dt>
            <dd className={styles.nav}>{formatUsd(vault.nav)}</dd>
          </div>
          <div>
            <dt>P&amp;L</dt>
            <dd className={vault.pnl < 0n ? styles.neg : styles.pos}>{formatUsd(vault.pnl)}</dd>
          </div>
          <div>
            <dt>Trades</dt>
            <dd>{vault.tradeCount}</dd>
          </div>
          <div>
            <dt>Agent</dt>
            <dd title={vault.agent}>{shortHex(vault.agent)}</dd>
          </div>
        </dl>

        <div className={styles.meterRow}>
          <RingMeter
            states={mandateStates(vault)}
            details={mandateDetails(vault.mandate)}
            size="lg"
            label={vault.mandate ? `Mandate v${vault.mandate.version}` : "No mandate"}
          />
          <span className={styles.muted}>
            {vault.mandate
              ? `Mandate v${vault.mandate.version}${vault.mandate.tightenedByAgent ? ", last tightened by the agent" : ""}. Focus a ring for its limit.`
              : "No mandate signed. The agent cannot trade."}
          </span>
        </div>

        <div className={styles.actions}>
          <MandateDialog vault={vault} disabledReason={vaultQ.data?.demo ? "Demo vault. Nothing to sign." : null} onDone={refresh} />
          <WithdrawDialog vault={vault} disabled={!canAct} onDone={refresh} />
          <Dialog
            open={haltOpen}
            onOpenChange={setHaltOpen}
            title={halted ? "Resume the agent?" : "Halt the agent?"}
            description={
              halted
                ? "The agent can trade again under the current mandate."
                : "Every trade reverts with HALTED until you resume. You can still withdraw."
            }
            trigger={
              <Button variant={halted ? "secondary" : "danger"} disabled={!canAct}>
                {halted ? "Resume" : "Halt"}
              </Button>
            }
          >
            <DialogActions>
              <DialogClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DialogClose>
              <Button variant={halted ? "primary" : "danger"} onClick={toggleHalt}>
                {halted ? "Resume" : "Halt now"}
              </Button>
            </DialogActions>
          </Dialog>
          {blockedWhy && <span className={styles.muted}>{blockedWhy}</span>}
        </div>
      </section>

      <Tabs.Root defaultValue="receipts" className={styles.tabs}>
        <Tabs.List className={styles.tabList} aria-label="Console sections">
          <Tabs.Trigger value="receipts" className={styles.tab}>
            Receipts
          </Tabs.Trigger>
          <Tabs.Trigger value="mandate" className={styles.tab}>
            Mandate
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="receipts" className={styles.panel}>
          <div className={styles.panelHead}>
            <p className={styles.muted}>Every trade that passed all seven rings, newest first.</p>
            {csv && (
              <Button asChild variant="secondary" size="sm">
                <a href={csv} download>
                  <DownloadIcon aria-hidden="true" /> Audit CSV
                </a>
              </Button>
            )}
          </div>
          <DataTable
            caption="Trade receipts"
            columns={RECEIPT_COLUMNS}
            rows={receiptsQ.data?.data ?? []}
            rowKey={(r) => r.id}
            empty={receiptsQ.isLoading ? "Loading receipts…" : "No trades yet."}
          />
        </Tabs.Content>

        <Tabs.Content value="mandate" className={styles.panel}>
          {vault.mandate ? (
            <dl className={styles.mandate}>
              {mandateDetails(vault.mandate)?.map((d, i) => (
                <div key={i}>
                  <dt>
                    {i + 1}. {RING_NAMES[i]}
                  </dt>
                  <dd>{d}</dd>
                </div>
              ))}
              <div>
                <dt>Max position</dt>
                <dd>{vault.mandate.maxPositionUsd === null ? "unset" : formatUsd(vault.mandate.maxPositionUsd, 0)}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>{vault.mandate.expiry === null ? "unset" : new Date(Number(vault.mandate.expiry) * 1000).toISOString().slice(0, 10)}</dd>
              </div>
            </dl>
          ) : (
            <p className={styles.muted}>No mandate yet. Sign one to let the agent trade.</p>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
