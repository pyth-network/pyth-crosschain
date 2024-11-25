"use client";

import clsx from "clsx";
import { m, LazyMotion, domMax } from "motion/react";
import type { ComponentProps } from "react";

import styles from "./index.module.scss";
import buttonStyles from "../Button/index.module.scss";
import { UnstyledTab, UnstyledTabList } from "../UnstyledTabs/index.js";

type TabListProps = {
  tabs: ComponentProps<typeof UnstyledTab>[];
};

export const AppTabs = ({ tabs }: TabListProps) => (
  <LazyMotion features={domMax} strict>
    <UnstyledTabList
      aria-label="Main Navigation"
      className={styles.appTabs ?? ""}
      items={tabs}
    >
      {({ className, children, ...tab }) => (
        <UnstyledTab
          className={clsx(styles.tab, buttonStyles.button, className)}
          data-size="sm"
          data-variant="ghost"
          data-rounded
          {...tab}
        >
          {(args) => (
            <>
              {args.isSelected && (
                <m.span
                  layoutId="bubble"
                  // @ts-expect-error Looks like framer-motion has a bug in it's typings...
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
  </LazyMotion>
);
