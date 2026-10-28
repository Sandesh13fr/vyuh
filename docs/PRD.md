# Vyuh PRD v1

Visual version: [prd.html](prd.html). Interfaces: [ARCHITECTURE.md](ARCHITECTURE.md).

## Problem
AI agents can hold keys and trade. The LLM deciding a trade can be prompt-injected, hallucinate or chase losses. Today the only safety is a system prompt and offchain checks, which the same compromise bypasses. Funds and regulated users on HashKey will not delegate capital to an agent whose limits live in a prompt.

## Solution
- **Vyuh layer:** owner-signed EIP-712 Risk Mandate; every agent trade is a structured intent checked onchain by seven policy rings before it touches HSKSwap. Agent can tighten, never loosen. KYC SBT tier sets the ceiling. Daily loss from oracle NAV auto-halts.
- **Vyuh Arena:** a live agent with a real USDT pot behind Vyuh. Anyone can try to jailbreak it. Fool the LLM and get a small bounty when the contract still blocks you (tier 1). Move funds past the contract and take the pot (tier 2).

## Users
| Who | Job | Gets |
|---|---|---|
| Retail trader | Let an agent trade without fear of a drain | Vault, mandate, live P&L, one-tap halt |
| Agent builder | Ship an agent users trust | MCP server, `@vyuh/guard`, reason codes |
| Institution | Delegate to AI with compliance | KYC tiers, audit export |
| Attacker crowd | Break the agent | Arena chat, leaderboard, payouts |

## Success metrics (targets for 4 Nov, not results)
| Goal | Metric | Target |
|---|---|---|
| Real onchain trading | Swaps on HSK mainnet | >= 20 receipts |
| Guardrails hold | Malicious intents reverted / attempted | 100% |
| Crowd proof | Arena attempts logged | >= 200 |
| Ecosystem fit | External LLM client trades via MCP | Claude Desktop demo |
| Verifiable P&L | Onchain NAV vs indexer | within 0.5% |

## Scope
- **Must:** MandateRegistry, PolicyEngine + 7 policies, VyuhVault + factory, HSKSwap V3 adapter, receipts, permissionless halt, agent runtime with preflight, keeper, indexer, arena UI + ArenaBounty.
- **Should:** MCP server, audit export, `@vyuh/guard` SDK, AgentRegistry with P&L reputation.
- **Later:** operator bond and slashing, HSP fee settlement, IPFS reasoning store, more DEX adapters, ERC-4337.

## Functional requirements
### Contracts
- **FR-1** Owner signs EIP-712 mandate: per-trade cap, max position, allowlist, max slippage, oracle band, daily loss %, cooldown, expiry, min KYC level.
- **FR-2** Vault executes only intents passing every policy; failure reverts `PolicyViolation(code, ring)`.
- **FR-3** Agent may `tighten()`; loosening needs a fresh owner signature.
- **FR-4** Anyone may `halt()` when KYC revoked, daily loss hit or oracle stale.
- **FR-5** Each trade emits `TradeExecuted` with intentHash, reasoningHash, NAV before/after.
- **FR-6** Owner can withdraw everything any time, including while halted.
### Backend
- **FR-7** Runtime turns signals into structured intents, preflights `checkIntent()`, submits only on OK.
- **FR-8** Keeper watches oracle staleness, SBT status, loss limit; halts within one block.
- **FR-9** Indexer serves receipts, NAV series, attempts, leaderboard over REST.
- **FR-10** MCP server: get_mandate, quote, propose_trade, get_positions, get_pnl, explain_rejection.
### Arena
- **FR-11** Public chat with the honeypot agent; each attempt logs prompt hash, intent and reason code onchain.
- **FR-12** Tier 1 bounty when the LLM emits a malicious intent the contract blocks; tier 2 pot if funds move past the contract.
- **FR-13** Payout requires KYC SBT or allowlist. Attempts are free.

## Constraints
| Area | Requirement |
|---|---|
| Security | Non-custodial; agent key is operator only; reentrancy guard on execute and withdraw |
| Legal | No paid attempts (India Online Gaming Act 2025); pot is a bug bounty; KYC on payout |
| Rules | Deployed on HSK mainnet (177); built during hackathon; uses HashKey products |
| Speed | Preflight < 300 ms; keeper reacts within one block (~2 s) |
| Honesty | Mocks labelled in UI and README |

## Risks
| Risk | Mitigation |
|---|---|
| Scope too big | Hard cut list; MCP and SDK drop before arena |
| DEX may not be "HSKSwap" | Confirm day 1; adapter isolates the swap |
| No mainnet KYC SBT | Allowlist fallback, mock SBT on testnet |
| Contract bug drains pot | Small pot, fork + invariant tests, owner pause |
| Prior art (sentinel-mantle etc.) | Lead with onchain mandate + KYC + live arena |

## Business model
10% fee on verified profit · `@vyuh/guard` SDK licences · paid red-team listings for other agents · Vyuh security score API.
