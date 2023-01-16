import { PythCluster } from '@pythnetwork/client/lib/cluster'
import { createContext, useMemo, useState } from 'react'

export const DEFAULT_CLUSTER: PythCluster = 'mainnet-beta'

export const ClusterContext = createContext<{
  cluster: PythCluster
  setCluster: any
}>({
  cluster: DEFAULT_CLUSTER,
  setCluster: {},
})

export const ClusterProvider = (props: any) => {
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
  return <ClusterContext.Provider {...props} value={contextValue} />
}
