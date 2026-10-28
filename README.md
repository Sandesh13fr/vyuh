# Vyuh

**Agents trade. Vyuh holds.**

Onchain guardrails for AI trading agents on HashKey Chain. The LLM proposes a trade; seven policy rings in the contract decide. The Arena invites anyone to jailbreak a real-money agent and proves the rings hold.

Built for HSK Chain Horizon Hackathon, Track 1: AI Agent Trading.

## How it works

1. Owner signs a Risk Mandate (EIP-712): trade cap, allowlist, slippage, oracle band, daily loss, KYC tier, cooldown.
2. Agent turns a signal into a structured intent and preflights it for free.
3. `VyuhVault` enforces all seven rings, swaps on HSKSwap, emits a receipt with NAV before and after.
4. Keeper halts the vault the block a limit is hit. Owner can always withdraw.
5. Any LLM client can trade through Vyuh via the MCP server.

## Repo

```
contracts/          Foundry: MandateRegistry, PolicyEngine + 7 policies, VyuhVault, adapters, ArenaBounty
packages/shared     chain config, addresses, ReasonCode, types
packages/sdk        @vyuh/guard
services/agent      LLM trading runtime
services/keeper     watchdog
services/mcp        MCP server
services/indexer    Ponder indexer + REST + audit export
apps/web            Next.js + Radix UI: landing, arena, console
brand/              brand toolkit and guidelines
docs/               PRD, roadmap, architecture, build status
```

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm contracts:build && pnpm contracts:test   # needs Foundry
pnpm dev:web
```

## Status

See [docs/BUILD-STATUS.md](docs/BUILD-STATUS.md). Mocks in use are listed there.
