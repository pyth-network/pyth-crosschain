import { Menu, Transition } from '@headlessui/react'
import { useRouter } from 'next/router'
import { Fragment, useCallback, useContext, useEffect } from 'react'
import { ClusterContext, DEFAULT_CLUSTER } from '../contexts/ClusterContext'
import Arrow from '@images/icons/down.inline.svg'
import { PythCluster } from '@pythnetwork/client'

const ClusterSwitch = ({ light }: { light?: boolean | null }) => {
  const router = useRouter()

  const { cluster, setCluster } = useContext(ClusterContext)
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      if (event.target.value) {
        router.query.cluster = event.target.value
        setCluster(event.target.value)
        router.push(
          {
            pathname: router.pathname,
            query: router.query,
          },
          undefined,
          { scroll: false }
        )
      }
    },
    [setCluster, router]
  )

  useEffect(() => {
    router?.query?.cluster
      ? setCluster(router.query.cluster as PythCluster)
      : setCluster(DEFAULT_CLUSTER)
  }, [setCluster, router])

  const clusters = [
    {
      value: 'pythnet',
      name: 'pythnet',
    },
    {
      value: 'mainnet-beta',
      name: 'mainnet-beta',
    },
    {
      value: 'testnet',
      name: 'testnet',
    },
    {
      value: 'devnet',
      name: 'devnet',
    },
    {
      value: 'pythtest-conformance',
      name: 'pythtest-conformance',
    },
    {
      value: 'pythtest-crosschain',
      name: 'pythtest-crosschain',
    },
  ]

  return (
    <Menu as="div" className="relative z-[3] block w-[180px] text-left">
      {({ open }) => (
        <>
          <Menu.Button
            className={`inline-flex w-full items-center justify-between py-3 px-6 text-sm outline-0 ${
              light ? 'bg-beige2' : 'bg-darkGray2'
            }`}
          >
            <span className="mr-3">{cluster}</span>
            <Arrow className={`${open && 'rotate-180'}`} />
          </Menu.Button>
          <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
          >
            <Menu.Items className="absolute right-0 mt-2 w-full origin-top-right">
              {clusters.map((c) => (
                <Menu.Item key={c.name}>
                  <button
                    className={`block w-full py-3 px-6 text-left text-sm ${
                      light
                        ? 'bg-beige2 hover:bg-beige3'
                        : 'bg-darkGray hover:bg-darkGray2'
                    } `}
                    value={c.value}
                    onClick={handleChange}
                  >
                    {c.name}
                  </button>
                </Menu.Item>
              ))}
            </Menu.Items>
          </Transition>
        </>
      )}
    </Menu>
  )
}

export default ClusterSwitch
