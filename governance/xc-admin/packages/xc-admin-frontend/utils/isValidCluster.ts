import { PythCluster } from '../contexts/ClusterContext'

export const isValidCluster = (str: string): str is PythCluster =>
  ['devnet', 'testnet', 'mainnet-beta', 'pythtest', 'pythnet'].indexOf(str) !==
  -1
