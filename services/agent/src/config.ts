import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";
import { chainFor } from "@vyuh/shared";

export const zAddress = z.custom<Address>((v) => typeof v === "string" && isAddress(v), "invalid address");
const zKey = z.custom<Hex>((v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v), "invalid private key");

const Env = z.object({
  CHAIN_ID: z.coerce.number().default(177),
  HSK_RPC_MAINNET: z.string().url().optional(),
  HSK_RPC_TESTNET: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_MODEL: z.string().default("claude-sonnet-5-5"),
  POLICY_ENGINE: zAddress,
  AGENT_PRIVATE_KEY: zKey.optional(),
  AGENT_VAULT: zAddress.optional(),
  ARENA_VAULT: zAddress.optional(),
  ARENA_BOUNTY: zAddress.optional(),
  ARENA_OPERATOR_PRIVATE_KEY: zKey.optional(),
  DRY_RUN: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  LOOP_MS: z.coerce.number().int().positive().default(60_000),
});
export type Config = z.infer<typeof Env>;

/** Empty strings in .env mean "unset". */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  return Env.parse(Object.fromEntries(Object.entries(env).filter(([, v]) => v !== "")));
}

export function makeClients(cfg: Config, privateKey?: Hex): { publicClient: PublicClient; walletClient?: WalletClient } {
  const chain = chainFor(cfg.CHAIN_ID);
  const rpc = cfg.CHAIN_ID === 177 ? cfg.HSK_RPC_MAINNET : cfg.HSK_RPC_TESTNET;
  const transport = http(rpc);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = privateKey
    ? createWalletClient({ chain, transport, account: privateKeyToAccount(privateKey) })
    : undefined;
  return { publicClient, walletClient };
}
