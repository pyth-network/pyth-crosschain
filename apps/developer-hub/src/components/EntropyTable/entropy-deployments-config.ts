export type ChainOverride = {
  rpc?: string;
  nativeCurrency?: string;
  explorer?: string;
};

export const EntropyDeploymentsConfig: Record<string, ChainOverride> = {
  "143": {
    explorer: "https://monadvision.com",
    nativeCurrency: "MON",
  },
  // Example overrides - add your custom configurations here
  // "network-id": {
  //   rpc: "https://custom-rpc-url.com",
  //   nativeCurrency: "CUSTOM"
  //   explorer: "https://custom-explorer.com"
  // },

  // Override examples (uncomment and modify as needed):
  "998": {
    explorer: "https://testnet.purrsec.com/",
    nativeCurrency: "HYPE",
    rpc: "https://rpc.hyperliquid-testnet.xyz/evm",
  },
  "999": {
    nativeCurrency: "HYPE",
    rpc: "https://rpc.hypurrscan.io",
  },
};
