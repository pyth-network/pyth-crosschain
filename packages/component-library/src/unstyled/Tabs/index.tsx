"use client";

import { forwardRef } from "react";
import type {TabProps as BaseTabProps} from "react-aria-components";
import { Tab as BaseTab  } from "react-aria-components";

import { usePrefetch } from "../../use-prefetch.js";

export { TabList, TabPanel, Tabs } from "react-aria-components";

type TabProps = BaseTabProps & {
  prefetch?: Parameters<typeof usePrefetch>[0]["prefetch"];
};

export const Tab = forwardRef<HTMLElement, TabProps>(({ onHoverStart, prefetch, ...props }, ref) => {
  const prefetchProps = usePrefetch({
    href: props.href,
    prefetch,
    onHoverStart,
    ref,
  });
  
  return <BaseTab {...props} {...prefetchProps} />;
});

Tab.displayName = 'Tab';