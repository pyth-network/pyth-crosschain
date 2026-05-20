"use client";

import clsx from "clsx";

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
    title: "Upgrade now",
    caption: "Recommended · zero downtime · ~15 min",
  },
  {
    value: "wait",
    title: "Wait for automatic",
    caption: "DAO handles July 31 · deploy required at cutover",
  },
];

export const BranchToggle = () => {
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
              void setPath(option.value);
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
