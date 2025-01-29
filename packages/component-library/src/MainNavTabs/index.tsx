"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { type ComponentProps, useId } from "react";

import styles from "./index.module.scss";
import buttonStyles from "../Button/index.module.scss";
import { Tab, TabList } from "../unstyled/Tabs/index.js";

type OwnProps = {
  pathname?: string | undefined;
  items: ComponentProps<typeof Tab>[];
};
type Props = Omit<ComponentProps<typeof TabList>, keyof OwnProps> & OwnProps;

export const MainNavTabs = ({ className, pathname, ...props }: Props) => {
  const id = useId();
  return (
    <TabList
      aria-label="Main Navigation"
      className={clsx(styles.mainNavTabs, className)}
      dependencies={[pathname]}
      {...props}
    >
      {({ className: tabClassName, children, ...tab }) => (
        <Tab
          className={clsx(styles.tab, buttonStyles.button, tabClassName)}
          data-size="sm"
          data-variant="ghost"
          data-rounded
          data-selectable={pathname === tab.href ? undefined : ""}
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
