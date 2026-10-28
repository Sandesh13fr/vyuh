import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import type { Address, Chain } from "viem";
import { createConfig, http } from "wagmi";
import { hashkey, hashkeyTestnet } from "@vyuh/shared";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Without a WalletConnect project id only the browser-injected wallet works; say so instead of crashing.
const wallets = projectId
  ? [injectedWallet, metaMaskWallet, rainbowWallet, walletConnectWallet]
  : [injectedWallet];

const connectors = connectorsForWallets([{ groupName: "Wallets", wallets }], {
  appName: "Vyuh",
  projectId: projectId || "walletconnect-disabled",
});

/** NEXT_PUBLIC_CHAIN_ID picks the default chain; both stay switchable. */
export const DEFAULT_CHAIN: Chain = process.env.NEXT_PUBLIC_CHAIN_ID === "133" ? hashkeyTestnet : hashkey;
const chains: readonly [Chain, ...Chain[]] =
  DEFAULT_CHAIN.id === hashkey.id ? [hashkey, hashkeyTestnet] : [hashkeyTestnet, hashkey];

export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports: { [hashkey.id]: http(), [hashkeyTestnet.id]: http() },
  ssr: true,
});

const addr = (v: string | undefined) => (v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as Address) : undefined);

/** Browser-visible deployment addresses. Unset means the feature shows as unavailable. */
export const PUBLIC_ADDRESSES = {
  mandateRegistry: addr(process.env.NEXT_PUBLIC_MANDATE_REGISTRY),
  arenaVault: addr(process.env.NEXT_PUBLIC_ARENA_VAULT),
};
