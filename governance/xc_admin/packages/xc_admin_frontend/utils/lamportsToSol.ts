const TRAILING_ZEROS = new RegExp(/\.?0+$/)
const SOL_DECIMALS = 9

export function lamportsToSol(lamports: bigint): string {
  const padded = lamports.toString().padStart(SOL_DECIMALS + 1, '0')
  return (
    padded.slice(0, padded.length - SOL_DECIMALS) +
    ('.' + padded.slice(padded.length - SOL_DECIMALS)).replace(
      TRAILING_ZEROS,
      ''
    )
  )
}
