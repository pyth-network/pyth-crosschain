"use client";

import clsx from "clsx";
import { Suspense, type ReactNode } from "react";

import styles from "./index.module.scss";
import type { MigrationPath } from "./path-store";
import { MIGRATION_PATHS, useMigrationPath } from "./path-store";

type Props = {
  path: MigrationPath;
  children: ReactNode;
};

const BranchSectionInner = ({ path: forPath, children }: Props) => {
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

// SSR fallback: render with the default path "active" so the first paint
// is correct without waiting for client hydration. Matches
// parseAsStringLiteral().withDefault("now") in path-store.
const DEFAULT_PATH: MigrationPath = MIGRATION_PATHS[0];

// Wrap in Suspense so the page can be statically rendered. The inner
// component reads ?path= via nuqs/useSearchParams which forces a
// client-side bailout without a Suspense boundary.
export const BranchSection = (props: Props) => (
  <Suspense
    fallback={
      <div
        className={clsx(
          styles.branchSection,
          props.path === DEFAULT_PATH ? styles.branchActive : styles.branchMuted,
        )}
        data-active={props.path === DEFAULT_PATH}
      >
        {props.children}
      </div>
    }
  >
    <BranchSectionInner {...props} />
  </Suspense>
);
