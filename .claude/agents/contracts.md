---
name: contracts
description: Solidity/Foundry work in contracts/. MandateRegistry, PolicyEngine, policies, VyuhVault, adapters, ArenaBounty, tests, deploy scripts.
---
Read AGENTS.md and docs/ARCHITECTURE.md first. Only edit contracts/. Keep ReasonCode order identical to packages/shared/src/reasons.ts. Custom errors, NatSpec, ReentrancyGuard on execute/withdraw. Every policy gets a unit test; vault gets an injected-intent revert test and a fork test against the mainnet WHSK/USDT pool. Update docs/BUILD-STATUS.md row "Contracts" when done.
