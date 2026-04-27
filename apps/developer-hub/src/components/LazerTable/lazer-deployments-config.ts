export type ChainOverride = {
  name?: string;
  explorer?: string;
};

// Overrides for chains the upstream registry (chainid.network) doesn't cover,
// or where the display name there differs from what we want to show in the
// docs. Keyed by EVM network ID (as string).
export const LazerDeploymentsConfig: Record<string, ChainOverride> = {
  // upstream: "Tempo Mainnet Presto" — drop the codename.
  "4217": {
    name: "Tempo",
  },

  // upstream: "MegaETH Mainnet" — drop the suffix and add explorer.
  "4326": {
    name: "MegaETH",
    explorer: "https://www.megaexplorer.xyz",
  },

  // upstream: "Tempo Testnet Moderato" — drop the codename.
  "42431": {
    name: "Tempo Testnet",
  },

  // upstream missing explorer for Sonic Blaze Testnet.
  "57054": {
    explorer: "https://testnet.sonicscan.org",
  },

  // Ethereal mainnet — not in upstream.
  "5064014": {
    name: "Ethereal",
    explorer: "https://explorer.ethereal.trade",
  },

  // Ethereal Testnet V2 — not in upstream.
  "13374202": {
    name: "Ethereal Testnet V2",
    explorer: "https://explorer-ethereal-testnet-0.t.conduit.xyz",
  },

  // Ethereal Devnet — not in upstream.
  "13374201": {
    name: "Ethereal Devnet",
    explorer: "https://explorer-ethereal-devnet-0.t.conduit.xyz",
  },
};
