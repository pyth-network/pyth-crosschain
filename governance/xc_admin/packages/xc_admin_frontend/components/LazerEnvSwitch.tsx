import { Menu, Transition } from '@headlessui/react'
import { useRouter } from 'next/router'
import { Fragment, useCallback, useContext, useEffect } from 'react'
import {
  LazerEnvContext,
  DEFAULT_LAZER_ENV,
  LazerEnv,
} from '../contexts/LazerEnvContext'
import Arrow from '@images/icons/down.inline.svg'

const LazerEnvSwitch = ({ light }: { light?: boolean | null }) => {
  const router = useRouter()

  const { lazerEnv, setLazerEnv } = useContext(LazerEnvContext)
  const handleChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      if (event.target.value) {
        router.query.lazerEnv = event.target.value
        setLazerEnv(event.target.value)
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
    [setLazerEnv, router]
  )

  useEffect(() => {
    router?.query?.lazerEnv
      ? setLazerEnv(router.query.lazerEnv as LazerEnv)
      : setLazerEnv(DEFAULT_LAZER_ENV)
  }, [setLazerEnv, router])

  const environments = [
    {
      value: 'production',
      name: 'production',
    },
    {
      value: 'staging',
      name: 'staging',
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
            <span className="mr-3">{lazerEnv}</span>
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
              {environments.map((env) => (
                <Menu.Item key={env.name}>
                  <button
                    className={`block w-full py-3 px-6 text-left text-sm ${
                      light
                        ? 'bg-beige2 hover:bg-beige3'
                        : 'bg-darkGray hover:bg-darkGray2'
                    } `}
                    value={env.value}
                    onClick={handleChange}
                  >
                    {env.name}
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

export default LazerEnvSwitch
