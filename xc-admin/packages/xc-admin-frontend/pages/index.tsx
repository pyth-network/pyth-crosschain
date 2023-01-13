import type { NextPage } from 'next'
import { useContext, useEffect } from 'react'
import Layout from '../components/layout/Layout'
import Main from '../components/Main'
import { PythContextProvider } from '../contexts/PythContext'
import { ClusterContext, DEFAULT_CLUSTER } from './../contexts/ClusterContext'

const Home: NextPage = () => {
  const { setCluster } = useContext(ClusterContext)

  useEffect(() => {
    setCluster(DEFAULT_CLUSTER)
  }, [setCluster])

  return (
    <Layout>
      <PythContextProvider>
        <Main />
      </PythContextProvider>
    </Layout>
  )
}

export default Home
