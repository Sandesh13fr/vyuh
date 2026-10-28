import type { Metadata } from "next";
import { isAddress, type Address } from "viem";
import { ConsoleClient } from "./ConsoleClient";

export const metadata: Metadata = {
  title: "Console",
  description: "Vault NAV, mandate rings, receipts, halt and withdraw.",
};

export default async function ConsolePage({ searchParams }: { searchParams: Promise<{ vault?: string | string[] }> }) {
  const { vault } = await searchParams;
  const fromQuery = typeof vault === "string" && isAddress(vault) ? (vault as Address) : null;
  return <ConsoleClient vaultParam={fromQuery} />;
}
