import clsx from "clsx";
import Link from "next/link";
import type { HTMLAttributes } from "react";

import Logo from "./logo.svg";
import { NavLink } from "./nav-link";
import { ColorThemeSelector } from "../ColorThemeSelector";
import { MaxWidth } from "../MaxWidth";

export const Header = ({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children">) => (
  <>
    <header
      className={clsx(
        "sticky top-0 w-full bg-white dark:bg-pythpurple-900",
        className,
      )}
      {...props}
    >
      <MaxWidth className="flex h-16 items-center justify-between">
        <Link href="/" className="-ml-4 flex items-center gap-4 px-4 py-2">
          <Logo className="h-8 text-pythpurple-600 dark:text-pythpurple-400" />
          <span className="font-semibold">API Reference</span>
        </Link>
        <div className="-mr-4 flex items-center gap-3">
          <nav
            className="border-r border-neutral-400 pr-3 dark:border-neutral-600"
            aria-label="Main menu"
          >
            <ul className="contents">
              <li className="contents">
                <NavLink href="/price-feeds/evm/getPriceNoOlderThan">
                  Price Feeds
                </NavLink>
              </li>
              <li className="contents">
                <NavLink
                  href="https://benchmarks.pyth.network/docs#/"
                  target="_blank"
                >
                  Benchmarks
                </NavLink>
              </li>
              <li className="contents">
                <NavLink href="/entropy">Entropy</NavLink>
              </li>
            </ul>
          </nav>
          <ColorThemeSelector />
        </div>
      </MaxWidth>
    </header>
  </>
);
