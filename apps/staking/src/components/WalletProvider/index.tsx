"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider as WalletProviderImpl,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  LedgerWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import type { ReactNode } from "react";
import { useMemo } from "react";

import { useNetwork } from "../../hooks/use-network";
import { metadata } from "../../metadata";

type Props = {
  children?: ReactNode | ReactNode[] | undefined;
  walletConnectProjectId?: string | undefined;
  mainnetRpc?: string | undefined;
};

export const WalletProvider = ({
  children,
  walletConnectProjectId,
  mainnetRpc,
}: Props) => {
  const { isMainnet } = useNetwork();

  const network = useMemo(
    () =>
      isMainnet ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet,
    [isMainnet],
  );

  const endpoint = useMemo(
    () =>
      network === WalletAdapterNetwork.Mainnet && mainnetRpc !== undefined
        ? mainnetRpc
        : clusterApiUrl(network),
    [mainnetRpc, network],
  );

  const wallets = useMemo(
    () => [
      new CoinbaseWalletAdapter(),
      new PhantomWalletAdapter(),
      new LedgerWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      ...(walletConnectProjectId
        ? [
            new WalletConnectWalletAdapter({
              network,
              options: {
                relayUrl: "wss://relay.walletconnect.com",
                projectId: walletConnectProjectId,
                metadata: {
                  name: metadata.applicationName,
                  description: metadata.description,
                  url: metadata.metadataBase.toString(),
                  icons: ["https://pyth.network/token.svg"],
                },
              },
            }),
          ]
        : []),
    ],
    [walletConnectProjectId, network],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProviderImpl wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProviderImpl>
    </ConnectionProvider>
  );
};
