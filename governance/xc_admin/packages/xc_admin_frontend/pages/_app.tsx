import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'
import type { WalletConnectWalletAdapterConfig } from '@solana/wallet-adapter-wallets'
import {
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
  WalletConnectWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { generateDefaultSeo } from 'next-seo/pages'
import { useMemo } from 'react'
import { Toaster } from 'react-hot-toast'

import { ClusterProvider } from '../contexts/ClusterContext'
import { ProgramProvider } from '../contexts/ProgramContext'
import '../styles/globals.css'

const SEO = {
  defaultTitle: 'Pyth Network',
  titleTemplate: '%s | Pyth Network',
  description:
    'Pyth is building a way to deliver a decentralized, cross-chain market of verifiable data from first-party sources to any smart contract, anywhere.',
  openGraph: {
    type: 'website',
    images: [
      {
        url: 'https://proposals.pyth.network/default-banner.png',
        width: 1200,
        height: 630,
        alt: 'Pyth Network',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    handle: '@PythNetwork',
    cardType: 'summary_large_image',
  },
} as const

const walletConnectConfig: WalletConnectWalletAdapterConfig = {
  network: WalletAdapterNetwork.Mainnet,
  options: {
    relayUrl: 'wss://relay.walletconnect.com',
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '',
    metadata: {
      name: 'Pyth Proposals Page',
      description: 'Vote on Pyth Improvement Proposals',
      url: 'https://proposals.pyth.network/',
      icons: ['https://pyth.network/token.svg'],
    },
  },
}

function MyApp({ Component, pageProps }: AppProps) {
  // Can be set to 'devnet', 'testnet', or 'mainnet-beta'
  // const network = WalletAdapterNetwork.Devnet

  // You can also provide a custom RPC endpoint
  // const endpoint = useMemo(() => clusterApiUrl(network), [network])

  const endpoint = process.env.ENDPOINT
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
    []
  )

  return (
    <ConnectionProvider
      endpoint={endpoint || clusterApiUrl(WalletAdapterNetwork.Devnet)}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <ClusterProvider>
            <ProgramProvider>
              <Head>
                <meta
                  name="viewport"
                  content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
                />
                {generateDefaultSeo(SEO)}
              </Head>
              <Component {...pageProps} />
              <Toaster
                position="bottom-left"
                toastOptions={{
                  style: {
                    wordBreak: 'break-word',
                  },
                }}
                reverseOrder={false}
              />
            </ProgramProvider>
          </ClusterProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export default MyApp
