"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import clsx from "clsx";
import type { ReactNode } from "react";

import styles from "./index.module.scss";
import { Button } from "../Button/index.jsx";

type Props = {
  className?: string | undefined;
  onClearSearch?: (() => void) | undefined;
} & (
  | { query: string }
  | {
      icon: ReactNode;
      header: ReactNode;
      body: ReactNode;
      variant?: Variant | undefined;
    }
);

export type Variant = "success" | "error" | "warning" | "info" | "data";

export const NoResults = ({ className, onClearSearch, ...props }: Props) => (
  <div
    data-variant={"variant" in props ? (props.variant ?? "info") : "info"}
    className={clsx(styles.noResults, className)}
  >
    <div className={styles.icon}>
      {"icon" in props ? props.icon : <MagnifyingGlass />}
    </div>
    <div className={styles.text}>
      <h3 className={styles.header}>
        {"header" in props ? props.header : "No results found"}
      </h3>
      <p className={styles.body}>
        {"body" in props
          ? props.body
          : `We couldn't find any results for ${props.query === "" ? "your query" : `"${props.query}"`}.`}
      </p>
    </div>
    {onClearSearch && (
      <Button variant="outline" size="sm" onPress={onClearSearch}>
        Clear search
      </Button>
    )}
  </div>
);
