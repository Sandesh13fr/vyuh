import { defineConfig } from "hardhat/config";

// ponytail: Hardhat 3 runs the forge-std Solidity tests when Foundry is not installed.
// Foundry stays the primary toolchain (foundry.toml); keep settings in sync.
export default defineConfig({
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "paris" },
  },
  paths: { sources: "src", tests: { solidity: "test" } },
  test: { solidity: { fuzz: { runs: 256 }, invariant: { runs: 128, depth: 32, failOnRevert: true } } },
});
