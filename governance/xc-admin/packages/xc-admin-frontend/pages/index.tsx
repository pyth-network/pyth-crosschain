import type { NextPage } from 'next'
import Layout from '../components/layout/Layout'
import MinPublishers from '../components/MinPublishers'
import { MultisigContextProvider } from '../contexts/MultisigContext'
import { PythContextProvider } from '../contexts/PythContext'

const Home: NextPage = () => {
  return (
    <Layout>
      <PythContextProvider>
        <MultisigContextProvider>
          <MinPublishers />
        </MultisigContextProvider>
      </PythContextProvider>
    </Layout>
  )
}

export default Home
