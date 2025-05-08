import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Card } from "@pythnetwork/component-library/Card";
import { Link } from "@pythnetwork/component-library/Link";
import { Spinner } from "@pythnetwork/component-library/Spinner";

import { Chart } from "./chart";
import styles from "./chart-page.module.scss";
import { getFeed } from "./get-feed";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const ChartPage = async ({ params }: Props) => (
  <ChartPageImpl {...await getFeed(params)} />
);

export const ChartPageLoading = () => <ChartPageImpl isLoading />;

type ChartPageImplProps =
  | { isLoading: true }
  | (Awaited<ReturnType<typeof getFeed>> & {
      isLoading?: false | undefined;
    });

const ChartPageImpl = (props: ChartPageImplProps) => (
  <Card title="Chart" className={styles.chartCard}>
    <div className={styles.chart}>
      {props.isLoading ? (
        <div className={styles.spinnerContainer}>
          <Spinner
            label="Loading chart"
            isIndeterminate
            className={styles.spinner ?? ""}
          />
        </div>
      ) : (
        <Chart
          symbol={props.symbol}
          feedId={props.feed.product.price_account}
        />
      )}
    </div>
    {!props.isLoading && (
      <Disclaimer
        symbol={props.symbol}
        displaySymbol={props.feed.product.display_symbol}
      />
    )}
  </Card>
);

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
