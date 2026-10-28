# @vyuh/mcp

MCP server (stdio) that lets any MCP client (Claude Desktop, Claude Code, Cursor) trade through a Vyuh vault. The LLM proposes; the onchain PolicyEngine decides.

| Tool | What it does | Source |
|---|---|---|
| `get_mandate` | Mandate caps, allowlist, slippage, cooldown, expiry | indexer, falls back to `MandateRegistry.getMandate` |
| `quote` | Spot V3 quote after fee + `minAmountOut` for a slippage | HSKSwap V3 pool `slot0` |
| `propose_trade` | Builds the Intent, preflights `PolicyEngine.checkIntent` (eth_call), returns the ReasonCode in plain words, submits `VyuhVault.execute` only if `OK` **and** `ALLOW_SUBMIT=true` | chain |
| `get_positions` | Vault balances for every allowlisted token | chain (allowlist from indexer) |
| `get_pnl` | NAV and trading P&L | indexer |
| `explain_rejection` | Plain-words ReasonCode + ring | `@vyuh/shared` |

Preflight mirrors the contract; it never replaces it. `execute` re-runs every ring onchain.

## Env

Read from the repo-root `.env` if present, else from the client config `env` block.

| Var | Needed for |
|---|---|
| `CHAIN_ID` | 177 mainnet (default) or 133 testnet |
| `HSK_RPC_MAINNET` / `HSK_RPC_TESTNET` | chain reads |
| `MANDATE_REGISTRY`, `POLICY_ENGINE` | mandate fallback, preflight |
| `INDEXER_URL` | default `http://localhost:42069` |
| `AGENT_PRIVATE_KEY` | preflight as the agent (else `NOT_AGENT` is possible) and submit |
| `ALLOW_SUBMIT` | `true` to send passing intents; anything else = preflight only |
| `V3_FACTORY` | quotes on testnet (mainnet uses the ARCHITECTURE.md constant) |

## Claude Desktop

Run `pnpm install` at the repo root first. Then add to `claude_desktop_config.json`
(macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`), using absolute paths:

```json
{
  "mcpServers": {
    "vyuh": {
      "command": "node",
      "args": [
        "/ABS/PATH/Vyuh/services/mcp/node_modules/tsx/dist/cli.mjs",
        "/ABS/PATH/Vyuh/services/mcp/src/index.ts"
      ],
      "env": {
        "CHAIN_ID": "133",
        "HSK_RPC_TESTNET": "https://testnet.hsk.xyz",
        "POLICY_ENGINE": "0x...",
        "MANDATE_REGISTRY": "0x...",
        "INDEXER_URL": "http://localhost:42069",
        "ALLOW_SUBMIT": "false"
      }
    }
  }
}
```

Leave `ALLOW_SUBMIT` false and `AGENT_PRIVATE_KEY` out of the config file unless you mean to trade; put the key in the repo `.env` instead (gitignored).

## Assumptions (until contracts land)

- `VyuhVault.nonce()` returns the next expected nonce (per docs/ARCHITECTURE.md). Pass `nonce` to override.
- `PolicyEngine.checkIntent` returns `(uint8 code, uint8 ring)`; ring 0 means a pre-ring vault check.
- ABIs are local in `src/chain.ts`; switch to `@vyuh/shared` exports once `abis.ts` exists.

## Dev

```bash
pnpm --filter @vyuh/mcp test       # pure formatting + quote math
pnpm --filter @vyuh/mcp start      # stdio server; logs go to stderr
```
