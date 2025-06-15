"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import * as chains from "viem/chains";
import { WagmiProvider, createConfig, http, useChainId } from "wagmi";

import { NETWORK_IDS, getRpcUrl } from "../../evm-networks";
import { metadata } from "../../metadata";

const CHAINS = NETWORK_IDS.map((id) =>
  Object.values(chains).find((chain) => chain.id === id),
).filter((chain) => chain !== undefined) as unknown as readonly [
  chains.Chain,
  ...chains.Chain[],
];

const TRANSPORTS = Object.fromEntries(
  CHAINS.map((chain) => {
    const rpcUrl = getRpcUrl(chain.id);
    if (rpcUrl) {
      return [chain.id, http(rpcUrl)];
    } else if (chain.rpcUrls.default.http[0]) {
      return [chain.id, http(chain.rpcUrls.default.http[0])];
    } else {
      throw new Error(`No rpc url found for ${chain.name}`);
    }
  }),
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
