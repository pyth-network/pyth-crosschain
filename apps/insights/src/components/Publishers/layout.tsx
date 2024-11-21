import type { ReactNode } from "react";

import { EpochSelect } from "./epoch-select";
import styles from "./layout.module.scss";
import { H1 } from "../H1";

type Props = {
  children: ReactNode | undefined;
};

export const PublishersLayout = ({ children }: Props) => (
  <div className={styles.publishersLayout}>
    <div className={styles.header}>
      <H1>Publishers</H1>
      <EpochSelect />
    </div>
    {children}
  </div>
);
