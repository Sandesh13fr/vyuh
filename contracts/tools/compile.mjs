// Compile-check with solc-js when Foundry is unavailable. Usage: node tools/compile.mjs [dirs...]
// Writes nothing to disk; exits 1 on any compiler error.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import solc from "solc";

const root = resolve(import.meta.dirname, "..");
const dirs = process.argv.slice(2).length ? process.argv.slice(2) : ["src", "test", "script"];
const remaps = readFileSync(join(root, "remappings.txt"), "utf8")
  .split(/\r?\n/).filter(Boolean).map((l) => l.split("="));

const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith(".sol") ? [p] : [];
});
const sources = {};
for (const d of dirs) {
  if (!existsSync(join(root, d))) continue;
  for (const f of walk(join(root, d))) {
    sources[relative(root, f).replaceAll("\\", "/")] = { content: readFileSync(f, "utf8") };
  }
}

function findImports(path) {
  for (const [from, to] of remaps) if (path.startsWith(from)) path = to + path.slice(from.length);
  const p = join(root, path);
  return existsSync(p) ? { contents: readFileSync(p, "utf8") } : { error: `not found: ${path}` };
}

const input = {
  language: "Solidity",
  sources,
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "paris",
    outputSelection: { "*": { "*": ["evm.bytecode.object"] } },
  },
};
const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
for (const e of out.errors ?? []) {
  if (e.severity === "error" || !String(e.sourceLocation?.file).startsWith("node_modules")) {
    console.error(e.formattedMessage);
  }
}
const n = Object.values(out.contracts ?? {}).reduce((a, c) => a + Object.keys(c).length, 0);
console.log(`solc ${solc.version()}: ${Object.keys(sources).length} files, ${n} contracts, ${errors.length} errors`);
process.exit(errors.length ? 1 : 0);
