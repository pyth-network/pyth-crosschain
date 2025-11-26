import { Button } from "@pythnetwork/component-library/Button";
import Link from "next/link";

import styles from "./not-found.module.scss";

export default function NotFound() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>404</h1>
        <h2 className={styles.heading}>Page Not Found</h2>
        <p className={styles.description}>
          The page you're looking for doesn't exist. Let's get you back on track.
        </p>
        
        <div className={styles.buttonGroup}>
          <Link href="/">
            <Button size="md" variant="primary">
              Go Home
            </Button>
          </Link>
          <Link href="/price-feeds">
            <Button size="md" variant="secondary">
              Price Feeds
            </Button>
          </Link>
          <Link href="/entropy">
            <Button size="md" variant="secondary">
              Entropy
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

