import {
  PythCluster,
  getPythClusterApiUrl,
} from '@pythnetwork/client/lib/cluster'

const CLUSTER_URLS: Record<PythCluster, string[]> = {
  'mainnet-beta': [
    process.env.NEXT_PUBLIC_MAINNET_RPC || getPythClusterApiUrl('mainnet-beta'),
    'https://pyth-network.rpcpool.com/' +
      (process.env.NEXT_PUBLIC_RPC_POOL_TOKEN || ''),
    'http://pyth-rpc1.certus.one:8899/',
    'http://pyth-rpc2.certus.one:8899/',
    'https://api.mainnet-beta.solana.com/',
  ],
  devnet: [
    process.env.NEXT_PUBLIC_DEVNET_RPC || getPythClusterApiUrl('devnet'),
    'https://api.devnet.solana.com/',
  ],
  testnet: [
    process.env.NEXT_PUBLIC_TESTNET_RPC || getPythClusterApiUrl('testnet'),
    'https://api.testnet.solana.com/',
  ],
  'pythtest-conformance': [
    process.env.NEXT_PUBLIC_PYTHTEST_RPC ||
      getPythClusterApiUrl('pythtest-conformance'),
    'https://api.pythtest.pyth.network/',
  ],
  'pythtest-crosschain': [
    process.env.NEXT_PUBLIC_PYTHTEST_RPC ||
      getPythClusterApiUrl('pythtest-crosschain'),
    'https://api.pythtest.pyth.network/',
  ],
  pythnet: [
    process.env.NEXT_PUBLIC_PYTHNET_RPC || getPythClusterApiUrl('pythnet'),
    'https://pythnet.rpcpool.com/',
  ],
  localnet: ['http://localhost:8899/'],
}

export function pythClusterApiUrls(cluster: PythCluster) {
  if (CLUSTER_URLS.hasOwnProperty(cluster)) {
    return CLUSTER_URLS[cluster]
  } else {
    return []
  }
}

export function deriveWsUrl(httpUrl: string) {
  if (httpUrl.startsWith('https://')) {
    return 'wss://' + httpUrl.slice(8)
  } else {
    return 'ws://' + httpUrl.slice(7)
  }
}
