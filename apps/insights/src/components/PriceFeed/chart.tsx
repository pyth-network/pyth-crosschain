import { Card } from "@pythnetwork/component-library/Card";

import styles from "./chart.module.scss";

export const Chart = () => (
  <Card title="Chart" className={styles.chartCard}>
    <div className={styles.chart}>
      <h1>This is a chart</h1>
    </div>
  </Card>
);
