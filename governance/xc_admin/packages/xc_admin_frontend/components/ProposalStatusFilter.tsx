import { Menu, Transition } from '@headlessui/react'
import { useRouter } from 'next/router'
import { Fragment, useCallback, useContext, useEffect } from 'react'
import {
  DEFAULT_STATUS_FILTER,
  type ProposalStatusFilter,
  StatusFilterContext,
} from '../contexts/StatusFilterContext'
import Arrow from '@images/icons/down.inline.svg'

const ProposalStatusFilter = () => {
  const router = useRouter()
  const { statusFilter, setStatusFilter } = useContext(StatusFilterContext)

  const handleChange = useCallback(
    (event: any) => {
      if (event.target.value) {
        router.query.status = event.target.value
        setStatusFilter(event.target.value)
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
    [setStatusFilter, router]
  )

  useEffect(() => {
    router.query && router.query.status
      ? setStatusFilter(router.query.status as ProposalStatusFilter)
      : setStatusFilter(DEFAULT_STATUS_FILTER)
  }, [setStatusFilter, router])

  const statuses: ProposalStatusFilter[] = [
    'all',
    'active',
    'executed',
    'executeReady',
    'cancelled',
    'rejected',
    'draft',
    'expired',
  ]

  return (
    <Menu as="div" className="relative z-[3] block w-[180px] text-left">
      {({ open }) => (
        <>
          <Menu.Button
            className={`inline-flex w-full items-center justify-between bg-darkGray2 py-3 px-6 text-sm outline-0`}
          >
            <span className="mr-3">{statusFilter}</span>
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
              {statuses.map((s) => (
                <Menu.Item key={s}>
                  <button
                    className={`block w-full bg-darkGray py-3 px-6 text-left text-sm hover:bg-darkGray2`}
                    value={s}
                    onClick={handleChange}
                  >
                    {s}
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

export default ProposalStatusFilter
