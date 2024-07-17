"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http, useChainId } from "wagmi";
import { arbitrum, avalanche, mainnet, sepolia } from "wagmi/chains";

import { metadata } from "../../metadata";

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
        chains: [mainnet, avalanche, arbitrum, sepolia],
        transports: {
          [mainnet.id]: http(),
          [avalanche.id]: http(),
          [arbitrum.id]: http(),
          [sepolia.id]: http(),
        },
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
