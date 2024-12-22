"use client";

import { MainNavTabs as MainNavTabsComponent } from "@pythnetwork/component-library/MainNavTabs";
import {
  TabPanel as UnstyledTabPanel,
  Tabs,
} from "@pythnetwork/component-library/unstyled/Tabs";
import { useSelectedLayoutSegment, usePathname } from "next/navigation";
import { type ComponentProps } from "react";

import { type VariantArg, LayoutTransition } from "../LayoutTransition";

export const TabRoot = (
  props: Omit<ComponentProps<typeof Tabs>, "selectedKey">,
) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return <Tabs selectedKey={tabId} {...props} />;
};

export const MainNavTabs = (
  props: Omit<
    ComponentProps<typeof MainNavTabsComponent>,
    "pathname" | "items"
  >,
) => {
  const pathname = usePathname();

  return (
    <MainNavTabsComponent
      pathname={pathname}
      items={[
        { href: "/", id: "", children: "Overview" },
        { href: "/publishers", id: "publishers", children: "Publishers" },
        {
          href: "/price-feeds",
          id: "price-feeds",
          children: "Price Feeds",
        },
      ]}
      {...props}
    />
  );
};

export const TabPanel = ({
  children,
  ...props
}: Omit<ComponentProps<typeof UnstyledTabPanel>, "id">) => {
  const tabId = useSelectedLayoutSegment() ?? "";

  return (
    <UnstyledTabPanel key="tabpanel" id={tabId} {...props}>
      {(args) => (
        <LayoutTransition
          variants={{
            initial: (custom) => ({
              opacity: 0,
              x: isMovingLeft(custom) ? "-2%" : "2%",
            }),
            exit: (custom) => ({
              opacity: 0,
              x: isMovingLeft(custom) ? "2%" : "-2%",
              transition: {
                x: { type: "spring", bounce: 0 },
              },
            }),
          }}
          initial="initial"
          animate={{
            opacity: 1,
            x: 0,
            transition: {
              x: { type: "spring", bounce: 0 },
            },
          }}
          exit="exit"
        >
          {typeof children === "function" ? children(args) : children}
        </LayoutTransition>
      )}
    </UnstyledTabPanel>
  );
};

const isMovingLeft = ({ segment, prevSegment }: VariantArg): boolean =>
  segment === null ||
  (segment === "publishers" && prevSegment === "price-feeds");
