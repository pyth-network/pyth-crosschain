"use client";

import {
  Tab,
  TabList as UnstyledTabList,
} from "@pythnetwork/component-library/unstyled/Tabs";
import clsx from "clsx";
import { motion } from "motion/react";
import type { ComponentProps } from "react";
import { useId } from "react";

import styles from "./tab-list.module.scss";

type OwnProps = {
  label: string;
  items: (ComponentProps<typeof Tab> & { header: string; body: string })[];
};
type Props = Omit<ComponentProps<typeof UnstyledTabList>, keyof OwnProps> &
  OwnProps;

export const TabList = ({ label, className, ...props }: Props) => {
  const layoutId = useId();

  return (
    <UnstyledTabList
      aria-label={label}
      className={clsx(className, styles.tabList)}
      {...props}
    >
      {({ header, body, className: tabClassName, ...tabProps }) => (
        <Tab className={clsx(styles.tab, tabClassName)} {...tabProps}>
          {(args) => (
            <>
              <h2>{header}</h2>
              <p>{body}</p>
              {args.isSelected && (
                <motion.span
                  layoutId={layoutId}
                  className={styles.bar}
                  transition={{ type: "spring", bounce: 0.6, duration: 0.6 }}
                  style={{ originX: "left" }}
                />
              )}
            </>
          )}
        </Tab>
      )}
    </UnstyledTabList>
  );
};
