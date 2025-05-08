"use client";

import { TabList } from "@pythnetwork/component-library/TabList";
import {
  TabPanel as UnstyledTabPanel,
  Tabs as UnstyledTabs,
} from "@pythnetwork/component-library/unstyled/Tabs";
import { useSelectedLayoutSegment, usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useMemo } from "react";

export const TabRoot = (
  props: Omit<ComponentProps<typeof UnstyledTabs>, "selectedKey">,
) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return <UnstyledTabs selectedKey={tabId} {...props} />;
};

type TabsProps = Omit<ComponentProps<typeof TabList>, "pathname" | "items"> & {
  prefix?: string;
  items: (Omit<
    ComponentProps<typeof TabList>["items"],
    "href" | "id"
  >[number] & {
    segment: string | undefined;
  })[];
};

export const Tabs = ({ prefix, items, ...props }: TabsProps) => {
  const pathname = usePathname();
  const segment = useSelectedLayoutSegment();
  const finalPrefix = useMemo(
    () =>
      (prefix ?? segment === null)
        ? pathname
        : pathname.replace(new RegExp(`/${segment}$`), ""),
    [prefix, pathname, segment],
  );
  const mappedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        id: item.id ?? item.segment ?? "",
        href: item.segment ? `${finalPrefix}/${item.segment}` : finalPrefix,
      })),
    [items, finalPrefix],
  );

  return <TabList currentTab={segment ?? ""} items={mappedItems} {...props} />;
};

export const TabPanel = (
  props: Omit<ComponentProps<typeof UnstyledTabPanel>, "id">,
) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return <UnstyledTabPanel key="tabpanel" id={tabId} {...props} />;
};
