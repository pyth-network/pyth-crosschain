import { Tab } from '@headlessui/react'
import type { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import MinPublishers from '../components/tabs/MinPublishers'
import UpdatePermissions from '../components/tabs/UpdatePermissions'
import { PythContextProvider } from '../contexts/PythContext'
import { classNames } from '../utils/classNames'

const TabInfo = {
  MinPublishers: {
    title: 'Min Publishers',
    description:
      'Set the minimum number of publishers required to publish a price.',
    queryString: 'min-publishers',
  },
  UpdatePermissions: {
    title: 'Update Permissions',
    description: 'Update the permissions of the program.',
    queryString: 'update-permissions',
  },
}

const DEFAULT_TAB = 'min-publishers'

const Home: NextPage = () => {
  const [currentTabIndex, setCurrentTabIndex] = useState(0)

  const router = useRouter()

  // set current tab value when tab is clicked
  const handleChangeTab = (index: number) => {
    router.query.tab = Object.values(TabInfo)[index].queryString
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
          Object.values(TabInfo).findIndex(
            (v) => v.queryString === router.query.tab
          )
        )
      : setCurrentTabIndex(
          Object.values(TabInfo).findIndex((v) => v.queryString === DEFAULT_TAB)
        )
  }, [router])

  return (
    <Layout>
      <PythContextProvider>
        <div className="relative pt-16 md:pt-20">
          <div className="py-8 md:py-16">
            <Tab.Group
              selectedIndex={currentTabIndex}
              onChange={handleChangeTab}
            >
              <Tab.List className="mx-auto max-w-[526px] gap-1 space-x-4 text-center sm:gap-2.5 md:space-x-8">
                {Object.entries(TabInfo).map((tab, idx) => (
                  <Tab
                    key={idx}
                    className={({ selected }) =>
                      classNames(
                        'p-3 text-xs font-semibold uppercase outline-none transition-colors md:text-base',
                        currentTabIndex === idx
                          ? 'bg-darkGray3'
                          : 'bg-darkGray2',
                        selected ? 'bg-darkGray3' : 'hover:bg-darkGray3'
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
        {currentTabIndex !== -1 &&
          (Object.values(TabInfo)[currentTabIndex].queryString ===
          TabInfo.MinPublishers.queryString ? (
            <MinPublishers />
          ) : Object.values(TabInfo)[currentTabIndex].queryString ===
            TabInfo.UpdatePermissions.queryString ? (
            <UpdatePermissions />
          ) : null)}
      </PythContextProvider>
    </Layout>
  )
}

export default Home
