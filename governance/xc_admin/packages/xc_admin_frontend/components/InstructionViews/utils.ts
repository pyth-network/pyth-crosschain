import { PublicKey } from '@solana/web3.js'

export const getMappingCluster = (cluster: string | undefined) => {
  return cluster === 'mainnet-beta' || cluster === 'pythnet'
    ? 'pythnet'
    : 'pythtest'
}

// check if a string is a pubkey
export const isPubkey = (str: string) => {
  try {
    new PublicKey(str)
    return true
  } catch {
    return false
  }
}
