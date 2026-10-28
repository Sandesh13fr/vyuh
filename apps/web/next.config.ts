import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@vyuh/shared"],
  webpack: (cfg) => {
    // WalletConnect pulls optional node-only deps; keep them out of the bundle.
    cfg.externals.push("pino-pretty", "lokijs", "encoding");
    // wagmi's Base connector imports Coinbase x402 payment modules it lists as optional. We never use them.
    cfg.resolve.alias = { ...cfg.resolve.alias, "@x402/core": false, "@x402/evm": false, "@x402/svm": false };
    return cfg;
  },
};

export default config;
