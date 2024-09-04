"use client";

import clsx from "clsx";
import type { HTMLAttributes } from "react";

import Logo from "./logo.svg";
import { MaxWidth } from "../MaxWidth";
import { WalletButton } from "../WalletButton";

export const Header = ({
  className,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, "children">) => (
  <header
    className={clsx("sticky top-0 mb-4 w-full px-4", className)}
    {...props}
  >
    <div className="border-x border-b border-neutral-600/50 bg-pythpurple-800">
      <MaxWidth className="-mx-4 flex h-16 items-center justify-between">
        <Logo className="h-full py-4 text-pythpurple-100" />
        <WalletButton />
      </MaxWidth>
    </div>
  </header>
);
