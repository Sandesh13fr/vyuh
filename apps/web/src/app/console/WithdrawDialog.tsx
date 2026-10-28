"use client";

import { MAINNET, erc20Abi, vyuhVaultAbi } from "@vyuh/shared";
import { useState } from "react";
import { parseUnits, type Address } from "viem";
import { useReadContract, useWriteContract } from "wagmi";
import { Button } from "@/components/Button";
import { Dialog, DialogActions, DialogClose } from "@/components/Dialog";
import type { VaultView } from "@/lib/api";
import { tokenInfo } from "@/lib/format";
import { useTx } from "./useTx";
import styles from "./console.module.css";

export interface WithdrawDialogProps {
  vault: VaultView;
  disabled: boolean;
  onDone: () => void;
}

export function WithdrawDialog({ vault, disabled, onDone }: WithdrawDialogProps) {
  const options = Array.from(
    new Set([...(vault.mandate?.allowedTokens ?? []), MAINNET.usdt, MAINNET.whsk, MAINNET.usdc].map((a) => a.toLowerCase())),
  ) as Address[];
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<Address>(options[0] ?? MAINNET.usdt);
  const [amount, setAmount] = useState("");
  const { writeContractAsync } = useWriteContract();
  const run = useTx();

  // Read decimals from the token itself; the local table is only a fallback.
  const decimalsQ = useReadContract({ address: token, abi: erc20Abi, functionName: "decimals", query: { enabled: open } });
  const decimals = decimalsQ.data ?? tokenInfo(token).decimals;

  let value: bigint | null = null;
  try {
    value = amount.trim() ? parseUnits(amount.trim(), decimals) : null;
  } catch {
    value = null;
  }
  const invalid = amount.trim() !== "" && (value === null || value <= 0n);

  async function withdraw() {
    const v = value;
    if (v === null || v <= 0n) return;
    const ok = await run("Withdraw", () =>
      writeContractAsync({ address: vault.address, abi: vyuhVaultAbi, functionName: "withdraw", args: [token, v] }),
    );
    if (ok) {
      setOpen(false);
      setAmount("");
      onDone();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      title="Withdraw from the vault"
      description="Owner only. Works even when the vault is halted. Funds go to the owner address."
      trigger={
        <Button variant="secondary" disabled={disabled}>
          Withdraw
        </Button>
      }
    >
      <div className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="wd-token">Token</label>
          <select id="wd-token" className={styles.input} value={token} onChange={(e) => setToken(e.target.value as Address)}>
            {options.map((a) => (
              <option key={a} value={a}>
                {tokenInfo(a).symbol}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="wd-amount">Amount</label>
          <input
            id="wd-amount"
            className={`${styles.input} mono`}
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? "wd-err" : undefined}
            onChange={(e) => setAmount(e.target.value)}
          />
          {invalid && (
            <p id="wd-err" className={styles.warn}>
              Enter a positive amount with at most {decimals} decimals.
            </p>
          )}
        </div>
      </div>
      <DialogActions>
        <DialogClose asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogClose>
        <Button onClick={withdraw} disabled={value === null || value <= 0n}>
          Withdraw
        </Button>
      </DialogActions>
    </Dialog>
  );
}
