import { Badge } from "@pythnetwork/component-library/Badge";
import { Button } from "@pythnetwork/component-library/Button";
import { CrossfadeTabPanels } from "@pythnetwork/component-library/CrossfadeTabPanels";
import { Tabs } from "@pythnetwork/component-library/unstyled/Tabs";

import styles from "./index.module.scss";
import PriceFeedsDark from "./price-feeds-dark.svg";
import PriceFeedsLight from "./price-feeds-light.svg";
import PublishersDark from "./publishers-dark.svg";
import PublishersLight from "./publishers-light.svg";
import { TabList } from "./tab-list";
import { Cluster, getFeeds } from "../../services/pyth";
import {
  totalVolumeTraded,
  activeChains,
  activePublishers,
  activeFeeds,
} from "../../static-data/stats";
import { Cards } from "../Cards";
import { ChangePercent } from "../ChangePercent";
import { ChartCard } from "../ChartCard";
import { FormattedDate } from "../FormattedDate";
import { FormattedNumber } from "../FormattedNumber";

export const Overview = async () => {
  const priceFeeds = await getFeeds(Cluster.Pythnet);
  const today = new Date();
  const feedCounts = [
    ...activeFeeds.map(({ date, numFeeds }) => ({
      x: date,
      displayX: <FormattedDate value={date} />,
      y: numFeeds,
    })),
    {
      x: today,
      displayX: <FormattedDate value={today} />,
      y: priceFeeds.length,
    },
  ];
  return (
    <div className={styles.overview}>
      <h1 className={styles.header}>Overview</h1>
      <Cards>
        <ChartCard
          header="Total Volume Traded"
          variant="primary"
          data={totalVolumeTraded.map(({ date, volume }) => ({
            x: date,
            displayX: <FormattedDate value={date} />,
            y: volume,
            displayY: (
              <FormattedNumber
                value={volume}
                currency="usd"
                style="currency"
                notation="compact"
              />
            ),
          }))}
          miniStat={
            <ChangePercent
              previousValue={totalVolumeTraded.at(-2)?.volume ?? 0}
              currentValue={totalVolumeTraded.at(-1)?.volume ?? 0}
            />
          }
          stat={
            <FormattedNumber
              value={totalVolumeTraded.at(-1)?.volume ?? 0}
              currency="usd"
              style="currency"
              notation="compact"
            />
          }
        />
        <ChartCard
          header="Publishers Onboarded"
          href="/publishers"
          chartClassName={styles.publishersChart}
          data={activePublishers.map(({ date, numPublishers }) => ({
            x: date,
            displayX: <FormattedDate value={date} />,
            y: numPublishers,
          }))}
          miniStat={
            <ChangePercent
              previousValue={activePublishers.at(-2)?.numPublishers ?? 0}
              currentValue={activePublishers.at(-1)?.numPublishers ?? 0}
            />
          }
          stat={activePublishers.at(-1)?.numPublishers}
        />
        <ChartCard
          header="Price Feeds (Active + Coming Soon)"
          href="/price-feeds"
          chartClassName={styles.priceFeedsChart}
          data={feedCounts}
          miniStat={
            <ChangePercent
              previousValue={feedCounts.at(-2)?.y ?? 0}
              currentValue={feedCounts.at(-1)?.y ?? 0}
            />
          }
          stat={feedCounts.at(-1)?.y}
        />
        <ChartCard
          header="Active Chains"
          data={activeChains.map(({ date, chains }) => ({
            x: date,
            displayX: <FormattedDate value={date} />,
            y: chains,
          }))}
          miniStat={
            <ChangePercent
              previousValue={activeChains.at(-2)?.chains ?? 0}
              currentValue={activeChains.at(-1)?.chains ?? 0}
            />
          }
          stat={activeChains.at(-1)?.chains}
        />
      </Cards>
      <Tabs orientation="vertical" className={styles.overviewMainContent ?? ""}>
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
              id: "publishers",
              className: styles.imagePanel ?? "",
              children: (
                <>
                  <PublishersDark className={styles.darkImage} />
                  <PublishersLight className={styles.lightImage} />
                </>
              ),
            },
            {
              id: "price feeds",
              className: styles.imagePanel ?? "",
              children: (
                <>
                  <PriceFeedsDark className={styles.darkImage} />
                  <PriceFeedsLight className={styles.lightImage} />
                </>
              ),
            },
          ]}
        />
        <TabList
          label="test"
          className={styles.tabList ?? ""}
          items={[
            {
              id: "publishers",
              header: "Publishers",
              body: "Get insights about quality, ranking, and performance of each Publisher contributing to the network.",
            },
            {
              id: "price feeds",
              header: "Price Feeds",
              body: "See information about every price feed's price, performance, components, and technical aspects all in one place for a better integration experience.",
            },
          ]}
        />
        <div className={styles.buttons}>
          <Button href="/publishers" variant="solid" size="md">
            Publishers
          </Button>
          <Button href="/price-feeds" variant="outline" size="md">
            Price Feeds
          </Button>
        </div>
      </Tabs>
    </div>
  );
};
