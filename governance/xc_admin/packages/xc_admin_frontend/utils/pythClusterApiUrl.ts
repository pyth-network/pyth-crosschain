import { PythCluster } from '@pythnetwork/client/lib/cluster'

const CLUSTER_URLS: Record<PythCluster, any> = {
  'mainnet-beta': [
    {
      rpcUrl:
        'https://pyth-network.rpcpool.com/' +
        (process.env.NEXT_PUBLIC_RPC_POOL_TOKEN || ''),
      wsUrl:
        'wss://pyth-network.rpcpool.com/' +
        (process.env.NEXT_PUBLIC_RPC_POOL_TOKEN || ''),
    },
    {
      rpcUrl: 'http://pyth-rpc1.certus.one:8899/',
      wsUrl: 'ws://pyth-rpc1.certus.one:8900/',
    },
    {
      rpcUrl: 'http://pyth-rpc2.certus.one:8899/',
      wsUrl: 'ws://pyth-rpc2.certus.one:8900/',
    },
    {
      rpcUrl: 'https://api.mainnet-beta.solana.com/',
      wsUrl: 'wss://api.mainnet-beta.solana.com/',
    },
  ],
  devnet: [
    {
      rpcUrl: 'https://api.devnet.solana.com/',
      wsUrl: 'wss://api.devnet.solana.com/',
    },
  ],
  testnet: [
    {
      rpcUrl: 'https://api.testnet.solana.com/',
      wsUrl: 'wss://api.testnet.solana.com/',
    },
  ],
  pythtest: [
    {
      rpcUrl: 'http://pythtest.xyz.pyth.network',
      wsUrl: 'ws://pythtest.xyz.pyth.network',
    },
    {
      rpcUrl: 'https://api.pythtest.pyth.network/',
      wsUrl: 'wss://api.pythtest.pyth.network/',
    },
  ],
  pythnet: [
    {
      rpcUrl: 'http://pythnet.xyz.pyth.network',
      wsUrl: 'ws://pythnet.xyz.pyth.network',
    },
    {
      rpcUrl: 'https://pythnet.rpcpool.com/',
      wsUrl: 'wss://pythnet.rpcpool.com/',
    },
  ],
  localnet: [
    {
      rpcUrl: 'http://localhost:8899/',
      wsUrl: 'ws://localhost:8900/',
    },
  ],
}

export function pythClusterApiUrls(cluster: PythCluster) {
  if (CLUSTER_URLS.hasOwnProperty(cluster)) {
    return CLUSTER_URLS[cluster]
  } else {
    return []
  }
}
