import Anthropic from "@anthropic-ai/sdk";
import { canonicalJson } from "@vyuh/guard";
import { loadConfig, makeClients } from "./config";
import { makeDecide } from "./llm";
import { readMarket } from "./market";
import { proposeAndGuard } from "./runtime";

const cfg = loadConfig();
if (!cfg.AGENT_VAULT) throw new Error("AGENT_VAULT is not set");
const vault = cfg.AGENT_VAULT;
const { publicClient, walletClient } = makeClients(cfg, cfg.AGENT_PRIVATE_KEY);
const decide = makeDecide(new Anthropic({ apiKey: cfg.ANTHROPIC_API_KEY }), cfg.LLM_MODEL);
const log = (o: object) => console.log(canonicalJson({ t: new Date().toISOString(), ...o }));

log({ msg: "agent start", vault, dryRun: cfg.DRY_RUN, model: cfg.LLM_MODEL });
for (;;) {
  try {
    const market = await readMarket(publicClient);
    const r = await proposeAndGuard(
      { publicClient, walletClient, vault, policyEngine: cfg.POLICY_ENGINE, dryRun: cfg.DRY_RUN },
      market,
      await decide(market),
    );
    log(r);
  } catch (e) {
    log({ status: "error", error: String(e) });
  }
  await new Promise((res) => setTimeout(res, cfg.LOOP_MS));
}
