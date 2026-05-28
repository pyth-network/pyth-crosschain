export type ChainOverride = {
  name?: string;
  explorer?: string;
};

export const MigrationDeploymentsConfig: Record<string, ChainOverride> = {
  "4217": {
    name: "Tempo",
  },

  "4326": {
    name: "MegaETH",
    explorer: "https://www.megaexplorer.xyz",
  },

  "42431": {
    name: "Tempo Testnet",
  },

  "57054": {
    explorer: "https://testnet.sonicscan.org",
  },

  // chainid.network has a stale "Wanchain Testnet" entry for network ID 999;
  // Hyperliquid EVM Mainnet has taken over that ID.
  "999": {
    name: "HyperEVM",
    explorer: "https://hyperevmscan.io",
  },

  // chainid.network calls network 1776 just "Injective"; Injective's own docs
  // call this chain "Injective EVM" (their native L1 EVM). Network 2525
  // (Caldera's inEVM rollup) is a different chain and keeps its upstream
  // "inEVM Mainnet" label.
  "1776": {
    name: "Injective EVM",
  },
};
