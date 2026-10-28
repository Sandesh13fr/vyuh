import { isAddressEqual, parseAbi, type Address } from "viem";
import { MAINNET, erc20Abi } from "@vyuh/shared";
import type { ReadClient } from "@vyuh/guard";

// Only sqrtPriceX96 is decoded, so V3 forks with a different feeProtocol width still work.
const poolAbi = parseAbi([
  "function slot0() view returns (uint160 sqrtPriceX96, int24 tick)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
]);
const aproAbi = parseAbi([
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
]);

export interface Market {
  pool: Address;
  token0: Address;
  token1: Address;
  decimals0: number;
  decimals1: number;
  fee: number;
  sqrtPriceX96: bigint;
  /** APRO HSK/USD answer, scaled by oracleDecimals. */
  oraclePrice: bigint;
  oracleDecimals: number;
  oracleUpdatedAt: bigint;
}

export async function readMarket(
  client: ReadClient,
  pool: Address = MAINNET.whskUsdtPool,
  feed: Address = MAINNET.aproHskUsd,
): Promise<Market> {
  const [[sqrtPriceX96], token0, token1, fee, round, oracleDecimals] = await Promise.all([
    client.readContract({ address: pool, abi: poolAbi, functionName: "slot0" }),
    client.readContract({ address: pool, abi: poolAbi, functionName: "token0" }),
    client.readContract({ address: pool, abi: poolAbi, functionName: "token1" }),
    client.readContract({ address: pool, abi: poolAbi, functionName: "fee" }),
    client.readContract({ address: feed, abi: aproAbi, functionName: "latestRoundData" }),
    client.readContract({ address: feed, abi: aproAbi, functionName: "decimals" }),
  ]);
  const [decimals0, decimals1] = await Promise.all(
    [token0, token1].map((t) => client.readContract({ address: t, abi: erc20Abi, functionName: "decimals" })),
  );
  return {
    pool,
    token0,
    token1,
    decimals0: decimals0 ?? 18,
    decimals1: decimals1 ?? 18,
    fee,
    sqrtPriceX96,
    oraclePrice: round[1],
    oracleDecimals,
    oracleUpdatedAt: round[3],
  };
}

/** Pool spot quote in raw units (decimals cancel). 0 for a token outside the pool. */
export function quoteOut(m: Market, tokenIn: Address, amountIn: bigint): bigint {
  const p = m.sqrtPriceX96 * m.sqrtPriceX96;
  const q192 = 1n << 192n;
  if (isAddressEqual(tokenIn, m.token0)) return (amountIn * p) / q192;
  if (isAddressEqual(tokenIn, m.token1)) return p === 0n ? 0n : (amountIn * q192) / p;
  return 0n;
}

/** Human-readable snapshot for the LLM prompt. Numbers here are display only. */
export function describeMarket(m: Market): string {
  const poolPrice = (Number(m.sqrtPriceX96) / 2 ** 96) ** 2 * 10 ** (m.decimals0 - m.decimals1);
  const oracle = Number(m.oraclePrice) / 10 ** m.oracleDecimals;
  return [
    `Pool ${m.pool} fee ${m.fee}`,
    `token0 ${m.token0} (${m.decimals0} decimals), token1 ${m.token1} (${m.decimals1} decimals)`,
    `Pool price: 1 token0 = ${poolPrice} token1`,
    `APRO HSK/USD oracle: ${oracle} (updatedAt unix ${m.oracleUpdatedAt})`,
  ].join("\n");
}
