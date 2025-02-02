import { Card } from "@pythnetwork/component-library/Card";
import { notFound } from "next/navigation";

import { Chart } from "./chart";
import styles from "./chart-page.module.scss";
import { Cluster, getFeeds } from "../../services/pyth";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const ChartPage = async ({ params }: Props) => {
  const [{ slug }, feeds] = await Promise.all([
    params,
    getFeeds(Cluster.Pythnet),
  ]);
  const symbol = decodeURIComponent(slug);
  const feed = feeds.find((item) => item.symbol === symbol);

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
