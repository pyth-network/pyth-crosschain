import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Button } from "@pythnetwork/component-library/Button";
import type { ReactNode } from "react";

import styles from "./index.module.scss";

type Props = {
  onClearSearch?: (() => void) | undefined;
} & (
  | { query: string }
  | {
      icon: ReactNode;
      header: string;
      body: string;
      variant?: Variant | undefined;
    }
);

type Variant = "success" | "error" | "warning" | "info" | "data";

export const NoResults = ({ onClearSearch, ...props }: Props) => (
  <div
    data-variant={"variant" in props ? (props.variant ?? "info") : "info"}
    className={styles.noResults}
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
          : `We couldn't find any results for "${props.query}".`}
      </p>
    </div>
    {onClearSearch && (
      <Button variant="outline" size="sm" onPress={onClearSearch}>
        Clear search
      </Button>
    )}
  </div>
);
