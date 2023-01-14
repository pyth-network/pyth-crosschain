import { DefaultSeo } from 'next-seo'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import {
  BackpackWalletAdapter,
  GlowWalletAdapter,
  LedgerWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  SolletExtensionWalletAdapter,
  SolletWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets'
import { Toaster } from 'react-hot-toast'
import { clusterApiUrl } from '@solana/web3.js'
import { ClusterProvider } from '../contexts/ClusterContext'
import SEO from '../next-seo.config'
import '../styles/globals.css'
import { useMemo } from 'react'

// Use require instead of import since order matters
require('@solana/wallet-adapter-react-ui/styles.css')
require('../styles/globals.css')

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
      new GlowWalletAdapter(),
      new BackpackWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
      new LedgerWalletAdapter(),
      new SolletWalletAdapter(),
      new SolletExtensionWalletAdapter(),
    ],
    []
  )

  return (
    <>
      <ConnectionProvider
        endpoint={endpoint || clusterApiUrl(WalletAdapterNetwork.Devnet)}
      >
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <ClusterProvider>
              <Head>
                <meta
                  name="viewport"
                  content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
                />
              </Head>
              <DefaultSeo {...SEO} />
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
            </ClusterProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </>
  )
}

export default MyApp
