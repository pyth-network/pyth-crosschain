"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useId, useMemo } from "react";
import { Link } from "../unstyled/Link/index.jsx";
import styles from "./index.module.scss";

type Props = {
  className?: string | undefined;
  tabs: Omit<TabProps, "bubbleId">[];
};

export const MobileNavTabs = ({ tabs, className }: Props) => {
  const bubbleId = useId();

  return (
    <nav className={clsx(styles.mobileNavTabs, className)}>
      {tabs.map((tab) => (
        <NavTab bubbleId={bubbleId} key={tab.segment} {...tab} />
      ))}
    </nav>
  );
};

type TabProps = {
  segment: string;
  children: ReactNode;
  bubbleId: string;
};

const NavTab = ({ segment, bubbleId, children }: TabProps) => {
  const pathname = usePathname();
  const isSelected = useMemo(
    () =>
      segment === "" ? pathname === "/" : pathname.startsWith(`/${segment}`),
    [segment, pathname],
  );

  return (
    <Link
      className={styles.mobileTab ?? ""}
      data-is-selected={isSelected ? "" : undefined}
      href={`/${segment}`}
    >
      {children}
      {isSelected && (
        <motion.span
          className={styles.bubble}
          layoutId={`${bubbleId}-bubble`}
          style={{ originY: "top" }}
          transition={{ bounce: 0.3, duration: 0.6, type: "spring" }}
        />
      )}
    </Link>
  );
};
