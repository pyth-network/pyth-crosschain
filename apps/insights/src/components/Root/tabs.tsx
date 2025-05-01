"use client";

import { MainNavTabs as MainNavTabsComponent } from "@pythnetwork/component-library/MainNavTabs";
import {
  TabPanel as UnstyledTabPanel,
  Tabs,
} from "@pythnetwork/component-library/unstyled/Tabs";
import { useSelectedLayoutSegment, usePathname } from "next/navigation";
import type { ComponentProps } from "react";

export const TabRoot = (
  props: Omit<ComponentProps<typeof Tabs>, "selectedKey">,
) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return <Tabs selectedKey={tabId} {...props} />;
};

export const MainNavTabs = (
  props: Omit<ComponentProps<typeof MainNavTabsComponent>, "pathname">,
) => {
  const pathname = usePathname();

  return <MainNavTabsComponent pathname={pathname} {...props} />;
};

export const TabPanel = (
  props: Omit<ComponentProps<typeof UnstyledTabPanel>, "id">,
) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return <UnstyledTabPanel key="tabpanel" id={tabId} {...props} />;
};
