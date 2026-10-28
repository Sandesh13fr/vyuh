"use client";

import * as Slider from "@radix-ui/react-slider";
import * as Switch from "@radix-ui/react-switch";
import {
  EIP712_DOMAIN_NAME,
  EIP712_DOMAIN_VERSION,
  MAINNET,
  MANDATE_TYPES,
  mandateRegistryAbi,
  type Mandate,
} from "@vyuh/shared";
import { useState } from "react";
import type { Address } from "viem";
import { useAccount, useChainId, useSignTypedData, useWriteContract } from "wagmi";
import { Button } from "@/components/Button";
import { Dialog, DialogActions, DialogClose } from "@/components/Dialog";
import type { MandateView, VaultView } from "@/lib/api";
import { PUBLIC_ADDRESSES } from "@/lib/wagmi";
import { useTx } from "./useTx";
import styles from "./console.module.css";

const E18 = 10n ** 18n;

/** Numeric mandate fields the owner tunes. Lower is tighter for all of them except KYC level. */
type Field = "maxTradeUsd" | "maxPositionUsd" | "maxSlippageBps" | "oracleBandBps" | "dailyLossBps" | "cooldownSecs" | "minKycLevel";

const FIELDS: { key: Field; label: string; min: number; max: number; step: number; fmt: (v: number) => string; tighterIsHigher?: boolean }[] = [
  { key: "maxTradeUsd", label: "1. Spend cap per trade", min: 10, max: 10_000, step: 10, fmt: (v) => `$${v.toLocaleString("en-US")}` },
  { key: "maxPositionUsd", label: "Max position per token", min: 100, max: 100_000, step: 100, fmt: (v) => `$${v.toLocaleString("en-US")}` },
  { key: "oracleBandBps", label: "3. Oracle band", min: 10, max: 1_000, step: 10, fmt: (v) => `${(v / 100).toFixed(2)}%` },
  { key: "maxSlippageBps", label: "4. Max slippage", min: 5, max: 500, step: 5, fmt: (v) => `${(v / 100).toFixed(2)}%` },
  { key: "dailyLossBps", label: "5. Daily loss limit", min: 50, max: 2_000, step: 50, fmt: (v) => `${(v / 100).toFixed(2)}%` },
  { key: "minKycLevel", label: "6. Min KYC level", min: 0, max: 4, step: 1, fmt: (v) => `${v}`, tighterIsHigher: true },
  { key: "cooldownSecs", label: "7. Cooldown", min: 0, max: 3_600, step: 30, fmt: (v) => `${v}s` },
];

const TOKENS = [
  { address: MAINNET.whsk, symbol: "WHSK" },
  { address: MAINNET.usdt, symbol: "USDT" },
  { address: MAINNET.usdc, symbol: "USDC" },
] as const;

const DEFAULTS: Record<Field, number> = {
  maxTradeUsd: 500,
  maxPositionUsd: 5_000,
  maxSlippageBps: 50,
  oracleBandBps: 150,
  dailyLossBps: 300,
  cooldownSecs: 300,
  minKycLevel: 1,
};

function currentValues(m: MandateView | null): Record<Field, number> {
  if (!m) return DEFAULTS;
  const usd = (v: bigint | null, d: number) => (v === null ? d : Number(v / E18));
  return {
    maxTradeUsd: usd(m.maxTradeUsd, DEFAULTS.maxTradeUsd),
    maxPositionUsd: usd(m.maxPositionUsd, DEFAULTS.maxPositionUsd),
    maxSlippageBps: m.maxSlippageBps ?? DEFAULTS.maxSlippageBps,
    oracleBandBps: m.oracleBandBps ?? DEFAULTS.oracleBandBps,
    dailyLossBps: m.dailyLossBps ?? DEFAULTS.dailyLossBps,
    cooldownSecs: m.cooldownSecs ?? DEFAULTS.cooldownSecs,
    minKycLevel: m.minKycLevel ?? DEFAULTS.minKycLevel,
  };
}

function direction(next: number, prev: number, tighterIsHigher = false): "tighter" | "looser" | null {
  if (next === prev) return null;
  return next < prev !== tighterIsHigher ? "tighter" : "looser";
}

export interface MandateDialogProps {
  vault: VaultView;
  disabledReason: string | null;
  onDone: () => void;
}

