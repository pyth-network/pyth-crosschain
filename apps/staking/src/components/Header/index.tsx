import clsx from "clsx";
import type { HTMLAttributes } from "react";

import { CurrentStakeAccount } from "./current-stake-account";
import { HelpMenu } from "./help-menu";
import Logo from "./logo.svg";
import Logomark from "./logomark.svg";
import { Stats } from "./stats";
import { Link } from "../Link";
import { MaxWidth } from "../MaxWidth";
import { WalletButton } from "../WalletButton";

export const Header = ({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children">) => (
  <>
    <header
      className={clsx("sticky top-0 w-full lg:px-4", className)}
      {...props}
    >
      <div className="border-b border-neutral-600/50 bg-pythpurple-800 lg:border-x">
        <MaxWidth className="flex h-header items-center justify-between gap-2 lg:-mx-4">
          <div className="flex flex-row items-center gap-6 xl:gap-12">
            <Link
              href="/"
              className="-mx-2 h-[calc(var(--header-height)_-_0.5rem)] rounded-sm p-2 text-pythpurple-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400"
            >
              <Logo className="hidden h-full lg:block" />
              <Logomark className="h-full lg:hidden" />
              <span className="sr-only">Pyth Staking</span>
            </Link>
            <Stats className="hidden gap-4 lg:flex xl:gap-6" />
          </div>
          <div className="flex flex-none flex-row items-stretch gap-4 xl:gap-8">
            <CurrentStakeAccount />
            <WalletButton className="flex-none" />
            <HelpMenu />
          </div>
        </MaxWidth>
      </div>
    </header>
    <Stats className="border-b border-neutral-600/50 py-4 text-center lg:hidden" />
  </>
);
