import type { Chain } from "viem";
import { hashkey, hashkeyTestnet } from "viem/chains";

export { hashkey, hashkeyTestnet };

export type SupportedChainId = 177 | 133;

export const SUPPORTED_CHAINS: Record<SupportedChainId, Chain> = { 177: hashkey, 133: hashkeyTestnet };

export function chainFor(id: number): Chain {
  const chain = SUPPORTED_CHAINS[id as SupportedChainId];
  if (!chain) throw new Error(`Unsupported chain ${id}; use 177 (mainnet) or 133 (testnet)`);
  return chain;
}
