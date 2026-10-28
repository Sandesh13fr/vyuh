# AGENTS.md

Rules for every agent (Claude, Codex, Cursor, humans) working in this repo.

## Product in one line

Vyuh: onchain guardrails for AI trading agents on HashKey Chain. The LLM proposes, the contract decides. The Arena lets anyone try to jailbreak a real-money agent; the seven policy rings must hold.

Hackathon: HSK Chain Horizon (DoraHacks), Track 1 AI Agent Trading. Submit by **1 Nov 2026, 21:30 IST**. Demo Day 4 Nov, Mumbai.

## Read first

1. `docs/ARCHITECTURE.md`: canonical types, contracts, events, API. Shared truth.
2. `docs/PRD.md`: scope and requirements (FR-1..FR-13).
3. `docs/ROADMAP.md`: phases and exit checks.
4. `DESIGN.md` and `PRODUCT.md`: brand and UI rules (web work only).

## Non-negotiable rules

- **Non-custodial.** Owner can always withdraw, even when halted. The agent key is an operator, never an owner.
- **The contract is the guard.** Never move a policy check offchain only. Offchain preflight mirrors onchain checks; it never replaces them.
- **Agent may only tighten.** Loosening any mandate field needs a fresh owner EIP-712 signature.
- **No paid arena attempts.** India Online Gaming Act 2025. Attempts are free; the pot is a bug bounty; payouts need KYC SBT or allowlist.
- **Never commit secrets.** Keys live in `.env` (gitignored). `.env.example` lists every variable.
- **Label mocks.** Anything mocked (KYC on testnet, prices in tests) is labelled in UI and README.
- **Hackathon rule:** code is written during the hackathon. Do not paste in other repos wholesale. MIT snippets allowed with attribution in `AI_USAGE.md`.

## Conventions

- Monorepo, pnpm workspaces. Node 22+. TypeScript strict, ESM.
- Solidity `^0.8.24`, Foundry, OpenZeppelin 5. Custom errors, not revert strings. NatSpec on every external function.
- One `ReasonCode` enum, mirrored exactly in `@vyuh/shared` (`packages/shared/src/reasons.ts`). Change both together.
- viem for chain access. No ethers.
- Amounts are `bigint` in TS, never `number`.
- Web: Next.js App Router + Radix UI primitives + CSS variables from `apps/web/src/styles/tokens.css`. No Tailwind component kits, no shadcn copy-paste. Icons: `@radix-ui/react-icons`.
- Small files, small functions. Comments explain why, not what.
- Tests sit beside the code: `contracts/test/*.t.sol`, `src/**/*.test.ts` (vitest).

## Ownership (avoid two writers on one folder)

| Folder | Owner |
|---|---|
| `contracts/` | contracts agent |
| `packages/shared`, `packages/sdk` | backend agent |
| `services/agent`, `services/keeper` | backend agent |
| `services/mcp`, `services/indexer` | integrations agent |
| `apps/web` | web agent |
| `docs/`, root files, `DESIGN.md`, `brand/` | lead session |

## Commands

```bash
pnpm install
pnpm contracts:build && pnpm contracts:test
pnpm typecheck && pnpm test
pnpm dev:web            # http://localhost:3000
pnpm dev:indexer        # http://localhost:42069
```

## Done means

Builds, types check, tests pass, `docs/BUILD-STATUS.md` updated with what changed and what is still mocked.
