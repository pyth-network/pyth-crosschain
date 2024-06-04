import type { ReactNode } from "react";

import { MaxWidth } from "../MaxWidth";
import { Sidebar } from "../Sidebar";

type PriceFeedsProps = {
  children: ReactNode;
};

export const PriceFeeds = ({ children }: PriceFeedsProps) => (
  <MaxWidth className="relative flex min-h-full flex-row">
    <Sidebar className="border-r border-neutral-400 dark:border-neutral-600" />
    <main className="min-w-0 grow basis-0 p-10 pr-0">{children}</main>
  </MaxWidth>
);
