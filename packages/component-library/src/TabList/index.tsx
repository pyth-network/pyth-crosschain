"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import buttonStyles from "../Button/index.module.scss";
import { Tab, TabList as UnstyledTabList } from "../unstyled/Tabs/index.jsx";
import styles from "./index.module.scss";

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
      className={styles.tabList ?? ""}
      dependencies={[currentTab]}
      {...props}
    >
      {({ className: tabClassName, children, ...tab }) => (
        <Tab
          className={clsx(styles.tab, buttonStyles.button, tabClassName)}
          data-selectable={currentTab === tab.id ? undefined : ""}
          data-size="sm"
          data-variant="ghost"
          {...tab}
        >
          {(args) => (
            <>
              <span className={buttonStyles.text}>
                {typeof children === "function" ? children(args) : children}
              </span>
              {args.isSelected && (
                <motion.span
                  className={styles.underline}
                  layoutId="underline"
                  style={{ originY: "top" }}
                  transition={{ bounce: 0.6, duration: 0.6, type: "spring" }}
                />
              )}
            </>
          )}
        </Tab>
      )}
    </UnstyledTabList>
  </div>
);
