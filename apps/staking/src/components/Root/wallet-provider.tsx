"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider as WalletProviderImpl,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  GlowWalletAdapter,
  LedgerWalletAdapter,
  SolflareWalletAdapter,
  SolletExtensionWalletAdapter,
  SolletWalletAdapter,
  TorusWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { type ReactNode, useMemo } from "react";

import { metadata } from "../../metadata";

type Props = {
  children?: ReactNode | ReactNode[] | undefined;
  walletConnectProjectId?: string | undefined;
  rpc?: string | undefined;
};

export const WalletProvider = ({
  children,
  walletConnectProjectId,
  rpc,
}: Props) => {
  const endpoint = useMemo(
    () => rpc ?? clusterApiUrl(WalletAdapterNetwork.Devnet),
    [rpc],
  );

  const wallets = useMemo(
    () => [
      new GlowWalletAdapter(),
      new LedgerWalletAdapter(),
      new SolflareWalletAdapter(),
      new SolletExtensionWalletAdapter(),
      new SolletWalletAdapter(),
      new TorusWalletAdapter(),
      ...(walletConnectProjectId
        ? [
            new WalletConnectWalletAdapter({
              network: WalletAdapterNetwork.Mainnet,
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
    [walletConnectProjectId],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProviderImpl wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProviderImpl>
    </ConnectionProvider>
  );
};
