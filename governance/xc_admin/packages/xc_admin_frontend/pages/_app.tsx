// biome-ignore-all lint/style/noProcessEnv: Standard Next.js environment configuration
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import type { WalletConnectWalletAdapterConfig } from "@solana/wallet-adapter-wallets";
import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  WalletConnectWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import type { AppProps } from "next/app";
import Head from "next/head";
import { generateDefaultSeo } from "next-seo/pages";
import { useMemo } from "react";
import { Toaster } from "react-hot-toast";

import { ClusterProvider } from "../contexts/ClusterContext";
import { ProgramProvider } from "../contexts/ProgramContext";
import "../styles/globals.css";

const SEO = {
  defaultTitle: "Pyth Network",
  description:
    "Pyth is building a way to deliver a decentralized, cross-chain market of verifiable data from first-party sources to any smart contract, anywhere.",
  openGraph: {
    images: [
      {
        alt: "Pyth Network",
        height: 630,
        type: "image/png",
        url: "https://proposals.pyth.network/default-banner.png",
        width: 1200,
      },
    ],
    type: "website",
  },
  titleTemplate: "%s | Pyth Network",
  twitter: {
    cardType: "summary_large_image",
    handle: "@PythNetwork",
  },
} as const;

const walletConnectConfig: WalletConnectWalletAdapterConfig = {
  network: WalletAdapterNetwork.Mainnet,
  options: {
    metadata: {
      description: "Vote on Pyth Improvement Proposals",
      icons: ["https://pyth.network/token.svg"],
      name: "Pyth Proposals Page",
      url: "https://proposals.pyth.network/",
    },
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
    relayUrl: "wss://relay.walletconnect.com",
  },
};

function MyApp({ Component, pageProps }: AppProps) {
  // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
  // const network = WalletAdapterNetwork.Devnet

  // You can also provide a custom RPC endpoint
  // const endpoint = useMemo(() => clusterApiUrl(network), [network])

  const endpoint = process.env.ENDPOINT;
  // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking and lazy loading --
  // Only the wallets you configure here will be compiled into your application, and only the dependencies
  // of wallets that your users connect to will be loaded
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
      new WalletConnectWalletAdapter(walletConnectConfig),
    ],
    [],
  );

  return (
    <ConnectionProvider
      endpoint={endpoint || clusterApiUrl(WalletAdapterNetwork.Devnet)}
    >
      <WalletProvider autoConnect wallets={wallets}>
        <WalletModalProvider>
          <ClusterProvider>
            <ProgramProvider>
              <Head>
                <meta
                  content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
                  name="viewport"
                />
                {generateDefaultSeo(SEO)}
              </Head>
              <Component {...pageProps} />
              <Toaster
                position="bottom-left"
                reverseOrder={false}
                toastOptions={{
                  style: {
                    wordBreak: "break-word",
                  },
                }}
              />
            </ProgramProvider>
          </ClusterProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default MyApp;
