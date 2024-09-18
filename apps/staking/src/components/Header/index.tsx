import clsx from "clsx";
import type { HTMLAttributes } from "react";

import { CurrentStakeAccount } from "./current-stake-account";
import { HelpMenu } from "./help-menu";
import Logo from "./logo.svg";
import Logomark from "./logomark.svg";
import { MaxWidth } from "../MaxWidth";
import { WalletButton } from "../WalletButton";

export const Header = ({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children">) => (
  <header className={clsx("sticky top-0 w-full lg:px-4", className)} {...props}>
    <div className="border-b border-neutral-600/50 bg-pythpurple-800 lg:border-x">
      <MaxWidth className="flex h-header items-center justify-between gap-2 lg:-mx-4">
        <Logo className="hidden max-h-full py-4 text-pythpurple-100 sm:block" />
        <Logomark className="max-h-full py-4 text-pythpurple-100 sm:hidden" />
        <div className="flex flex-none flex-row items-stretch gap-4 sm:gap-8">
          <CurrentStakeAccount />
          <WalletButton className="flex-none" />
          <HelpMenu />
        </div>
      </MaxWidth>
    </div>
  </header>
);
