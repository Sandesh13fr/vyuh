import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseAbi,
  parseAbiItem,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { MAINNET, REASON_CODES, chainFor, mandateRegistryAbi, vyuhAddresses, vyuhVaultAbi } from "@vyuh/shared";
import { haltReason } from "./decide";

const aproAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
]);
const kycAbi = parseAbi(["function isHuman(address account) view returns (bool, uint8)"]);
// ASSUMED: VaultFactory event; not in ARCHITECTURE.md yet.
const vaultCreated = parseAbiItem("event VaultCreated(address indexed vault, address indexed owner, address indexed agent)");

const env = (k: string) => process.env[k] || undefined;
const chainId = Number(env("CHAIN_ID") ?? 177);
const chain = chainFor(chainId);
const transport = http(chainId === 177 ? env("HSK_RPC_MAINNET") : env("HSK_RPC_TESTNET"));
const pk = env("KEEPER_PRIVATE_KEY") as Hex | undefined;
const dryRun = env("DRY_RUN") === "1" || env("DRY_RUN") === "true";
const maxOracleAgeSecs = BigInt(env("ORACLE_MAX_AGE_SECS") ?? 3600);
const feed = (env("APRO_FEED") ?? MAINNET.aproHskUsd) as Address;
const addrs = vyuhAddresses();
if (!addrs.mandateRegistry) throw new Error("MANDATE_REGISTRY is not set");
const registry = addrs.mandateRegistry;
if (!pk && !dryRun) throw new Error("KEEPER_PRIVATE_KEY is not set (or use DRY_RUN=1)");

const publicClient = createPublicClient({ chain, transport });
const account = pk ? privateKeyToAccount(pk) : undefined;
const walletClient = account ? createWalletClient({ chain, transport, account }) : undefined;
const log = (o: object) =>
  console.log(JSON.stringify({ t: new Date().toISOString(), ...o }, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

async function loadVaults(): Promise<Address[]> {
  const list = env("VAULTS")?.split(",").map((s) => s.trim()).filter((s): s is Address => isAddress(s));
  if (list?.length) return list;
  if (!addrs.vaultFactory) throw new Error("Set VAULTS or VAULT_FACTORY");
  // ponytail: vault list loaded once at start; restart the keeper after new vaults, or watch VaultCreated if that hurts.
  const logs = await publicClient.getLogs({
    address: addrs.vaultFactory,
    event: vaultCreated,
    fromBlock: BigInt(env("FACTORY_FROM_BLOCK") ?? 0),
  });
  return logs.flatMap((l) => (l.args.vault ? [l.args.vault] : []));
}

async function checkVault(vault: Address, now: bigint) {
  const v = { address: vault, abi: vyuhVaultAbi } as const;
  const [halted, nav, dayStartNav, owner, mandate, round] = await Promise.all([
    publicClient.readContract({ ...v, functionName: "halted" }),
    publicClient.readContract({ ...v, functionName: "nav" }),
    publicClient.readContract({ ...v, functionName: "dayStartNav" }),
    publicClient.readContract({ ...v, functionName: "owner" }),
    publicClient.readContract({ address: registry, abi: mandateRegistryAbi, functionName: "getMandate", args: [vault] }),
    publicClient.readContract({ address: feed, abi: aproAbi, functionName: "latestRoundData" }),
  ]);
  const kycLevel = addrs.kycSbt
    ? (await publicClient.readContract({ address: addrs.kycSbt, abi: kycAbi, functionName: "isHuman", args: [owner] }))[1]
    : null;
  const reason = haltReason({
    halted,
    now,
    oracleUpdatedAt: round[3],
    maxOracleAgeSecs,
    nav,
    dayStartNav,
    dailyLossBps: mandate.dailyLossBps,
    kycLevel,
    minKycLevel: mandate.minKycLevel,
  });
  if (!reason) return;

  // Our check said halt; the contract must agree before we spend gas.
  const { request } = await publicClient.simulateContract({
    ...v,
    functionName: "halt",
    args: [REASON_CODES.indexOf(reason)],
    account: account ?? owner,
  });
  if (dryRun || !walletClient) return log({ vault, reason, action: "would halt (dry run)" });
  const hash = await walletClient.writeContract(request);
  log({ vault, reason, action: "halt sent", hash });
}

const vaults = await loadVaults();
log({ msg: "keeper start", vaults, dryRun, maxOracleAgeSecs });
let busy = false;
publicClient.watchBlocks({
  onBlock: async (block) => {
    if (busy) return; // ponytail: skip a block rather than queue; one check per ~2 s block is the target.
    busy = true;
    try {
      const results = await Promise.allSettled(vaults.map((vault) => checkVault(vault, block.timestamp)));
      results.forEach((r, i) => r.status === "rejected" && log({ vault: vaults[i], error: String(r.reason) }));
    } finally {
      busy = false;
    }
  },
  onError: (e) => log({ error: String(e) }),
});
