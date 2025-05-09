import type { ReactNode } from "react";

import styles from "./index.module.scss";

type Props = {
  children: ReactNode;
};

export const Homepage = ({ children }: Props) => {
  return <div className={styles.homepage}>{children}</div>;
};
