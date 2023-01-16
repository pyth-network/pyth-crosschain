import type { NextPage } from 'next'
import Layout from '../components/layout/Layout'
import MinPublishers from '../components/MinPublishers'
import { PythContextProvider } from '../contexts/PythContext'

const Home: NextPage = () => {
  return (
    <Layout>
      <PythContextProvider>
        <MinPublishers />
      </PythContextProvider>
    </Layout>
  )
}

export default Home
