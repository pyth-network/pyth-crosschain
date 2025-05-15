"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import buttonStyles from "../Button/index.module.scss";
import { Tab, TabList as UnstyledTabList } from "../unstyled/Tabs/index.jsx";

type OwnProps = {
  label: string;
  currentTab?: string | undefined;
  items: ComponentProps<typeof Tab>[];
};
type Props = Omit<ComponentProps<typeof UnstyledTabList>, keyof OwnProps> &
  OwnProps;

export const TabList = ({ label, className, currentTab, ...props }: Props) => (
  <div className={clsx(styles.tabs, className)}>
    <UnstyledTabList
      aria-label={label}
      dependencies={[currentTab]}
      className={styles.tabList ?? ""}
      {...props}
    >
      {({ className: tabClassName, children, ...tab }) => (
        <Tab
          className={clsx(styles.tab, buttonStyles.button, tabClassName)}
          data-size="sm"
          data-variant="ghost"
          data-selectable={currentTab === tab.id ? undefined : ""}
          {...tab}
        >
          {(args) => (
            <>
              <span className={buttonStyles.text}>
                {typeof children === "function" ? children(args) : children}
              </span>
              {args.isSelected && (
                <motion.span
                  layoutId="underline"
                  className={styles.underline}
                  transition={{ type: "spring", bounce: 0.6, duration: 0.6 }}
                  style={{ originY: "top" }}
                />
              )}
            </>
          )}
        </Tab>
      )}
    </UnstyledTabList>
  </div>
);
