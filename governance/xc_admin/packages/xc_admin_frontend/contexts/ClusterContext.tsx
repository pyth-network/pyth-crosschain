import { PythCluster } from '@pythnetwork/client/lib/cluster'
import { ReactNode, createContext, useMemo, useState } from 'react'

export const DEFAULT_CLUSTER: PythCluster = 'mainnet-beta'

export const ClusterContext = createContext<{
  cluster: PythCluster
  setCluster: (_cluster: PythCluster) => void
}>({
  cluster: DEFAULT_CLUSTER,
  setCluster: () => {},
})

export const ClusterProvider = ({ children }: { children: ReactNode }) => {
  const [cluster, setCluster] = useState<PythCluster>(DEFAULT_CLUSTER)
  const contextValue = useMemo(
    () => ({
      cluster,
      setCluster: (cluster: PythCluster) => {
        setCluster(cluster)
      },
    }),
    [cluster]
  )
  return (
    <ClusterContext.Provider value={contextValue}>
      {children}
    </ClusterContext.Provider>
  )
}
