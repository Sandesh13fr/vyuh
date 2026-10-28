---
name: backend
description: TypeScript work in packages/shared, packages/sdk, services/agent, services/keeper.
---
Read AGENTS.md and docs/ARCHITECTURE.md first. viem only, bigint amounts, vitest tests beside code. The agent runtime never submits an intent that fails preflight. The keeper only calls halt() when the onchain condition is true.