export function MandateDialog({ vault, disabledReason, onDone }: MandateDialogProps) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const run = useTx();
  const registry = PUBLIC_ADDRESSES.mandateRegistry;

  const prev = currentValues(vault.mandate);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(prev);
  const [tokens, setTokens] = useState<Set<string>>(
    () => new Set((vault.mandate?.allowedTokens ?? [MAINNET.whsk, MAINNET.usdt]).map((t) => t.toLowerCase())),
  );
  const [busy, setBusy] = useState(false);

  const isOwner = Boolean(address && address.toLowerCase() === vault.owner.toLowerCase());
  const why =
    disabledReason ??
    (!registry ? "NEXT_PUBLIC_MANDATE_REGISTRY is not set." : !address ? "Connect the owner wallet to sign." : !isOwner ? "Only the vault owner can sign a mandate." : null);
  const loosens = FIELDS.some((f) => direction(values[f.key], prev[f.key], f.tighterIsHigher) === "looser");

  async function sign() {
    if (!registry || !address) return;
    setBusy(true);
    const mandate: Mandate = {
      owner: address,
      agent: vault.agent,
      maxTradeUsd: BigInt(values.maxTradeUsd) * E18,
      maxPositionUsd: BigInt(values.maxPositionUsd) * E18,
      maxSlippageBps: values.maxSlippageBps,
      oracleBandBps: values.oracleBandBps,
      dailyLossBps: values.dailyLossBps,
      cooldownSecs: values.cooldownSecs,
      minKycLevel: values.minKycLevel,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400),
      version: (vault.mandate?.version ?? 0n) + 1n,
      allowedTokens: TOKENS.filter((t) => tokens.has(t.address.toLowerCase())).map((t) => t.address as Address),
    };
    const ok = await run("Sign mandate", async () => {
      const sig = await signTypedDataAsync({
        domain: { name: EIP712_DOMAIN_NAME, version: EIP712_DOMAIN_VERSION, chainId, verifyingContract: registry },
        types: MANDATE_TYPES,
        primaryType: "Mandate",
        message: mandate,
      });
      return writeContractAsync({ address: registry, abi: mandateRegistryAbi, functionName: "setMandate", args: [vault.address, mandate, sig] });
    });
    setBusy(false);
    if (ok) {
      setOpen(false);
      onDone();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setValues(currentValues(vault.mandate));
      }}
      title="Sign a mandate"
      description="Your EIP-712 signature sets the limits every ring enforces. The agent can only tighten them; loosening needs you."
      trigger={<Button>Sign mandate</Button>}
    >
      <div className={styles.form}>
        {FIELDS.map((f) => {
          const dir = direction(values[f.key], prev[f.key], f.tighterIsHigher);
          const id = `mandate-${f.key}`;
          return (
            <div key={f.key} className={styles.field}>
              <div className={styles.fieldHead}>
                <span id={id}>{f.label}</span>
                <span className="mono">
                  {f.fmt(values[f.key])}
                  {dir && <span className={dir === "tighter" ? styles.tighter : styles.looser}> {dir === "tighter" ? "↓ tighter" : "↑ looser"}</span>}
                </span>
              </div>
              <Slider.Root
                className={styles.slider}
                min={f.min}
                max={f.max}
                step={f.step}
                value={[values[f.key]]}
                onValueChange={([v]) => v !== undefined && setValues((s) => ({ ...s, [f.key]: v }))}
              >
                <Slider.Track className={styles.track}>
                  <Slider.Range className={styles.range} />
                </Slider.Track>
                <Slider.Thumb className={styles.thumb} aria-labelledby={id} aria-valuetext={f.fmt(values[f.key])} />
              </Slider.Root>
            </div>
          );
        })}

        <fieldset className={styles.tokens}>
          <legend>2. Allowlist</legend>
          {TOKENS.map((t) => {
            const id = `allow-${t.symbol}`;
            const on = tokens.has(t.address.toLowerCase());
            return (
              <div key={t.symbol} className={styles.switchRow}>
                <label htmlFor={id}>{t.symbol}</label>
                <Switch.Root
                  id={id}
                  className={styles.switch}
                  checked={on}
                  onCheckedChange={(c) =>
                    setTokens((s) => {
                      const n = new Set(s);
                      if (c) n.add(t.address.toLowerCase());
                      else n.delete(t.address.toLowerCase());
                      return n;
                    })
                  }
                >
                  <Switch.Thumb className={styles.switchThumb} />
                </Switch.Root>
              </div>
            );
          })}
        </fieldset>

        <p className={styles.muted}>
          Expires in 30 days. Version {String((vault.mandate?.version ?? 0n) + 1n)}.
          {loosens && " This loosens at least one ring."}
        </p>
        {why && <p className={styles.warn}>{why}</p>}
      </div>

      <DialogActions>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button onClick={sign} disabled={Boolean(why) || busy || tokens.size === 0}>
          {busy ? "Waiting for wallet…" : "Sign and submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
