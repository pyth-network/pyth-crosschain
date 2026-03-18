"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { useId } from "react";
import buttonStyles from "../Button/index.module.scss";
import { Tab, TabList } from "../unstyled/Tabs/index.jsx";
import styles from "./index.module.scss";

// biome-ignore lint/suspicious/noRedeclare: Intentionally shadowing Tab to create local type
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
      data-selectable={
        tabs.every((tab) => pathname !== `/${tab.segment}`) ? "" : undefined
      }
      dependencies={[pathname]}
      items={tabs}
      {...props}
    >
      {({ className: tabClassName, children, ...tab }) => (
        <Tab
          className={clsx(styles.tab, buttonStyles.button, tabClassName)}
          data-rounded
          data-size="sm"
          data-variant="ghost"
          href={`/${tab.segment}`}
          id={tab.segment}
          {...tab}
        >
          {(args) => (
            <>
              {args.isSelected && (
                <motion.span
                  className={styles.bubble}
                  layoutId={`${id}-bubble`}
                  style={{ originY: "top" }}
                  transition={{ bounce: 0.3, duration: 0.6, type: "spring" }}
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
