"use client";

import {
  UnstyledTabPanel,
  UnstyledTabs,
} from "@pythnetwork/component-library/UnstyledTabs";
import { useSelectedLayoutSegment } from "next/navigation";
import type { ComponentProps } from "react";

export const TabRoot = (
  props: Omit<ComponentProps<typeof UnstyledTabs>, "selectedKey">,
) => {
  const layoutSegment = useSelectedLayoutSegment();

  return <UnstyledTabs selectedKey={`/${layoutSegment ?? ""}`} {...props} />;
};

export const TabPanel = (
  props: Omit<ComponentProps<typeof UnstyledTabPanel>, "id">,
) => {
  const layoutSegment = useSelectedLayoutSegment();

  return <UnstyledTabPanel id={`/${layoutSegment ?? ""}`} {...props} />;
};
