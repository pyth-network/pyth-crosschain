"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import buttonStyles from "../Button/index.module.scss";
import { UnstyledTab, UnstyledTabList } from "../UnstyledTabs/index.js";

type OwnProps = {
  pathname?: string | undefined;
  items: ComponentProps<typeof UnstyledTab>[];
};
type Props = Omit<ComponentProps<typeof UnstyledTabList>, keyof OwnProps> &
  OwnProps;

export const MainNavTabs = ({ className, pathname, ...props }: Props) => (
  <UnstyledTabList
    aria-label="Main Navigation"
    className={clsx(styles.mainNavTabs, className)}
    dependencies={[pathname]}
    {...props}
  >
    {({ className: tabClassName, children, ...tab }) => (
      <UnstyledTab
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
                layoutId="bubble"
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
      </UnstyledTab>
    )}
  </UnstyledTabList>
);
