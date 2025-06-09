"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useId } from "react";

import styles from "./index.module.scss";
import buttonStyles from "../Button/index.module.scss";
import { Tab, TabList } from "../unstyled/Tabs/index.jsx";

type Tab = Omit<ComponentProps<typeof Tab>, "id" | "href"> & {
  segment: string;
};

type OwnProps = {
  tabs: Tab[];
};

type Props = Omit<ComponentProps<typeof TabList>, keyof OwnProps | "items"> &
  OwnProps;

export const MainNavTabs = ({ className, tabs, ...props }: Props) => {
  const pathname = usePathname();
  const id = useId();
  return (
    <TabList
      aria-label="Main Navigation"
      className={clsx(styles.mainNavTabs, className)}
      dependencies={[pathname]}
      data-selectable={
        tabs.every((tab) => pathname !== `/${tab.segment}`) ? "" : undefined
      }
      items={tabs}
      {...props}
    >
      {({ className: tabClassName, children, ...tab }) => (
        <Tab
          className={clsx(styles.tab, buttonStyles.button, tabClassName)}
          data-size="sm"
          data-variant="ghost"
          data-rounded
          id={tab.segment}
          href={`/${tab.segment}`}
          {...tab}
        >
          {(args) => (
            <>
              {args.isSelected && (
                <motion.span
                  layoutId={`${id}-bubble`}
                  className={styles.bubble}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
                  style={{ originY: "top" }}
                />
              )}
              <span className={buttonStyles.text}>
                {typeof children === "function" ? children(args) : children}
              </span>
            </>
          )}
        </Tab>
      )}
    </TabList>
  );
};
