# Vyuh contracts

Solidity layer of Vyuh: owner-signed mandates, seven policy rings, non-custodial vaults, HSKSwap V3 adapter, arena bounty. Spec: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md). `ReasonCode` order is mirrored in `packages/shared/src/reasons.ts`; change both together.

Solidity 0.8.24, EVM `paris`, OpenZeppelin 5.1 (pinned `~5.1.0`: 5.2+ uses `mcopy`, which needs `cancun`).

## Layout

| Path | What |
|---|---|
| `src/types/VyuhTypes.sol` | `ReasonCode`, `Mandate`, `Intent`, errors, events |
| `src/MandateRegistry.sol` | EIP-712 mandates (`name="Vyuh"`, `version="1"`), agent `tighten` |
| `src/PolicyEngine.sol` | `checkIntent` (preflight) and `enforce`; rings run in order, first failure wins |
| `src/policies/*` | Rings 1-7: SpendCap, Allowlist, OracleBand, Slippage, DailyLoss, KycTier, Cooldown |
| `src/OracleRegistry.sol` | APRO (Chainlink-style) prices, fail-closed staleness, $1 for registered stables |
| `src/VyuhVault.sol` | `execute`, permissionless `halt`, owner `withdraw` (always works, even halted) |
| `src/VaultFactory.sol` | EIP-1167 clones |
| `src/adapters/HskSwapV3Adapter.sol` | `exactInputSingle` on the HSKSwap V3 router |
| `src/AgentRegistry.sol`, `src/arena/ArenaBounty.sol` | Agent reputation, free arena attempts + KYC-gated tier-1 bounty |
| `test/mocks/*` | **MOCK** ERC20, APRO feed, KYC SBT, swap router (tests and testnet only) |
| `script/Deploy.s.sol` | Deploy and wire everything; prints `.env` lines |

## Install

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
cd contracts
npm install        # OpenZeppelin + forge-std into node_modules (see remappings.txt)
```

## Build and test

```bash
forge build
forge test -vvv                       # unit + invariant; fork tests skip without RPC
forge test --match-contract OwnerWithdrawInvariant -vvv
```

No Foundry? `npm run compile:solc` compile-checks `src/`, `test/` and `script/` with solc-js (writes nothing).

## Fork test (HashKey mainnet, read-only)

Reads the WHSK/USDT pool `slot0`/`liquidity`, the APRO HSK/USD feed, and swaps 1 WHSK through the adapter on the real router (proves the router speaks SwapRouter v1 `exactInputSingle` with a deadline).

```bash
HSK_RPC_MAINNET=https://mainnet.hsk.xyz forge test --match-path test/fork/HskFork.t.sol -vvv
```

## Deploy

Env (from repo `.env`): `DEPLOYER_PRIVATE_KEY` (required), `AGENT_PRIVATE_KEY` (creates the arena vault owned by the deployer), `ARENA_OPERATOR_PRIVATE_KEY`, optional `KYC_SBT` (unset = allowlist fallback, deployer is allowlisted at level 1), `ORACLE_MAX_AGE_SECS` (default 3600; check the APRO heartbeat), `ARENA_BOUNTY_USDT` (base units, default `5000000` = 5 USDT).

```bash
set -a; source ../.env; set +a

# Testnet (chain 133): deploys MOCK USDT/WHSK, MOCK APRO feed (always fresh) and MOCK router
forge script script/Deploy.s.sol --rpc-url https://testnet.hsk.xyz --broadcast

# Mainnet (chain 177): real HSKSwap router, WHSK, USDT, USDC, APRO HSK/USD
forge script script/Deploy.s.sol --rpc-url https://mainnet.hsk.xyz --broadcast \
  --verify --verifier blockscout --verifier-url https://hashkey.blockscout.com/api/
```

The script prints `MANDATE_REGISTRY=...`, `POLICY_ENGINE=...`, `VAULT_FACTORY=...`, `AGENT_REGISTRY=...`, `ARENA_BOUNTY=...`, `ARENA_VAULT=...`, `KYC_SBT=...` and helper addresses; paste them into `.env`.

After deploy: the owner signs a mandate (`MandateRegistry.mandateDigest`) and calls `setMandate`; fund the arena pot with `ArenaBounty.fund` after approving USDT.

## Verify an existing deployment

```bash
forge verify-contract <address> src/MandateRegistry.sol:MandateRegistry \
  --chain-id 177 --verifier blockscout --verifier-url https://hashkey.blockscout.com/api/
```

Add `--constructor-args $(cast abi-encode "constructor(...)" ...)` for contracts with constructor arguments.
## Mocks

Anything under `test/mocks/` is a mock and is labelled `MOCK` in deploy output: tokens anyone can mint, an APRO feed with a settable price, a KYC SBT with settable levels, a router that mints output at a fixed rate. Mainnet deploys use none of them.
