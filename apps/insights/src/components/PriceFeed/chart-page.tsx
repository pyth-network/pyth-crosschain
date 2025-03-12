import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Card } from "@pythnetwork/component-library/Card";
import { Link } from "@pythnetwork/component-library/Link";
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
      <Disclaimer symbol={symbol} displaySymbol={feed.product.display_symbol} />
    </Card>
  ) : (
    notFound()
  );
};

type DisclaimerProps = {
  displaySymbol: string;
  symbol: string;
};

const Disclaimer = ({ displaySymbol, symbol }: DisclaimerProps) => {
  return NEW_YORK_FED_SYMBOLS.has(symbol) ? (
    <div className={styles.disclaimer}>
      <Info className={styles.disclaimerIcon} weight="fill" />
      <p className={styles.disclaimerBody}>
        The <b>{displaySymbol}</b> is subject to the Terms of Use posted at{" "}
        <Link target="_blank" rel="noreferrer" href="https://newyorkfed.org">
          newyorkfed.org
        </Link>
        . The New York Fed is not responsible for publication of the{" "}
        <b>{displaySymbol}</b> by <b>Pyth Network</b> or its publishers, does
        not sanction or endorse any particular republication, and has no
        liability for your use.
      </p>
    </div>
  ) : null; // eslint-disable-line unicorn/no-null
};

const NEW_YORK_FED_SYMBOLS = new Set([
  "Rates.SOFR",
  "Rates.EFFR",
  "Rates.OBFR",
  "Rates.BGCR",
  "Rates.TGCR",
]);
