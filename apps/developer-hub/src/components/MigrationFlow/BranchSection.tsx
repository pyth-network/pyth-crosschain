"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

import styles from "./index.module.scss";
import type { MigrationPath } from "./path-store";
import { useMigrationPath } from "./path-store";

type Props = {
  path: MigrationPath;
  children: ReactNode;
};

export const BranchSection = ({ path: forPath, children }: Props) => {
  const [activePath] = useMigrationPath();
  const isActive = activePath === forPath;
  return (
    <div
      className={clsx(styles.branchSection, isActive ? styles.branchActive : styles.branchMuted)}
      data-active={isActive}
    >
      {children}
    </div>
  );
};
