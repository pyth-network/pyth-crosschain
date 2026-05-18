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
};
