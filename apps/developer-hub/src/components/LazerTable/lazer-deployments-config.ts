export type ChainOverride = {
  name?: string;
  explorer?: string;
};

// Overrides for chains that viem doesn't cover, or where the display name /
// explorer URL in viem differs from the canonical value we want to show.
// Keyed by EVM network ID (as string).
export const LazerDeploymentsConfig: Record<string, ChainOverride> = {
  // Ethereum Sepolia — viem calls this "Sepolia"; disambiguate in docs.
  "11155111": {
    name: "Ethereum Sepolia",
  },

  // Soneium — viem calls this "Soneium Mainnet"; drop the suffix.
  "1868": {
    name: "Soneium",
  },

  // Tempo — viem calls this "Tempo Mainnet"; drop the suffix.
  "4217": {
    name: "Tempo",
  },

  // Ethereal mainnet — not in viem.
  "5064014": {
    name: "Ethereal",
    explorer: "https://explorer.ethereal.trade",
  },

  // Ethereal Testnet V2 — not in viem.
  "13374202": {
    name: "Ethereal Testnet V2",
    explorer: "https://explorer-ethereal-testnet-0.t.conduit.xyz",
  },

  // Ethereal Devnet — not in viem.
  "13374201": {
    name: "Ethereal Devnet",
    explorer: "https://explorer-ethereal-devnet-0.t.conduit.xyz",
  },
};
