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
    id: 999,
    name: "Hyperliquid",
    nativeCurrency: {
      name: "Hyper",
      symbol: "HYPE",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ["https://rpc.hyperliquid.xyz/evm"] },
    },
    testnet: false,
    blockExplorers: {
      default: {
        name: "Hyperliquid",
        url: "https://hyperevmscan.io/",
      },
    },
  }),
  defineChain({
    id: 964,
    name: "Bittensor",
    nativeCurrency: {
      name: "TAO",
      symbol: "TAO",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ["https://bittensor-finney.api.onfinality.io/public"] },
    },
    testnet: false,
    blockExplorers: {
      default: {
        name: "Bittensor",
        url: "https://evm.taostats.io/",
      },
    },
  }),
  defineChain({
    id: 484,
    name: "Camp",
    nativeCurrency: {
      name: "CAMP",
      symbol: "CAMP",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ["https://rpc.camp.raas.gelato.cloud"] },
    },
    testnet: false,
    blockExplorers: {
      default: {
        name: "Campscout",
        url: "https://camp.cloud.blockscout.com/",
      },
    },
  }),
  defineChain({
    id: 31_612,
    name: "Mezo",
    nativeCurrency: {
      name: "BTC",
      symbol: "BTC",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ["https://jsonrpc-mezo.boar.network"] },
    },
    testnet: false,
    blockExplorers: {
      default: {
        name: "Mezo Explorer",
        url: "https://explorer.mezo.org/",
      },
    },
  }),
];
