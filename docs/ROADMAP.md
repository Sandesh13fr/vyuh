# Roadmap

Submission deadline: **1 Nov 2026, 21:30 IST**. Demo Day: 4 Nov, Mumbai.

## Phase 0 · 28 Oct · Prep
- [x] Monorepo, agent instruction files, docs
- [x] Contract tests running (Hardhat 3 fallback; Foundry still needed to deploy)
- [ ] Install Foundry; fund deployer (~2 HSK, ~20 USDT + liquidity to seed a pool)
- [ ] Confirm HSKSwap router and DoraHacks submission format
- **Exit:** mainnet fork test reads the WHSK/USDT pool ✅ (and swaps through the real router)

## Phase 1 · 29 Oct · Core contracts
- [x] MandateRegistry (EIP-712, tighten-only for agent)
- [x] PolicyEngine + 7 policy modules
- [x] VyuhVault + VaultFactory, HskSwapV3Adapter
- [x] Unit, fork and invariant tests (52 passing + 4 mainnet fork)
- **Exit:** an injected intent reverts in a test ✅

## Phase 2 · 30 Oct · Agent and backend
- [ ] Deploy testnet then mainnet
- [ ] Agent runtime with preflight
- [ ] Keeper
- [ ] Ponder indexer
- **Exit:** first real mainnet receipt

## Phase 3 · 31 Oct · Arena and integrations
- [ ] ArenaBounty + arena chat
- [ ] MCP server, audit export
- [ ] Console: mandate, receipts, P&L
- **Exit:** Claude Desktop trades through Vyuh

## Phase 4 · 1 Nov · Ship
- [ ] README, demo video, deck
- [ ] DoraHacks submission before 21:30 IST
- **Exit:** submitted with verified contracts

## Phase 5 · 4 Nov · Demo Day
- [ ] Fund the pot, open the Arena via QR
- [ ] Live wall of blocked attacks

## After the hackathon
Audit · capped mainnet beta · publish SDK and score API · operator bonds · HSP fee settlement · more DEXs · paid red-team listings.
