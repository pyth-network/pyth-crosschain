import type { ReactNode } from "react";

import styles from "./index.module.scss";

type Props = {
  icon: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export const InfoBox = ({ icon, header, children }: Props) => (
  <div className={styles.infoBox}>
    <div className={styles.icon}>{icon}</div>
    <div className={styles.body}>
      <h3 className={styles.header}>{header}</h3>
      <p className={styles.contents}>{children}</p>
    </div>
  </div>
);
