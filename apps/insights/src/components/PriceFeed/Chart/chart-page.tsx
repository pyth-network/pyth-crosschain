import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Card } from "@pythnetwork/component-library/Card";
import { Link } from "@pythnetwork/component-library/Link";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import { getFeed } from "../get-feed";
import { Chart } from "./chart";
import styles from "./chart-page.module.scss";
import { ChartToolbar } from "./chart-toolbar";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export const ChartPage = async ({ params }: Props) => (
  <ChartPageImpl {...(await getFeed(params))} />
);

export const ChartPageLoading = () => <ChartPageImpl isLoading />;

type ChartPageImplProps =
  | { isLoading: true }
  | (Awaited<ReturnType<typeof getFeed>> & {
      isLoading?: false | undefined;
    });

const ChartPageImpl = (props: ChartPageImplProps) => (
  <Card className={styles.chartCard} title="Chart" toolbar={<ChartToolbar />}>
    <div className={styles.chart}>
      {props.isLoading ? (
        <div className={styles.spinnerContainer}>
          <Spinner
            className={styles.spinner ?? ""}
            isIndeterminate
            label="Loading chart"
          />
        </div>
      ) : (
        <Chart
          feedId={props.feed.product.price_account}
          symbol={props.symbol}
        />
      )}
    </div>
    {!props.isLoading && (
      <Disclaimer
        displaySymbol={props.feed.product.display_symbol}
        symbol={props.symbol}
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
        <Link href="https://newyorkfed.org" rel="noreferrer" target="_blank">
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
