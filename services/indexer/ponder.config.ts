import { createConfig, factory } from "ponder";
import type { Address } from "viem";
import { arenaBountyAbi, mandateRegistryAbi, vaultFactoryAbi, vyuhVaultAbi } from "./abis/vyuh";

const env = process.env;
const chainId = Number(env.CHAIN_ID ?? 177);
if (chainId !== 177 && chainId !== 133) throw new Error(`CHAIN_ID must be 177 or 133, got ${chainId}`);
const rpc = chainId === 177 ? env.HSK_RPC_MAINNET : env.HSK_RPC_TESTNET;
const startBlock = Number(env.START_BLOCK ?? 0);

function addr(name: string): Address {
  const v = env[name];
  if (!v) throw new Error(`${name} is not set; deploy contracts and fill .env`);
  return v as Address;
}

// One chain per run (177 mainnet or 133 testnet), picked by CHAIN_ID, so one config serves both.
export default createConfig({
  chains: { hashkey: { id: chainId, rpc } },
  contracts: {
    VaultFactory: { abi: vaultFactoryAbi, chain: "hashkey", address: addr("VAULT_FACTORY"), startBlock },
    VyuhVault: {
      abi: vyuhVaultAbi,
      chain: "hashkey",
      address: factory({ address: addr("VAULT_FACTORY"), event: vaultFactoryAbi[0], parameter: "vault" }),
      startBlock,
    },
    MandateRegistry: { abi: mandateRegistryAbi, chain: "hashkey", address: addr("MANDATE_REGISTRY"), startBlock },
    ArenaBounty: { abi: arenaBountyAbi, chain: "hashkey", address: addr("ARENA_BOUNTY"), startBlock },
  },
});
