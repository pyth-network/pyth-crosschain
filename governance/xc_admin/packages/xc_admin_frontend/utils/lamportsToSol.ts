import { LAMPORTS_PER_SOL } from '@solana/web3.js'

export function lamportsToSol(lamports: bigint): string {
  return (lamports / BigInt(LAMPORTS_PER_SOL)).toString()
}
