"use client";

import clsx from "clsx";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useId, useMemo } from "react";

import styles from "./index.module.scss";
import { Link } from "../unstyled/Link/index.jsx";

type Props = {
  className?: string | undefined;
  tabs: Omit<TabProps, "bubbleId">[];
};

export const MobileNavTabs = ({ tabs, className }: Props) => {
  const bubbleId = useId();

  return (
    <nav className={clsx(styles.mobileNavTabs, className)}>
      {tabs.map((tab) => (
        <NavTab key={tab.segment} bubbleId={bubbleId} {...tab} />
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
      href={`/${segment}`}
      className={styles.mobileTab ?? ""}
      data-is-selected={isSelected ? "" : undefined}
    >
      {children}
      {isSelected && (
        <motion.span
          layoutId={`${bubbleId}-bubble`}
          className={styles.bubble}
          transition={{ type: "spring", bounce: 0.3, duration: 0.6 }}
          style={{ originY: "top" }}
        />
      )}
    </Link>
  );
};
