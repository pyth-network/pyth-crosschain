import type { ReactNode } from "react";

import { EpochSelect } from "./epoch-select";
import styles from "./layout.module.scss";
import { H1 } from "../H1";

type Props = {
  children: ReactNode | undefined;
};

export const PriceFeedsLayout = ({ children }: Props) => (
  <div className={styles.priceFeedsLayout}>
    <div className={styles.header}>
      <H1>Price Feeds</H1>
      <EpochSelect />
    </div>
    {children}
  </div>
);
