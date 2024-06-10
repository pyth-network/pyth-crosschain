import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { ClusterContext, DEFAULT_CLUSTER } from '../../contexts/ClusterContext'
import Pyth from '@images/logomark.inline.svg'
import MobileMenu from './MobileMenu'

const WalletMultiButtonDynamic = dynamic(
  async () =>
    (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
)

export interface BurgerState {
  initial: boolean | null
  opened: boolean | null
}

const Header = () => {
  const { cluster } = useContext(ClusterContext)
  const router = useRouter()
  const [isSticky, setIsSticky] = useState(false)

  const navigation = [
    {
      name: 'Main',
      href: `/${cluster === DEFAULT_CLUSTER ? '' : `?cluster=${cluster}`}`,
      target: '_self',
    },
    {
      name: 'Pyth Network',
      href: 'https://pyth.network/',
      target: '_blank',
    },
  ]

  const [headerState, setHeaderState] = useState<BurgerState>({
    initial: false,
    opened: null,
  })

  // Toggle menu
  const handleToggleMenu = () => {
    if (headerState.initial === false) {
      setHeaderState({
        initial: null,
        opened: true,
      })
    } else {
      setHeaderState({
        ...headerState,
        opened: !headerState.opened,
      })
    }
  }

  useEffect(() => {
    window.addEventListener('scroll', ifSticky)
    return () => {
      window.removeEventListener('scroll', ifSticky)
    }
  })

  const ifSticky = () => {
    const scrollTop = window.scrollY
    if (!headerState.opened) {
      scrollTop >= 250 ? setIsSticky(true) : setIsSticky(false)
    }
  }

  return (
    <>
      <header
        className={`left-0 top-0 z-40 w-full px-1 transition-all lg:px-10
      ${isSticky || headerState.opened ? 'fixed' : 'absolute'}
      ${isSticky && !headerState.opened ? 'bg-darkGray shadow-black' : ''}
      `}
      >
        <div
          className={`relative flex items-center justify-between ${
            isSticky ? 'lg:py-4' : 'before:gradient-border md:py-6'
          } px-4 py-3 lg:px-10 lg:py-6`}
        >
          <Link
            href="/"
            className={`flex min-h-[45px] basis-[180px] cursor-pointer items-center`}
          >
            <Pyth />
          </Link>
          <nav>
            <ul
              className={`list-none space-x-10 ${
                headerState.opened ? 'hidden' : 'hidden lg:flex'
              }`}
            >
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={
                      router.pathname == item.href
                        ? 'nav-link font-bold'
                        : 'nav-link'
                    }
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center justify-end space-x-2">
            <div className="h-[45px] w-[180px]">
              {headerState.opened ? null : (
                <WalletMultiButtonDynamic className="primary-btn float-right pt-0.5" />
              )}
            </div>
            <div
              className={`${
                headerState.opened
                  ? 'relative top-0 right-5 left-0 basis-7'
                  : 'lg:hidden'
              }
            `}
              onClick={handleToggleMenu}
            >
              <button
                className={`group ml-auto align-middle ${
                  headerState.opened ? 'block' : 'lg:hidden'
                }`}
              >
                <span
                  className={`ml-auto block h-0.5 w-3.5 rounded-sm bg-light transition-all lg:group-hover:w-5 ${
                    headerState.opened
                      ? 'mb-0 w-5 translate-y-1 rotate-45'
                      : 'mb-1'
                  }`}
                ></span>
                <span
                  className={`mb-1 block h-0.5 w-5 rounded-sm bg-light transition-all ${
                    headerState.opened && 'opacity-0'
                  }`}
                ></span>
                <span
                  className={`ml-auto block h-0.5 w-3.5 rounded-sm bg-light transition-all lg:group-hover:w-5 ${
                    headerState.opened
                      ? 'mb-0 w-5 -translate-y-1 -rotate-45'
                      : 'mb-1'
                  }`}
                ></span>
              </button>
            </div>
          </div>
        </div>
      </header>
      <MobileMenu headerState={headerState} />
    </>
  )
}

export default Header
