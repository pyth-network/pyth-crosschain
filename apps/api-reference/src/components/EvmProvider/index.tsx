"use client";

import {
  getEvmChainRpcUrl,
  allEvmChainIds,
} from "@pythnetwork/contract-manager/utils/utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import * as chains from "viem/chains";
import { WagmiProvider, createConfig, http, useChainId } from "wagmi";

import { chainOverrides } from "./chain-overrides";
import { metadata } from "../../metadata";

const CHAINS = allEvmChainIds
  .map((id) => {
    // First, check if we have an override for this chain
    const overrideChain = chainOverrides.find((chain) => chain.id === id);
    if (overrideChain) return overrideChain;

    // Fall back to viem's built-in chains
    return Object.values(chains).find((chain) => chain.id === id);
  })
  .filter((chain) => chain !== undefined) as unknown as readonly [
  chains.Chain,
  ...chains.Chain[],
];

const TRANSPORTS = Object.fromEntries(
  CHAINS.map((chain) => [chain.id, http(getEvmChainRpcUrl(chain.id))]),
);

type EvmProviderProps = {
  children: ReactNode;
  walletConnectProjectId?: string | undefined;
};

export const EvmProvider = ({
  children,
  walletConnectProjectId,
}: EvmProviderProps) => (
  <WagmiProvider
    config={createConfig(
      getDefaultConfig({
        chains: CHAINS,
        transports: TRANSPORTS,
        appName: metadata.applicationName,
        appDescription: metadata.description,
        appUrl: metadata.metadataBase.toString(),
        appIcon: metadata.icons.apple.url,
        walletConnectProjectId: walletConnectProjectId ?? "",
      }),
    )}
  >
    <QueryClientProvider client={new QueryClient()}>
      <ConnectKitProviderWrapper>{children}</ConnectKitProviderWrapper>
    </QueryClientProvider>
  </WagmiProvider>
);

const ConnectKitProviderWrapper = ({ children }: { children: ReactNode }) => {
  const { resolvedTheme } = useTheme();
  const chainId = useChainId();

  return (
    <ConnectKitProvider
      mode={resolvedTheme as "light" | "dark"}
      options={{ initialChainId: chainId }}
      customTheme={{
        "--ck-font-family": "var(--font-sans)",
      }}
    >
      {children}
    </ConnectKitProvider>
  );
};
