import type { Address } from "viem";

/** Verified HashKey mainnet (177) third-party contracts. See docs/ARCHITECTURE.md. */
export const MAINNET = {
  swapRouter: "0x1f3858C46F8F6fE76260b8208995D228C5cddc64",
  v3Factory: "0xD136e36610f35E0Cc3cAd40de858c151f2AA65D4",
  whskUsdtPool: "0xEB33d6666dd2359cB1BF6Ea6D72286Cc1b4a778A",
  whsk: "0xB210D2120d57b758EE163cFfb43e73728c471Cf1",
  usdt: "0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029",
  usdc: "0x054ed45810DbBAb8B27668922D110669c9D88D0a",
  aproHskUsd: "0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b",
  aproBtcUsd: "0x204ED500ab56A2E19B051561258E3A45c850360F",
} as const satisfies Record<string, Address>;

/** Vyuh deployments, read from env so one build serves testnet and mainnet. */
export function vyuhAddresses(env: Record<string, string | undefined> = process.env) {
  const pick = (k: string) => (env[k] || undefined) as Address | undefined;
  return {
    mandateRegistry: pick("MANDATE_REGISTRY"),
    policyEngine: pick("POLICY_ENGINE"),
    vaultFactory: pick("VAULT_FACTORY"),
    agentRegistry: pick("AGENT_REGISTRY"),
    arenaBounty: pick("ARENA_BOUNTY"),
    arenaVault: pick("ARENA_VAULT"),
    kycSbt: pick("KYC_SBT"),
  };
}
