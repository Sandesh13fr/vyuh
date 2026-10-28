import { formatUnits, type Address } from "viem";
import { MAINNET } from "@vyuh/shared";

const TOKENS: Record<string, { symbol: string; decimals: number }> = {
  // ponytail: decimals assumed (WHSK 18, stables 6); read erc20 decimals() if more tokens appear.
  [MAINNET.whsk.toLowerCase()]: { symbol: "WHSK", decimals: 18 },
  [MAINNET.usdt.toLowerCase()]: { symbol: "USDT", decimals: 6 },
  [MAINNET.usdc.toLowerCase()]: { symbol: "USDC", decimals: 6 },
};

export function tokenInfo(addr: Address) {
  return TOKENS[addr.toLowerCase()] ?? { symbol: shortHex(addr), decimals: 18 };
}

export function shortHex(hex: string, head = 6, tail = 4): string {
  return hex.length <= head + tail + 1 ? hex : `${hex.slice(0, head)}…${hex.slice(-tail)}`;
}

/** Fixed decimals with thousands separators, no float round-trip. */
export function formatAmount(value: bigint, decimals: number, places = 2): string {
  const neg = value < 0n;
  const [int = "0", frac = ""] = formatUnits(neg ? -value : value, decimals).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const tail = places > 0 ? "." + frac.padEnd(places, "0").slice(0, places) : "";
  return `${neg ? "-" : ""}${grouped}${tail}`;
}

/** USD values are 1e18-scaled onchain. */
export function formatUsd(value: bigint, places = 2): string {
  const s = formatAmount(value, 18, places);
  return s.startsWith("-") ? `-$${s.slice(1)}` : `$${s}`;
}

export function formatToken(value: bigint, token: Address): string {
  const t = tokenInfo(token);
  return `${formatAmount(value, t.decimals, 4)} ${t.symbol}`;
}

export function timeAgo(unixSecs: bigint, now = Date.now()): string {
  const s = Math.max(0, Math.round(now / 1000 - Number(unixSecs)));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
