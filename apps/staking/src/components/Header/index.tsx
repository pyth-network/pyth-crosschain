import clsx from "clsx";
import type { HTMLAttributes } from "react";

import { CurrentStakeAccount } from "./current-stake-account";
import Logo from "./logo.svg";
import Logomark from "./logomark.svg";
import { MaxWidth } from "../MaxWidth";
import { WalletButton } from "../WalletButton";

export const Header = ({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children">) => (
  <header
    className={clsx("sticky top-0 mb-4 w-full sm:px-4", className)}
    {...props}
  >
    <div className="border-b border-neutral-600/50 bg-pythpurple-800 sm:border-x">
      <MaxWidth className="flex h-16 items-center justify-between gap-2 sm:-mx-4">
        <Logo className="hidden max-h-full py-4 text-pythpurple-100 sm:block" />
        <Logomark className="max-h-full py-4 text-pythpurple-100 sm:hidden" />
        <div className="flex flex-none flex-row items-stretch gap-8">
          <CurrentStakeAccount />
          <WalletButton className="flex-none" />
        </div>
      </MaxWidth>
    </div>
  </header>
);
