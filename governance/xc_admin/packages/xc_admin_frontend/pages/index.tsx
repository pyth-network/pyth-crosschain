import { Wallet } from '@coral-xyz/anchor'
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import { Tab } from '@headlessui/react'
import { useAnchorWallet } from '@solana/wallet-adapter-react'
import { Keypair } from '@solana/web3.js'
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

export const getServerSideProps: GetServerSideProps = async () => {
  const OPS_WALLET =
    process.env['NEXT_PUBLIC_OPS_WALLET'] &&
    fs.existsSync(String(process.env['NEXT_PUBLIC_OPS_WALLET']))
      ? JSON.parse(
          fs.readFileSync(
            String(process.env['NEXT_PUBLIC_OPS_WALLET']),
            'ascii'
          )
        )
      : null

  const publisherKeyToNameMapping = {
    pythnet: fs.existsSync(
      `${process.env.MAPPING_BASE_PATH || ''}publishers-pythnet.json`
    )
      ? JSON.parse(
          (
            await fs.promises.readFile(
              `${process.env.MAPPING_BASE_PATH || ''}publishers-pythnet.json`
            )
          ).toString()
        )
      : {},
    pythtest: fs.existsSync(
      `${process.env.MAPPING_BASE_PATH || ''}publishers-pythtest.json`
    )
      ? JSON.parse(
          (
            await fs.promises.readFile(
              `${process.env.MAPPING_BASE_PATH || ''}publishers-pythtest.json`
            )
          ).toString()
        )
      : {},
  }
  const multisigSignerMappingFilePath = `${
    process.env.MAPPING_BASE_PATH || ''
  }signers.json`
  const multisigSignerKeyToNameMapping = fs.existsSync(
    multisigSignerMappingFilePath
  )
    ? JSON.parse(
        (await fs.promises.readFile(multisigSignerMappingFilePath)).toString()
      )
    : {}

  return {
    props: {
      OPS_WALLET,
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
  OPS_WALLET: any
  publisherKeyToNameMapping: Record<string, Record<string, string>>
  multisigSignerKeyToNameMapping: Record<string, string>
}> = ({
  OPS_WALLET,
  publisherKeyToNameMapping,
  multisigSignerKeyToNameMapping,
}) => {
  const [currentTabIndex, setCurrentTabIndex] = useState(0)
  const tabInfoArray = Object.values(TAB_INFO)
  const anchorWallet = useAnchorWallet()
  const wallet =
    OPS_WALLET !== null
      ? (new NodeWallet(
          Keypair.fromSecretKey(Uint8Array.from(OPS_WALLET))
        ) as Wallet)
      : (anchorWallet as Wallet)

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
      <PythContextProvider>
        <MultisigContextProvider wallet={wallet}>
          <StatusFilterProvider>
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
            TAB_INFO.General.queryString ? (
              <General />
            ) : tabInfoArray[currentTabIndex].queryString ===
              TAB_INFO.UpdatePermissions.queryString ? (
              <UpdatePermissions />
            ) : tabInfoArray[currentTabIndex].queryString ===
              TAB_INFO.Proposals.queryString ? (
              <Proposals
                publisherKeyToNameMapping={publisherKeyToNameMapping}
                multisigSignerKeyToNameMapping={multisigSignerKeyToNameMapping}
              />
            ) : null}
          </StatusFilterProvider>
        </MultisigContextProvider>
      </PythContextProvider>
    </Layout>
  )
}

export default Home
