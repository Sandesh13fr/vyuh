import { createServer } from "node:http";
import { isAddress, type Address } from "viem";
import { handleAttackerMessage } from "./arena";

// Arena HTTP endpoint for apps/web: POST /arena {message, attacker} -> ArenaResult.
const PORT = Number(process.env.AGENT_PORT ?? 8787);
const MAX_LEN = 2000;

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(json(body));
  };
  if (req.method !== "POST" || req.url !== "/arena") return send(404, { error: "POST /arena only" });

  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > MAX_LEN * 4) return send(413, { error: "Body too large" });
  }
  try {
    const { message, attacker } = JSON.parse(raw) as { message?: unknown; attacker?: unknown };
    if (typeof message !== "string" || !message.trim() || message.length > MAX_LEN)
      return send(400, { error: `message must be 1-${MAX_LEN} characters` });
    if (typeof attacker !== "string" || !isAddress(attacker)) return send(400, { error: "attacker must be an address" });
    send(200, await handleAttackerMessage(message, attacker as Address));
  } catch (e) {
    console.error(e);
    send(500, { error: "Arena agent failed" });
  }
}).listen(PORT, () => console.error(`arena agent on :${PORT}`));
