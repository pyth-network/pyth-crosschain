import { gsap } from 'gsap'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useContext, useEffect, useRef } from 'react'
import { ClusterContext, DEFAULT_CLUSTER } from '../../contexts/ClusterContext'
import { BurgerState } from './Header'

import orb from '@images/burger.png'

interface MenuProps {
  headerState: BurgerState
}

const MobileMenu = ({ headerState }: MenuProps) => {
  const burgerMenu = useRef(null)
  const router = useRouter()
  const { cluster } = useContext(ClusterContext)

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

  useEffect(() => {
    // close menu
    if (!headerState.opened) {
      gsap.to(burgerMenu.current, {
        duration: 0.3,
        ease: 'power4.out',
        css: { right: '-100%' },
      })
      gsap.set(document.body, { overflow: 'initial' })
    } else {
      // show menu
      gsap.to(burgerMenu.current, {
        duration: 0.3,
        ease: 'power4.out',
        css: { right: '0' },
      })
      gsap.set(document.body, { overflow: 'hidden' })
    }
  }, [headerState])

  return (
    <div
      ref={burgerMenu}
      className="fixed top-0 -right-full  z-30  h-full w-full overscroll-y-none bg-darkGray landscape:overflow-auto  "
    >
      <div className="relative flex min-h-[100vh] flex-col sm:justify-between">
        <Image
          src={orb}
          alt=""
          className="w-full h-full object-cover object-bottom"
        />
        <div className="sm:after:gradient-border relative flex px-14 pt-16 sm:flex-1 sm:items-center md:px-28 ">
          <div className="grid w-full sm:grid-cols-2">
            <ul className="list-none pt-5 sm:pt-10">
              {navigation.map((item) => (
                <li key={item.name} className="mb-5 sm:mb-10">
                  <Link
                    href={item.href}
                    target={item.target}
                    className=" inline-block font-body  text-4xl leading-none tracking-wide transition-colors hover:text-white"
                    aria-current={
                      router.pathname === item.href ? 'page' : undefined
                    }
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileMenu
