# AI usage

Hackathon disclosure of AI tools used to build Vyuh.

| Date | Tool | Used for |
|---|---|---|
| 2026-10-28 | Claude Code (Opus 5.5), lead session | Research, PRD, roadmap, architecture spec, repo scaffold, agent files, brand tokens/logo/guidelines, integration and verification |
| 2026-10-29 | Claude Code (Opus 5.5) | Hardhat 3 test path, mainnet fork verification, V3TwapFeed, SDK preflight fixes |
| 2026-10-28 | Codex CLI | First pass of Solidity sources in contracts/src (stopped at usage limit) |
| 2026-10-28 | Claude Code subagents | Contract review, tests, deploy script; SDK, agent, keeper; MCP server, indexer; Next.js + Radix web app; HTML mockups |

Skills used: impeccable (brand and UI direction), solidity-security, web3-testing, property-based-testing, vercel-react-best-practices, viem-integration.

Runtime AI: the trading agent and arena honeypot call an LLM (Anthropic API) to propose intents. The LLM never holds custody; every intent is enforced onchain.

## Third-party code
No external repo code copied. Dependencies: OpenZeppelin Contracts 5.1 (MIT), forge-std (MIT/Apache-2.0), viem, wagmi, RainbowKit, Radix UI, Next.js, Ponder, MCP SDK.
