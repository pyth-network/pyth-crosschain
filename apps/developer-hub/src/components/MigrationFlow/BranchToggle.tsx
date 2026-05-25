"use client";

import clsx from "clsx";
import { Suspense } from "react";

import styles from "./index.module.scss";
import type { MigrationPath } from "./path-store";
import { useMigrationPath } from "./path-store";

type Option = {
  value: MigrationPath;
  title: string;
  caption: string;
};

const OPTIONS: Option[] = [
  {
    value: "now",
    title: "Early upgrade",
    caption: "Recommended · zero downtime · ~30 min",
  },
  {
    value: "wait",
    title: "Wait for automatic",
    caption: "DAO upgrades contract on July 31",
  },
];

// Fumadocs auto-generates these from the H2 headings inside each
// BranchSection. Update if those headings change.
const HEADING_IDS: Record<MigrationPath, string> = {
  now: "early-upgrade",
  wait: "waiting-for-the-automatic-upgrade",
};

const BranchToggleInner = () => {
  const [path, setPath] = useMigrationPath();
  return (
    <div className={styles.toggle} role="radiogroup" aria-label="Choose your upgrade path">
      {OPTIONS.map((option) => {
        const selected = path === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={clsx(styles.toggleOption, selected && styles.toggleOptionSelected)}
            onClick={() => {
              if (selected) return;
              void setPath(option.value);
              document
                .getElementById(HEADING_IDS[option.value])
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <span className={styles.toggleTitle}>{option.title}</span>
            <span className={styles.toggleCaption}>{option.caption}</span>
          </button>
        );
      })}
    </div>
  );
};

// Wrap in Suspense so the page can be statically rendered. The inner
// component reads ?path= via nuqs/useSearchParams which forces a
// client-side bailout without a Suspense boundary.
export const BranchToggle = () => (
  <Suspense
    fallback={
      <div
        className={styles.toggle}
        role="radiogroup"
        aria-label="Choose your upgrade path"
        aria-busy="true"
      />
    }
  >
    <BranchToggleInner />
  </Suspense>
);
