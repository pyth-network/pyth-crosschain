"use client";

import type { ComponentProps } from "react";
import { Tab as BaseTab } from "react-aria-components";

import { usePrefetch } from "../../use-prefetch.js";

export { TabList, TabPanel, Tabs } from "react-aria-components";

type TabProps = ComponentProps<typeof BaseTab> & {
  prefetch?: Parameters<typeof usePrefetch>[0]["prefetch"];
};

export const Tab = ({ ref, prefetch, onHoverStart, ...props }: TabProps) => {
  const prefetchProps = usePrefetch<HTMLAnchorElement>({
    href: props.href,
    prefetch,
    onHoverStart,
    // TODO Figure this out...
    // @ts-expect-error It doesn't look like refs are getting passed through correctly...
    ref,
  });

  return <BaseTab {...props} {...prefetchProps} />;
};
