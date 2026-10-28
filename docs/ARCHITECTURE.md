# Vyuh architecture

Source of truth for shared interfaces. Contracts, services, SDK and web all follow the names and shapes below. Change this file first, then the code.

## System

```
LLM agent (runtime / MCP client / arena chat)
   │  structured Intent + reasoningHash
   ▼
Preflight: PolicyEngine.checkIntent()  (eth_call, free)
   │  ReasonCode.OK only
   ▼
VyuhVault.execute(intent)  ──► PolicyEngine.enforce()  ──► 7 policy modules
   │                                                         (rings)
   ▼
IExecutionAdapter (HskSwapV3Adapter) ──► HSKSwap V3 router
   │
   ▼
TradeExecuted receipt event ──► Ponder indexer ──► REST API ──► web / MCP / audit export
                         Keeper watches oracle, SBT, loss ──► VyuhVault.halt()
```

## Packages

| Path | Package | Owns |
|---|---|---|
| `contracts/` | Foundry | All Solidity |
| `packages/shared` | `@vyuh/shared` | Chain config, addresses, reason codes, TS types, ABIs |
| `packages/sdk` | `@vyuh/guard` | `guardedSwap()`, intent builder, preflight helper |
| `services/agent` | `@vyuh/agent` | LLM trading runtime |
| `services/keeper` | `@vyuh/keeper` | Watchdog, calls `halt()` |
| `services/mcp` | `@vyuh/mcp` | MCP server for external LLM clients |
| `services/indexer` | `@vyuh/indexer` | Ponder indexer + REST API + audit export |
| `apps/web` | `@vyuh/web` | Next.js + Radix UI: dashboard, mandate signer, arena |

## Policy rings (order matters, first failure wins)

| Ring | Module | Checks | ReasonCode |
|---|---|---|---|
| 1 | `SpendCapPolicy` | `amountInUsd <= maxTradeUsd` | `SPEND_CAP` |
| 2 | `AllowlistPolicy` | tokenIn and tokenOut in mandate allowlist | `ALLOWLIST` |
| 3 | `OracleBandPolicy` | implied price within `oracleBandBps` of APRO price; oracle fresh | `ORACLE_BAND` / `ORACLE_STALE` |
| 4 | `SlippagePolicy` | `minAmountOut` within `maxSlippageBps` of oracle quote | `SLIPPAGE` |
| 5 | `DailyLossPolicy` | NAV drop since UTC day start `< dailyLossBps` | `DAILY_LOSS` |
| 6 | `KycTierPolicy` | owner `IKycSBT.isHuman` level `>= minKycLevel` (allowlist fallback) | `KYC_TIER` |
| 7 | `CooldownPolicy` | `block.timestamp >= lastTrade + cooldownSecs` | `COOLDOWN` |

Pre-ring checks in the vault: `HALTED`, `NOT_AGENT`, `EXPIRED`, `BAD_NONCE`.

## Solidity types (canonical)

```solidity
enum ReasonCode {
    OK, HALTED, NOT_AGENT, EXPIRED, BAD_NONCE,
    SPEND_CAP, ALLOWLIST, ORACLE_BAND, ORACLE_STALE, SLIPPAGE,
    DAILY_LOSS, KYC_TIER, COOLDOWN, POSITION_CAP
}

struct Mandate {
    address owner;
    address agent;            // operator EOA
    uint256 maxTradeUsd;      // 1e18 = $1
    uint256 maxPositionUsd;   // per non-stable token
    uint16  maxSlippageBps;
    uint16  oracleBandBps;
    uint16  dailyLossBps;
    uint32  cooldownSecs;
    uint8   minKycLevel;      // IKycSBT levels: 0 NONE .. 4 ULTIMATE
    uint64  expiry;
    uint64  version;          // monotonically increasing
    address[] allowedTokens;
}

struct Intent {
    address vault;
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 minAmountOut;
    uint24  fee;              // V3 pool fee tier
    uint64  deadline;
    uint256 nonce;            // vault-scoped, strictly increasing
    bytes32 reasoningHash;    // keccak256 of the agent's reasoning JSON
}
```

