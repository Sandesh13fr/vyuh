# Build status

Updated by the lead session. Last update: 28 Oct 2026, end of Phase 0.

## Verified
| Check | Result |
|---|---|
| `pnpm install` | ok (pnpm 11, `allowBuilds` in pnpm-workspace.yaml) |
| `pnpm -r typecheck` | 7/7 packages pass |
| `pnpm -r test` | 30 tests pass (shared 2, sdk 3, agent 10, keeper 9, mcp 6) |
| `contracts: npm run compile:solc` | 40 files, 101 contracts, 0 errors (solc-js 0.8.24) |
| `pnpm --filter @vyuh/web build` | all routes build; `/`, `/arena` render in brand |
| MCP `quote` | live mainnet read of WHSK/USDT pool works |

## Not yet verified
- `forge test` (unit, invariant, fork): Foundry not installed on this machine. Run `foundryup`, then `pnpm contracts:test`.
- Indexer against a chain: needs deployed contract addresses, then `pnpm --filter @vyuh/indexer codegen`.
- Wallet flows in console (sign mandate, halt, withdraw): need a deployed vault.

## Areas
| Area | State | Notes |
|---|---|---|
| Repo, agent files, docs | done | AGENTS.md, CLAUDE.md, PRODUCT.md, DESIGN.md, docs/* |
| Brand | done | brand/tokens.css, brand/logo/*, brand/guidelines.html |
| Mockups | done | design/mockups/* (static HTML, demo data) |
| Contracts | written, compiles | tests written, not run. OZ pinned ~5.1.0 (paris EVM) |
| shared / sdk | done | ABIs hand-written to match contracts |
| agent / keeper | done | `pnpm dev:arena` serves POST /arena on :8787 |
| mcp / indexer | done | indexer untested against chain |
| web | done | demo-data fallbacks when indexer/agent unset |

## Open issues
- Confirm mainnet router is SwapRouter v1 (`exactInputSingle` with deadline). If SwapRouter02, adapter must change. Fork test `test_adapterSwapsOnRealRouter` decides.
- Check APRO heartbeat on HashKey; `ORACLE_MAX_AGE_SECS` default 3600 may be too tight.
- `checkIntent` can revert (stale oracle inside `nav()`) instead of returning ORACLE_STALE; SDK should treat revert as blocked.
- `checkIntent` returns OK for tokenIn == tokenOut; vault rejects it. Add a ReasonCode or SDK guard.
- POSITION_CAP reports ring 1; UI shows it as "before the rings". Decide a dedicated ring value.
- `AgentRegistry.recordPnl` not wired (vault does not know agentId).
- Web landing has a small label above the hero heading; DESIGN.md rules say remove it.

## Mocks in use
- KYC SBT: mock on testnet, allowlist on mainnet (no published mainnet address).
- Testnet deploy uses MOCK USDT, WHSK, oracle and router (no stablecoin on HSK testnet).
- Web: demo data when indexer unreachable; demo arena reply when AGENT_URL unset. All labelled.
