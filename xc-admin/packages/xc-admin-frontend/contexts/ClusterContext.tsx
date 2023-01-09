import { Cluster } from '@solana/web3.js'
import { createContext, useMemo, useState } from 'react'
import { isValidCluster } from '../utils/isValidCluster'

export type PythCluster = Cluster | 'pythtest' | 'pythnet'
export const DEFAULT_CLUSTER: PythCluster = 'pythnet'

export const ClusterContext = createContext<{
  cluster: PythCluster
  setCluster: any
}>({
  cluster: DEFAULT_CLUSTER,
  setCluster: (cluster: PythCluster) => {},
})

export const ClusterProvider = (props: any) => {
  const [cluster, setCluster] = useState<PythCluster>(DEFAULT_CLUSTER)
  const contextValue = useMemo(
    () => ({
      cluster,
      setCluster: (cluster: PythCluster) => {
        const setCl = isValidCluster(cluster) ? cluster : DEFAULT_CLUSTER
        setCluster(setCl)
      },
    }),
    [cluster]
  )
  return <ClusterContext.Provider {...props} value={contextValue} />
}
