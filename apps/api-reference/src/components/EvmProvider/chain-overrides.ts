import type { Chain } from "viem";
import { defineChain } from "viem";

/**
 * Chain overrides for chains that are not available in viem's built-in chain list.
 * These chains will take priority over viem's built-in chains when matching by chain ID.
 *
 * To add a new chain override:
 * 1. Find the chain ID from EvmChains.json
 * 2. Add a new defineChain entry with the following required fields:
 *    - id: chainId. id in EvmChains.json is the name
 *    - name: Chain display name
 *    - nativeCurrency: \{ name, symbol, decimals \}
 *    - rpcUrls: \{ default: \{ http: ['...'] \} \}
 *    - testnet: true/false (optional, defaults to false for mainnet)
 *    - blockExplorers: \{ default: \{ name, url \} \} (optional)
 */
export const chainOverrides: readonly Chain[] = [
  // Example chain override (remove or replace with actual chains):
  // defineChain({
  //   id: 7701,
  //   name: 'Custom Chain Name',
  //   nativeCurrency: {
  //     name: 'Custom Token',
  //     symbol: 'CTK',
  //     decimals: 18,
  //   },
  //   rpcUrls: {
  //     default: { http: ['https://rpc.example.com'] },
  //   },
  //   testnet: false,
  //   blockExplorers: {
  //     default: {
  //       name: 'Custom Explorer',
  //       url: 'https://explorer.example.com',
  //     },
  //   },
  // }),
  defineChain({
    blockExplorers: {
      default: {
        name: "Hyperliquid",
        url: "https://hyperevmscan.io/",
      },
    },
    id: 999,
    name: "Hyperliquid",
    nativeCurrency: {
      decimals: 18,
      name: "Hyper",
      symbol: "HYPE",
    },
    rpcUrls: {
      default: { http: ["https://rpc.hyperliquid.xyz/evm"] },
    },
    testnet: false,
  }),
  defineChain({
    blockExplorers: {
      default: {
        name: "Bittensor",
        url: "https://evm.taostats.io/",
      },
    },
    id: 964,
    name: "Bittensor",
    nativeCurrency: {
      decimals: 18,
      name: "TAO",
      symbol: "TAO",
    },
    rpcUrls: {
      default: { http: ["https://bittensor-finney.api.onfinality.io/public"] },
    },
    testnet: false,
  }),
  defineChain({
    blockExplorers: {
      default: {
        name: "Campscout",
        url: "https://camp.cloud.blockscout.com/",
      },
    },
    id: 484,
    name: "Camp",
    nativeCurrency: {
      decimals: 18,
      name: "CAMP",
      symbol: "CAMP",
    },
    rpcUrls: {
      default: { http: ["https://rpc.camp.raas.gelato.cloud"] },
    },
    testnet: false,
  }),
  defineChain({
    blockExplorers: {
      default: {
        name: "Mezo Explorer",
        url: "https://explorer.mezo.org/",
      },
    },
    id: 31_612,
    name: "Mezo",
    nativeCurrency: {
      decimals: 18,
      name: "BTC",
      symbol: "BTC",
    },
    rpcUrls: {
      default: { http: ["https://jsonrpc-mezo.boar.network"] },
    },
    testnet: false,
  }),
  defineChain({
    blockExplorers: {
      default: {
        name: "MegaETH Explorer",
        url: "https://mega.etherscan.io/",
      },
    },
    id: 4326,
    name: "MegaETH",
    nativeCurrency: {
      decimals: 18,
      name: "Ether",
      symbol: "ETH",
    },
    rpcUrls: {
      default: { http: ["https://mainnet.megaeth.com/rpc"] },
    },
    testnet: false,
  }),
];
