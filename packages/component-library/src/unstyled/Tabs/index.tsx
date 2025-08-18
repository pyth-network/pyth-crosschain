"use client";

import type { ComponentProps } from "react";
import { Tab as BaseTab } from "react-aria-components";

import { usePrefetch } from "../../use-prefetch.js";

export { TabList, TabPanel, Tabs } from "react-aria-components";

type TabProps = ComponentProps<typeof BaseTab> & {
  prefetch?: Parameters<typeof usePrefetch>[0]["prefetch"];
};

export const Tab = ({ ref, prefetch, onHoverStart, ...props }: TabProps) => {
  const prefetchProps = usePrefetch({
    href: props.href,
    prefetch,
    onHoverStart,
    ref,
  });

  return <BaseTab {...props} {...prefetchProps} />;
};
