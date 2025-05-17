import type { ReactNode } from "react";

import styles from "./index.module.scss";

type Props = {
  children?: ReactNode;
};

export const Homepage = ({ children }: Props) => {
  return (
    <div className={styles.landing}>
      <h2>Homepage Landing Page</h2>
      {children}
    </div>
  );
};
