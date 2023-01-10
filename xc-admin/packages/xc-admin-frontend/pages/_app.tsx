import { DefaultSeo } from 'next-seo'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import { ClusterProvider } from '../contexts/ClusterContext'
import SEO from '../next-seo.config'
import '../styles/globals.css'

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <ClusterProvider>
        <Head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
          />
        </Head>
        <DefaultSeo {...SEO} />
        <Component {...pageProps} />
      </ClusterProvider>
    </>
  )
}

export default MyApp
