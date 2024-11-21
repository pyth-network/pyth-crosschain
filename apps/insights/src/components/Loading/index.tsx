import { Skeleton } from "@pythnetwork/component-library/Skeleton";

import styles from "./index.module.scss";
import { H1 } from "../H1";

export const Loading = () => (
  <div className={styles.loading}>
    <H1>
      <Skeleton width={60} />
    </H1>
  </div>
);