EIP-712 domain: `name="Vyuh"`, `version="1"`, `chainId`, `verifyingContract=MandateRegistry`.

## Contracts

| Contract | Key functions |
|---|---|
| `MandateRegistry` | `setMandate(vault, Mandate, sig)` (owner sig), `tighten(vault, Mandate)` (agent; every field must be stricter or equal), `getMandate(vault)` |
| `PolicyEngine` | `checkIntent(Intent) view returns (ReasonCode code, uint8 ring)`, `enforce(Intent)` reverts `PolicyViolation(ReasonCode, uint8 ring)` |
| `VyuhVault` | `execute(Intent) returns (uint256 amountOut)`, `halt(ReasonCode)` permissionless when condition true, `ownerHalt()`, `resume()` owner, `withdraw(token, amount)` owner always, `nav() view`; views `owner()`, `agent()`, `halted()`, `nonce()` (next expected), `dayStartNav()` |
| `VaultFactory` | `createVault(owner, agent) returns (vault)` EIP-1167 clones; emits `VaultCreated(vault, owner, agent)` |
| `HskSwapV3Adapter` | `swap(tokenIn, tokenOut, fee, amountIn, minOut, recipient)` |
| `AgentRegistry` | `register(agentId, operator, metadataURI)`, `recordPnl` (vault only) |
| `ArenaBounty` | `recordAttempt(attemptId, attacker, promptHash, intentHash, ReasonCode)` operator, `payTier1(attemptId)` operator, KYC/allowlist gated |

### Events

```solidity
event MandateSet(address indexed vault, bytes32 mandateHash, uint64 version, bool tightenedByAgent);
event TradeExecuted(address indexed vault, bytes32 indexed intentHash, bytes32 reasoningHash,
    address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 navBefore, uint256 navAfter);
event Halted(address indexed vault, ReasonCode reason, address caller);
event Resumed(address indexed vault);
event VaultCreated(address indexed vault, address indexed owner, address indexed agent);
// intentHash = keccak256(abi.encode(intent)); PolicyViolation(ReasonCode code, uint8 ring)
event AttemptRecorded(bytes32 indexed attemptId, address indexed attacker, bytes32 promptHash, bytes32 intentHash, ReasonCode code);
event BountyPaid(bytes32 indexed attemptId, address indexed attacker, uint256 amount);
```

## Mainnet constants (chain 177)

| Name | Address |
|---|---|
| SwapRouter (V3) | `0x1f3858C46F8F6fE76260b8208995D228C5cddc64` |
| Factory (V3) | `0xD136e36610f35E0Cc3cAd40de858c151f2AA65D4` |
| WHSK/USDT pool | `0xEB33d6666dd2359cB1BF6Ea6D72286Cc1b4a778A` |
| WHSK | `0xB210D2120d57b758EE163cFfb43e73728c471Cf1` |
| USDT | `0xF1B50eD67A9e2CC94Ad3c477779E2d4cBfFf9029` |
| USDC | `0x054ed45810DbBAb8B27668922D110669c9D88D0a` |
| APRO HSK/USD | `0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b` |
| APRO BTC/USD | `0x204ED500ab56A2E19B051561258E3A45c850360F` |
| KYC SBT | unpublished, allowlist fallback |

Open: confirm the V3 router is the official "HSKSwap".

## REST API (indexer)

| Route | Returns |
|---|---|
| `GET /vaults/:address` | mandate, status, NAV, P&L |
| `GET /vaults/:address/receipts` | TradeExecuted list |
| `GET /vaults/:address/nav` | NAV series |
| `GET /arena/attempts?limit=` | latest attempts with reason codes |
| `GET /arena/leaderboard` | attackers by tier-1 wins |
| `GET /agents/:id` | reputation |
| `GET /audit/:vault.csv` | full decision export |

## MCP tools

`get_mandate`, `quote`, `propose_trade`, `get_positions`, `get_pnl`, `explain_rejection`.
`propose_trade` always preflights and returns the ReasonCode in plain words before sending.
