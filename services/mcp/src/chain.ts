import { chainFor, MAINNET, vyuhAddresses, type Intent, type Mandate } from "@vyuh/shared";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { preflight } from "@vyuh/guard";

// ponytail: local ABIs until @vyuh/shared exports generated ones (abis.ts); swap the imports then.
const INTENT = "struct Intent { address vault; address tokenIn; address tokenOut; uint256 amountIn; uint256 minAmountOut; uint24 fee; uint64 deadline; uint256 nonce; bytes32 reasoningHash; }";
const MANDATE = "struct Mandate { address owner; address agent; uint256 maxTradeUsd; uint256 maxPositionUsd; uint16 maxSlippageBps; uint16 oracleBandBps; uint16 dailyLossBps; uint32 cooldownSecs; uint8 minKycLevel; uint64 expiry; uint64 version; address[] allowedTokens; }";

/** `nonce()` returns the next expected nonce (docs/ARCHITECTURE.md). */
export const vyuhVaultAbi = parseAbi([INTENT, "function execute(Intent intent) returns (uint256 amountOut)", "function nonce() view returns (uint256)"]);
export const mandateRegistryAbi = parseAbi([MANDATE, "function getMandate(address vault) view returns (Mandate)"]);
const erc20Abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);
const v3FactoryAbi = parseAbi(["function getPool(address, address, uint24) view returns (address)"]);
const v3PoolAbi = parseAbi([
  "function token0() view returns (address)",
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)",
]);

const env = process.env;
const chainId = Number(env.CHAIN_ID ?? 177);
const chain = chainFor(chainId);
const transport = http(chainId === 177 ? env.HSK_RPC_MAINNET : env.HSK_RPC_TESTNET);

export const client = createPublicClient({ chain, transport });
export const addresses = vyuhAddresses();
export const agent = env.AGENT_PRIVATE_KEY ? privateKeyToAccount(env.AGENT_PRIVATE_KEY as Hex) : undefined;
export const allowSubmit = env.ALLOW_SUBMIT === "true";
/** V3 factory for quotes. Mainnet constant from ARCHITECTURE.md; testnet must set V3_FACTORY. */
const v3Factory = (env.V3_FACTORY || (chainId === 177 ? MAINNET.v3Factory : undefined)) as Address | undefined;

export function need(name: keyof typeof addresses): Address {
  const a = addresses[name];
  if (!a) throw new Error(`${name} address is not configured in env`);
  return a;
}

export async function readMandate(vault: Address): Promise<Mandate> {
  const m = await client.readContract({ address: need("mandateRegistry"), abi: mandateRegistryAbi, functionName: "getMandate", args: [vault] });
  return { ...m, allowedTokens: [...m.allowedTokens] };
}

export async function nextNonce(vault: Address): Promise<bigint> {
  return (await client.readContract({ address: vault, abi: vyuhVaultAbi, functionName: "nonce" }));
}

/** SDK preflight: runs as the vault agent and decodes PolicyViolation reverts. */
export function checkIntent(intent: Intent) {
  return preflight(client, intent, need("policyEngine"), agent?.address);
}

export async function execute(intent: Intent): Promise<Hex> {
  if (!agent) throw new Error("AGENT_PRIVATE_KEY is not set");
  const wallet = createWalletClient({ account: agent, chain, transport });
  return wallet.writeContract({ address: intent.vault, abi: vyuhVaultAbi, functionName: "execute", args: [intent] });
}

export async function poolSpot(tokenIn: Address, tokenOut: Address, fee: number) {
  if (!v3Factory) throw new Error("V3_FACTORY is not set for this chain");
  const pool = await client.readContract({ address: v3Factory, abi: v3FactoryAbi, functionName: "getPool", args: [tokenIn, tokenOut, fee] });
  if (/^0x0+$/.test(pool)) throw new Error(`No V3 pool for this pair at fee ${fee}`);
  const [token0, slot0] = await Promise.all([
    client.readContract({ address: pool, abi: v3PoolAbi, functionName: "token0" }),
    client.readContract({ address: pool, abi: v3PoolAbi, functionName: "slot0" }),
  ]);
  return { pool, sqrtPriceX96: slot0[0], zeroForOne: token0.toLowerCase() === tokenIn.toLowerCase() };
}

export async function tokenBalance(token: Address, holder: Address) {
  const [symbol, decimals, balance] = await Promise.all([
    client.readContract({ address: token, abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [holder] }),
  ]);
  return { token, symbol, decimals, balance };
}
