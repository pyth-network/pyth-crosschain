"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider, getDefaultConfig } from "connectkit";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { WagmiProvider, createConfig, http, useChainId } from "wagmi";
import { arbitrum, avalanche, mainnet, sepolia } from "wagmi/chains";

import { metadata } from "../../metadata";

const config = createConfig(
  /* @ts-expect-error connectkit's types don't unify with wagmi's types using the exactOptionalPropertyTypes typescript setting */
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
  }),
);

const queryClient = new QueryClient();

type EvmLayoutProps = {
  children: ReactNode;
};

export const EvmLayout = ({ children }: EvmLayoutProps) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProviderWrapper>{children}</ConnectKitProviderWrapper>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

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
