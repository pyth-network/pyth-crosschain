/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { gsap } from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useContext, useEffect, useRef } from "react";
import { ClusterContext, DEFAULT_CLUSTER } from "../../contexts/ClusterContext";
import orb from "../../images/burger.png";
import type { BurgerState } from "./Header";

type MenuProps = {
  headerState: BurgerState;
};

const MobileMenu = ({ headerState }: MenuProps) => {
  const burgerMenu = useRef(null);
  const router = useRouter();
  const { cluster } = useContext(ClusterContext);

  const navigation = [
    {
      href: `/${cluster === DEFAULT_CLUSTER ? "" : `?cluster=${cluster}`}`,
      name: "Main",
      target: "_self",
    },
    {
      href: "https://pyth.network/",
      name: "Pyth Network",
      target: "_blank",
    },
  ];

  useEffect(() => {
    // close menu
    if (headerState.opened) {
      // show menu
      gsap.to(burgerMenu.current, {
        css: { right: "0" },
        duration: 0.3,
        ease: "power4.out",
      });
      gsap.set(document.body, { overflow: "hidden" });
    } else {
      gsap.to(burgerMenu.current, {
        css: { right: "-100%" },
        duration: 0.3,
        ease: "power4.out",
      });
      gsap.set(document.body, { overflow: "initial" });
    }
  }, [headerState]);

  return (
    <div
      className="fixed top-0 -right-full  z-30  h-full w-full overscroll-y-none bg-darkGray landscape:overflow-auto  "
      ref={burgerMenu}
    >
      <div className="relative flex min-h-[100vh] flex-col sm:justify-between">
        <Image
          alt=""
          className="w-full h-full object-cover object-bottom"
          src={orb}
        />
        <div className="sm:after:gradient-border relative flex px-14 pt-16 sm:flex-1 sm:items-center md:px-28 ">
          <div className="grid w-full sm:grid-cols-2">
            <ul className="list-none pt-5 sm:pt-10">
              {navigation.map((item) => (
                <li className="mb-5 sm:mb-10" key={item.name}>
                  <Link
                    aria-current={
                      router.pathname === item.href ? "page" : undefined
                    }
                    className=" inline-block font-body  text-4xl leading-none tracking-wide transition-colors hover:text-white"
                    href={item.href}
                    target={item.target}
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
  );
};

export default MobileMenu;
