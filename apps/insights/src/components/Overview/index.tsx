import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import { CrossfadeTabPanels } from "@pythnetwork/component-library/CrossfadeTabPanels";
import { Tabs } from "@pythnetwork/component-library/unstyled/Tabs";
import { Cluster } from "../../services/pyth";
import { getFeeds } from "../../services/pyth/get-feeds";
import {
  activeChains,
  activeFeeds,
  activePublishers,
  totalVolumeTraded,
} from "../../static-data/stats";
import { Cards } from "../Cards";
import { ChangePercent } from "../ChangePercent";
import { ChartCard } from "../ChartCard";
import { FormattedDate } from "../FormattedDate";
import { FormattedNumber } from "../FormattedNumber";
import styles from "./index.module.scss";
import PriceFeedsDark from "./price-feeds-dark.svg";
import PriceFeedsLight from "./price-feeds-light.svg";
import PublishersDark from "./publishers-dark.svg";
import PublishersLight from "./publishers-light.svg";
import { TabList } from "./tab-list";

export const Overview = async () => {
  const priceFeeds = await getFeeds(Cluster.Pythnet);
  const today = new Date();

  const feedCounts = [
    ...activeFeeds.map(({ date, numFeeds }) => ({
      displayX: <FormattedDate value={date} />,
      x: date,
      y: numFeeds,
    })),
    {
      displayX: <FormattedDate value={today} />,
      x: today,
      y: priceFeeds.length,
    },
  ];

  return (
    <div className={styles.overview}>
      <h1 className={styles.header}>Overview</h1>
      <Cards>
        <ChartCard
          data={totalVolumeTraded.map(({ date, volume }) => ({
            displayX: <FormattedDate value={date} />,
            displayY: (
              <FormattedNumber
                currency="usd"
                notation="compact"
                style="currency"
                value={volume}
              />
            ),
            x: date,
            y: volume,
          }))}
          header="Total Volume Traded"
          miniStat={
            <ChangePercent
              currentValue={totalVolumeTraded.at(-1)?.volume ?? 0}
              previousValue={totalVolumeTraded.at(-2)?.volume ?? 0}
            />
          }
          stat={
            <FormattedNumber
              currency="usd"
              notation="compact"
              style="currency"
              value={totalVolumeTraded.at(-1)?.volume ?? 0}
            />
          }
          variant="primary"
        />
        <ChartCard
          chartClassName={styles.publishersChart}
          data={activePublishers.map(({ date, numPublishers }) => ({
            displayX: <FormattedDate value={date} />,
            x: date,
            y: numPublishers,
          }))}
          header="Publishers Onboarded"
          href="/publishers"
          miniStat={
            <ChangePercent
              currentValue={activePublishers.at(-1)?.numPublishers ?? 0}
              previousValue={activePublishers.at(-2)?.numPublishers ?? 0}
            />
          }
          stat={activePublishers.at(-1)?.numPublishers}
        />
        <ChartCard
          chartClassName={styles.priceFeedsChart}
          data={feedCounts}
          header="Price Feeds (Active + Coming Soon)"
          href="/price-feeds"
          miniStat={
            <ChangePercent
              currentValue={feedCounts.at(-1)?.y ?? 0}
              previousValue={feedCounts.at(-2)?.y ?? 0}
            />
          }
          stat={feedCounts.at(-1)?.y}
        />
        <ChartCard
          data={activeChains.map(({ date, chains }) => ({
            displayX: <FormattedDate value={date} />,
            x: date,
            y: chains,
          }))}
          header="Active Chains"
          miniStat={
            <ChangePercent
              currentValue={activeChains.at(-1)?.chains ?? 0}
              previousValue={activeChains.at(-2)?.chains ?? 0}
            />
          }
          stat={activeChains.at(-1)?.chains}
        />
      </Cards>
      <Tabs className={styles.overviewMainContent ?? ""} orientation="vertical">
        <section className={styles.intro}>
          <Badge>INSIGHTS</Badge>
          <p className={styles.headline}>Get the most from the Pyth Network</p>
          <p className={styles.message}>
            Insights Hub delivers transparency over the network status and
            performance, and maximizes productivity while integrating.
          </p>
        </section>
        <CrossfadeTabPanels
          items={[
            {
              children: (
                <>
                  <PublishersDark className={styles.darkImage} />
                  <PublishersLight className={styles.lightImage} />
                </>
              ),
              className: styles.imagePanel ?? "",
              id: "publishers",
            },
            {
              children: (
                <>
                  <PriceFeedsDark className={styles.darkImage} />
                  <PriceFeedsLight className={styles.lightImage} />
                </>
              ),
              className: styles.imagePanel ?? "",
              id: "price feeds",
            },
          ]}
        />
        <TabList
          className={styles.tabList ?? ""}
          items={[
            {
              body: "Get insights about quality, ranking, and performance of each Publisher contributing to the network.",
              header: "Publishers",
              id: "publishers",
            },
            {
              body: "See information about every price feed's price, performance, components, and technical aspects all in one place for a better integration experience.",
              header: "Price Feeds",
              id: "price feeds",
            },
          ]}
          label="test"
        />
        <div className={styles.buttons}>
          <Button href="/publishers" size="md" variant="solid">
            Publishers
          </Button>
          <Button href="/price-feeds" size="md" variant="outline">
            Price Feeds
          </Button>
        </div>
      </Tabs>
    </div>
  );
};
