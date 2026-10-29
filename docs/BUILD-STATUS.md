# Build status

Updated by the lead session. Last update: 29 Oct 2026, Phase 1 contracts tested.

## Verified
| Check | Result |
|---|---|
| `pnpm -r typecheck` | 7/7 packages pass |
| `pnpm -r test` | 34 tests pass (shared 2, sdk 7, agent 10, keeper 9, mcp 6) |
| `contracts: npm run test:hh` | 52 Solidity tests pass (unit, fuzz, invariant) via Hardhat 3 |
| `contracts: npm run test:fork` | 4/4 pass on live HashKey mainnet (pool read, APRO access, TWAP, real router swap) |
| `contracts: npm run compile:solc` | 43 files, 0 errors |
| `pnpm --filter @vyuh/web build` | all routes build; landing checked in browser |

## Mainnet findings (29 Oct)
- Router is SwapRouter v1; adapter swaps through it. ✅
- APRO feeds block contract reads ("No access"). Mainnet uses `V3TwapFeed` until APRO whitelists us (`APRO_WHITELISTED=true` switches).
- HashKey DEX liquidity is dust (WHSK/USDT pools hold under $0.01 of USDT). Demo needs our own seeded liquidity.
- See docs/ARCHITECTURE.md "Verified on mainnet".

## Fixed this round
- Test bug: `_intent()` read `vault.nonce()` between `vm.prank`/`expectRevert` and `execute` (8 false failures).
- SDK preflight now calls from the vault agent (checkIntent requires msg.sender == agent; previously every real preflight would have returned NOT_AGENT).
- SDK decodes `PolicyViolation` reverts from checkIntent as blocked; other reverts fail closed; same-token intents rejected before any call.
- MCP server now uses the SDK preflight.
- POSITION_CAP reports ring 0 (post-ring), not ring 1.
- Landing: removed label above the hero heading.

## Not yet verified
- `forge script` deploy (Foundry not installed; Hardhat cannot broadcast). Run `foundryup`, then the README deploy steps.
- Indexer against a chain (needs deployed addresses, then `pnpm --filter @vyuh/indexer codegen`).
- Wallet flows in console (need a deployed vault).

## Open issues
- Ask organisers: which DEX is "HSKSwap"? Ask APRO: whitelist our OracleRegistry.
- Thin-pool TWAP can be moved cheaply; acceptable for demo, APRO preferred for production.
- `AgentRegistry.recordPnl` not wired (vault does not know agentId).

## Mocks in use
- KYC SBT: mock on testnet, allowlist on mainnet (no published mainnet address).
- Testnet deploy uses MOCK USDT, WHSK, oracle and router (no stablecoin on HSK testnet).
- Web: demo data when indexer unreachable; demo arena reply when AGENT_URL unset. All labelled.
