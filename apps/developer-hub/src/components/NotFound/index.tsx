import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { Button } from "@pythnetwork/component-library/Button";

import styles from "./index.module.scss";

export const NotFound = () => (
  <div className={styles.notFound}>
    <div className={styles.searchIcon}>
      <MagnifyingGlass />
    </div>
    <div className={styles.text}>
      <h1 className={styles.header}>Not Found</h1>
      <p className={styles.subheader}>
        {"The page you're looking for isn't here"}
      </p>
    </div>
    <Button href="/" size="lg">
      Go Home
    </Button>
  </div>
);
