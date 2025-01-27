import { Card } from "@pythnetwork/component-library/Card";
import { notFound } from "next/navigation";

import { Chart } from "./chart";
import styles from "./chart-page.module.scss";
import { Cluster, getData } from "../../services/pyth";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const ChartPage = async ({ params }: Props) => {
  const [{ slug }, data] = await Promise.all([
    params,
    getData(Cluster.Pythnet),
  ]);
  const symbol = decodeURIComponent(slug);
  const feed = data.find((item) => item.symbol === symbol);

  return feed ? (
    <Card title="Chart" className={styles.chartCard}>
      <div className={styles.chart}>
        <Chart symbol={symbol} feedId={feed.product.price_account} />
      </div>
    </Card>
  ) : (
    notFound()
  );
};
