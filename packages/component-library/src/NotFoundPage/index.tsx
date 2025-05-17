"use client";

import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";

import { Button } from "../Button";
import styles from "./index.module.scss";

export const NotFoundPage = () => (
  <div className={styles.notFoundPage}>
    <div className={styles.searchIcon}>
      <MagnifyingGlass />
    </div>
    <div className={styles.text}>
      <h2 className={styles.header}>Not Found</h2>
      <p className={styles.subheader}>
        {"The page you're looking for isn't here"}
      </p>
    </div>
    <Button href="/" size="lg">
      Go Home
    </Button>
  </div>
);
