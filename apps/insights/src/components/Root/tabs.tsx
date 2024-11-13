"use client";

import type { Icon } from "@phosphor-icons/react";
import {
  PresentationChart,
  Broadcast,
  ChartLine,
} from "@phosphor-icons/react/dist/ssr";
import clsx from "clsx";
import { m, LazyMotion, domMax } from "framer-motion";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";
import {
  Tab as BaseTab,
  TabPanel as BaseTabPanel,
  TabList as BaseTabList,
  Tabs,
} from "react-aria-components";

export const TabRoot = (
  props: Omit<ComponentProps<typeof Tabs>, "selectedKey">,
) => {
  const layoutSegment = useSelectedLayoutSegment();

  return <Tabs selectedKey={`/${layoutSegment ?? ""}`} {...props} />;
};

export const TabPanel = (
  props: Omit<ComponentProps<typeof BaseTabPanel>, "id">,
) => {
  const layoutSegment = useSelectedLayoutSegment();

  return <BaseTabPanel id={`/${layoutSegment ?? ""}`} {...props} />;
};

export const TabList = () => (
  <LazyMotion features={domMax} strict>
    <BaseTabList
      aria-label="Main Navigation"
      className="hidden flex-row items-center gap-2 lg:flex"
    >
      <Tab href="/" icon={PresentationChart}>
        Overview
      </Tab>
      <Tab href="/publishers" icon={Broadcast}>
        Publishers
      </Tab>
      <Tab href="/price-feeds" icon={ChartLine}>
        Price Feeds
      </Tab>
    </BaseTabList>
  </LazyMotion>
);

type TabProps = Omit<
  ComponentProps<typeof BaseTab>,
  "id" | "href" | "children"
> & {
  icon: Icon;
  href: string;
  children: string;
};

const Tab = ({ href, className, children, icon: Icon, ...props }: TabProps) => (
  <BaseTab
    className={clsx(
      "group/tab relative h-9 cursor-pointer whitespace-nowrap rounded-lg border border-transparent px-button-padding-sm text-sm font-medium leading-9 text-stone-900 outline-none data-[selected]:cursor-default data-[hovered]:bg-black/5 data-[pressed]:bg-black/10 dark:text-steel-50 dark:data-[hovered]:bg-white/5 dark:data-[pressed]:bg-white/10",
      className,
    )}
    id={href}
    href={href}
    {...props}
  >
    {(args) => (
      <>
        {args.isSelected && (
          <m.span
            layoutId="bubble"
            // @ts-expect-error looks like framer-motion isn't typed correctly
            className="absolute inset-0 z-10 rounded-lg bg-white mix-blend-difference outline-2 outline-offset-2 outline-white group-data-[focus-visible]/tab:outline"
            transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
            style={{ originY: "top" }}
          />
        )}
        <span className="inline-grid h-full place-content-center align-top">
          <Icon className="relative size-5" />
        </span>
        <span className="px-2">{children}</span>
      </>
    )}
  </BaseTab>
);
