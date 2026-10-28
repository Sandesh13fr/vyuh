# @vyuh/guard

Preflight and send agent trades through a Vyuh vault. The LLM proposes, `PolicyEngine` decides: `guardedSwap` only sends when `checkIntent` returns `OK`, and the vault re-checks onchain anyway.

```ts
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hashkey, MAINNET } from "@vyuh/shared";
import { buildIntent, guardedSwap } from "@vyuh/guard";

const publicClient = createPublicClient({ chain: hashkey, transport: http() });
const walletClient = createWalletClient({ chain: hashkey, transport: http(), account: privateKeyToAccount(process.env.AGENT_PRIVATE_KEY as `0x${string}`) });
const intent = buildIntent({ vault, tokenIn: MAINNET.usdt, tokenOut: MAINNET.whsk, amountIn: 10n ** 18n, minAmountOut, nonce, reasoning: { why: "oracle below pool" } });
const r = await guardedSwap(walletClient, intent, { publicClient, policyEngine });
console.log(r.sent ? `sent ${r.hash}` : `blocked: ${r.code} (ring ${r.ring}) ${r.explanation}`);
```

Also: `preflight(client, intent, policyEngine)`, `hashReasoning(json)` (keccak256 of canonical JSON), `hashIntent(intent)`, `signMandate(walletClient, mandate, registry, chainId)` (EIP-712, owner only).
