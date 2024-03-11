import { Tab } from '@headlessui/react'
import * as fs from 'fs'
import type { GetServerSideProps, NextPage } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import General from '../components/tabs/General'
import Proposals from '../components/tabs/Proposals'
import UpdatePermissions from '../components/tabs/UpdatePermissions'
import { MultisigContextProvider } from '../contexts/MultisigContext'
import { PythContextProvider } from '../contexts/PythContext'
import { StatusFilterProvider } from '../contexts/StatusFilterContext'
import { classNames } from '../utils/classNames'
import '../mappings/signers.json'

export const getServerSideProps: GetServerSideProps = async () => {
  const MAPPINGS_BASE_PATH = process.env.MAPPINGS_BASE_PATH || ''
  const PUBLISHER_PYTHNET_MAPPING_PATH = `${MAPPINGS_BASE_PATH}/publishers-pythnet.json`
  const PUBLISHER_PYTHTEST_MAPPING_PATH = `${MAPPINGS_BASE_PATH}/publishers-pythtest.json`

  const publisherKeyToNameMapping = {
    pythnet: fs.existsSync(PUBLISHER_PYTHNET_MAPPING_PATH)
      ? JSON.parse(
          (
            await fs.promises.readFile(PUBLISHER_PYTHNET_MAPPING_PATH)
          ).toString()
        )
      : {},
    pythtest: fs.existsSync(PUBLISHER_PYTHTEST_MAPPING_PATH)
      ? JSON.parse(
          (
            await fs.promises.readFile(PUBLISHER_PYTHTEST_MAPPING_PATH)
          ).toString()
        )
      : {},
  }
  const MULTISIG_SIGNER_MAPPING_PATH = `${MAPPINGS_BASE_PATH}/signers.json`
  const multisigSignerKeyToNameMapping = fs.existsSync(
    MULTISIG_SIGNER_MAPPING_PATH
  )
    ? JSON.parse(
        (await fs.promises.readFile(MULTISIG_SIGNER_MAPPING_PATH)).toString()
      )
    : {}

  console.log(MULTISIG_SIGNER_MAPPING_PATH)
  console.log(fs.existsSync(MULTISIG_SIGNER_MAPPING_PATH))
  console.log(multisigSignerKeyToNameMapping)

  const proposerServerUrl =
    process.env.PROPOSER_SERVER_URL || 'http://localhost:4000'
  return {
    props: {
      proposerServerUrl,
      publisherKeyToNameMapping,
      multisigSignerKeyToNameMapping,
    },
  }
}

const TAB_INFO = {
  General: {
    title: 'General',
    description: 'General panel for the program.',
    queryString: 'general',
  },
  UpdatePermissions: {
    title: 'Update Permissions',
    description: 'Update the permissions of the program.',
    queryString: 'update-permissions',
  },
  Proposals: {
    title: 'Proposals',
    description: 'View and vote on proposals.',
    queryString: 'proposals',
  },
}

const DEFAULT_TAB = 'general'

const Home: NextPage<{
  publisherKeyToNameMapping: Record<string, Record<string, string>>
  multisigSignerKeyToNameMapping: Record<string, string>
  proposerServerUrl: string
}> = ({
  publisherKeyToNameMapping,
  multisigSignerKeyToNameMapping,
  proposerServerUrl,
}) => {
  const [currentTabIndex, setCurrentTabIndex] = useState(0)
  const tabInfoArray = Object.values(TAB_INFO)

  const router = useRouter()

  // set current tab value when tab is clicked
  const handleChangeTab = (index: number) => {
    if (tabInfoArray[index].queryString !== 'proposals') {
      delete router.query.proposal
    }
    router.query.tab = tabInfoArray[index].queryString
    setCurrentTabIndex(index)
    router.push(
      {
        pathname: router.pathname,
        query: router.query,
      },
      undefined,
      { scroll: false }
    )
  }

  // set current tab value when page is loaded
  useEffect(() => {
    router.query && router.query.tab
      ? setCurrentTabIndex(
          tabInfoArray.findIndex((v) => v.queryString === router.query.tab)
        )
      : setCurrentTabIndex(
          tabInfoArray.findIndex((v) => v.queryString === DEFAULT_TAB)
        )
  }, [router, tabInfoArray])

  return (
    <Layout>
      <PythContextProvider
        publisherKeyToNameMapping={publisherKeyToNameMapping}
        multisigSignerKeyToNameMapping={multisigSignerKeyToNameMapping}
      >
        <MultisigContextProvider>
          <div className="container relative pt-16 md:pt-20">
            <div className="py-8 md:py-16">
              <Tab.Group
                selectedIndex={currentTabIndex}
                onChange={handleChangeTab}
              >
                <Tab.List className="mx-auto gap-1 space-x-4 space-y-4 text-center sm:gap-2.5 md:space-x-8">
                  {Object.entries(TAB_INFO).map((tab, idx) => (
                    <Tab
                      key={idx}
                      className={({ selected }) =>
                        classNames(
                          'p-3 text-xs font-semibold uppercase outline-none transition-colors hover:bg-darkGray3 md:text-base',
                          selected ? 'bg-darkGray3' : 'bg-darkGray2'
                        )
                      }
                    >
                      {tab[1].title}
                    </Tab>
                  ))}
                </Tab.List>
              </Tab.Group>
            </div>
          </div>
          {tabInfoArray[currentTabIndex].queryString ===
            TAB_INFO.General.queryString && (
            <General proposerServerUrl={proposerServerUrl} />
          )}
          {tabInfoArray[currentTabIndex].queryString ===
            TAB_INFO.UpdatePermissions.queryString && <UpdatePermissions />}
          {tabInfoArray[currentTabIndex].queryString ===
            TAB_INFO.Proposals.queryString && (
            <StatusFilterProvider>
              <Proposals />
            </StatusFilterProvider>
          )}
        </MultisigContextProvider>
      </PythContextProvider>
    </Layout>
  )
}

export default Home
