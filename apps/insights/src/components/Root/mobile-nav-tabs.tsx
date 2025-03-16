"use client";

import { Link } from "@pythnetwork/component-library/unstyled/Link";
import clsx from "clsx";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useId, useMemo } from "react";

import styles from "./mobile-nav-tabs.module.scss";

type Props = {
  className?: string | undefined;
  tabs: Tab[];
};

type Tab = {
  href: string;
  children: ReactNode;
};

export const MobileNavTabs = ({ tabs, className }: Props) => {
  const bubbleId = useId();

  return (
    <nav className={clsx(styles.mobileNavTabs, className)}>
      {tabs.map((tab) => (
        <NavTab tab={tab} key={tab.href} bubbleId={bubbleId} />
      ))}
    </nav>
  );
};

type TabProps = {
  tab: Tab;
  bubbleId: string;
};

const NavTab = ({ tab, bubbleId }: TabProps) => {
  const pathname = usePathname();
  const isSelected = useMemo(
    () => (tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)),
    [tab.href, pathname],
  );

  return (
    <Link
      href={tab.href}
      className={styles.mobileTab ?? ""}
      data-is-selected={isSelected ? "" : undefined}
    >
      {tab.children}
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
