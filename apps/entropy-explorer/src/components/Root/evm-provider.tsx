"use client";

import type { ReactNode } from "react";
import { mainnet } from "viem/chains";
import { WagmiProvider, createConfig, http } from "wagmi";

// We only use wagmi because we use connectkit to get chain icons, and
// connectkit blows up if there isn't a wagmi context initialized.  However, the
// wagmi config isn't actually used when fetching chain icons.  But wagmi
// requires at least one chain to create a config, so we'll just inject mainnet
// here to make everyone happy.
export const EvmProvider = ({ children }: { children: ReactNode }) => (
  <WagmiProvider
    config={createConfig({
      chains: [mainnet],
      transports: { [mainnet.id]: http() },
    })}
  >
    {children}
  </WagmiProvider>
);
