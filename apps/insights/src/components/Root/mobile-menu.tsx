import type { Icon } from "@phosphor-icons/react";
import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { ChartLine } from "@phosphor-icons/react/dist/ssr/ChartLine";
import { List } from "@phosphor-icons/react/dist/ssr/List";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { PresentationChart } from "@phosphor-icons/react/dist/ssr/PresentationChart";
import type { ComponentProps, ReactNode } from "react";

import { NavLink } from "./nav-link";

export const MobileMenu = () => (
  <nav className="contents lg:hidden">
    <ul className="sticky bottom-0 isolate z-20 flex size-full flex-row items-stretch bg-white dark:bg-steel-950">
      <MobileMenuItem title="Overview" icon={PresentationChart} href="/" />
      <MobileMenuItem title="Publishers" icon={Broadcast} href="/publishers" />
      <MobileMenuItem
        title="Price Feeds"
        icon={ChartLine}
        href="/price-feeds"
      />
      <MobileMenuItem title="Search" icon={MagnifyingGlass} href="/" />
      <MobileMenuItem title="More" icon={List} href="/" />
    </ul>
  </nav>
);

type MobileMenuItemProps = ComponentProps<typeof NavLink> & {
  title: ReactNode;
  icon: Icon;
};

const MobileMenuItem = ({
  title,
  icon: Icon,
  ...props
}: MobileMenuItemProps) => (
  <li className="contents">
    <NavLink
      className="flex grow basis-0 flex-col items-center gap-2 py-4 outline-none transition duration-100 data-[focus-visible]:bg-black/5 data-[hovered]:bg-black/5 data-[pressed]:bg-black/10 data-[selected]:bg-steel-900 data-[selected]:text-steel-50 dark:data-[selected]:bg-steel-50 dark:data-[selected]:text-steel-900"
      {...props}
    >
      <Icon className="size-5" />
      <div className="text-center text-xs font-medium">{title}</div>
    </NavLink>
  </li>
);
