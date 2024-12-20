import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Button } from "@pythnetwork/component-library/Button";

import styles from "./index.module.scss";

type Props = {
  query: string;
  onClearSearch?: (() => void) | undefined;
};

export const NoResults = ({ query, onClearSearch }: Props) => (
  <div className={styles.noResults}>
    <div className={styles.searchIcon}>
      <MagnifyingGlass />
    </div>
    <div className={styles.text}>
      <h3 className={styles.header}>No results found</h3>
      <p
        className={styles.body}
      >{`We couldn't find any results for "${query}".`}</p>
    </div>
    {onClearSearch && (
      <Button variant="outline" size="sm" onPress={onClearSearch}>
        Clear search
      </Button>
    )}
  </div>
);
