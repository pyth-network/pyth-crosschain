"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";

import { Tabs, TabPanel as UnstyledTabPanel } from "../unstyled/Tabs/index.jsx";

export const TabRoot = (
  props: Omit<ComponentProps<typeof Tabs>, "selectedKey">,
) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return <Tabs selectedKey={tabId} {...props} />;
};

export const TabPanel = (
  props: Omit<ComponentProps<typeof UnstyledTabPanel>, "id">,
) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return <UnstyledTabPanel key="tabpanel" id={tabId} {...props} />;
};
