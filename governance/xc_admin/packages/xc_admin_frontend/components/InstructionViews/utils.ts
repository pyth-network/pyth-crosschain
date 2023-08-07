import { PublicKey } from '@solana/web3.js'

export const getMappingCluster = (cluster: string) => {
  if (cluster === 'mainnet-beta' || cluster === 'pythnet') {
    return 'pythnet'
  } else {
    return 'pythtest'
  }
}

// check if a string is a pubkey
export const isPubkey = (str: string) => {
  try {
    new PublicKey(str)
    return true
  } catch (e) {
    return false
  }
}
