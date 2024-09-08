"use client";

import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider as WalletProviderImpl,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  BraveWalletAdapter,
  BackpackWalletAdapter,
  CoinbaseWalletAdapter,
  PhantomWalletAdapter,
  GlowWalletAdapter,
  LedgerWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { type ReactNode, useMemo } from "react";

import { metadata } from "../../metadata";

type Props = {
  network: WalletAdapterNetwork.Devnet | WalletAdapterNetwork.Mainnet;
  children?: ReactNode | ReactNode[] | undefined;
  walletConnectProjectId?: string | undefined;
  rpc?: string | undefined;
};

export const WalletProvider = ({
  network,
  children,
  walletConnectProjectId,
  rpc,
}: Props) => {
  const endpoint = useMemo(() => rpc ?? clusterApiUrl(network), [rpc, network]);

  const wallets = useMemo(
    () => [
      new BraveWalletAdapter(),
      new BackpackWalletAdapter(),
      new CoinbaseWalletAdapter(),
      new PhantomWalletAdapter(),
      new GlowWalletAdapter(),
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
