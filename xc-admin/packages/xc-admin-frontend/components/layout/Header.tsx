import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useContext, useEffect, useState } from 'react'
import { ClusterContext, DEFAULT_CLUSTER } from '../../contexts/ClusterContext'
import Pyth from '../../images/logomark.inline.svg'
import MobileMenu from './MobileMenu'

export interface BurgerState {
  initial: boolean | null
  opened: boolean | null
}

function Header() {
  const { cluster } = useContext(ClusterContext)
  const router = useRouter()
  const [isSticky, setIsSticky] = useState(false)

  const navigation = [
    {
      name: 'Main',
      href: `/${
        cluster === DEFAULT_CLUSTER ? '' : `?cluster=${cluster}`
      }`,
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

  const brandAssetsLink = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault()
    router.push('/brand')
  }

  return (
    <>
      <header
        className={`left-0 top-0 z-40 w-full px-1 transition-all lg:px-10 
        ${isSticky || headerState.opened ? 'fixed ' : 'absolute'} 
        ${isSticky && !headerState.opened ? 'bg-darkGray shadow-black' : ''} 
        `}
      >
        <div
          className={`relative flex items-center justify-between ${
            isSticky ? 'lg:py-4' : 'before:gradient-border md:py-6'
          }
					 ${
             !headerState.opened
               ? 'px-4 py-3 lg:px-10 lg:py-6'
               : 'sm:px-4  sm:py-3  sm:lg:px-10  sm:lg:py-6'
           }
					`}
        >
          <Link href="/">
            <a
              className={`basis-7 ${
                headerState.opened &&
                'fixed left-5 top-3 sm:relative sm:left-0 sm:top-0'
              }`}
              onContextMenu={brandAssetsLink}
            >
              <Pyth />
            </a>
          </Link>
          <nav>
            <ul
              className={`hidden list-none lg:flex ${
                headerState.opened && 'hidden'
              }`}
            >
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link href={item.href}>
                    <a
                      className={`px-6 text-sm leading-none tracking-wide transition-colors hover:text-white lg:px-6 xl:px-8 ${
                        router.pathname === item.href
                          ? 'text-white'
                          : 'text-light'
                      }`}
                      aria-current={
                        router.pathname === item.href ? 'page' : undefined
                      }
                      target={item.target}
                    >
                      {item.name}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div
            className={`basis-7 ${
              headerState.opened &&
              'fixed right-5 top-[20px] sm:relative sm:left-0 sm:top-0'
            }`}
            onClick={handleToggleMenu}
          >
            <button className="group ml-auto block lg:hidden">
              <span
                className={`ml-auto block h-0.5 w-3.5  rounded-sm bg-light transition-all lg:group-hover:w-5 ${
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
      </header>
      <MobileMenu headerState={headerState} setHeaderState={setHeaderState} />
    </>
  )
}

export default Header
