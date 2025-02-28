import { ArrowsOutSimple } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr/BookOpenText";
import { Browsers } from "@phosphor-icons/react/dist/ssr/Browsers";
import { ShieldChevron } from "@phosphor-icons/react/dist/ssr/ShieldChevron";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Breadcrumbs } from "@pythnetwork/component-library/Breadcrumbs";
import { Button } from "@pythnetwork/component-library/Button";
import { DrawerTrigger, Drawer } from "@pythnetwork/component-library/Drawer";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Link } from "@pythnetwork/component-library/Link";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { lookup } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getPriceFeeds } from "./get-price-feeds";
import styles from "./layout.module.scss";
import { OisApyHistory } from "./ois-apy-history";
import { PriceFeedDrawerProvider } from "./price-feed-drawer-provider";
import {
  getPublisherRankingHistory,
  getPublisherAverageScoreHistory,
  getPublishers,
} from "../../services/clickhouse";
import { getPublisherCaps } from "../../services/hermes";
import { Cluster, ClusterToName, parseCluster } from "../../services/pyth";
import { getPublisherPoolData } from "../../services/staking";
import { Cards } from "../Cards";
import { ChangePercent } from "../ChangePercent";
import { ChangeValue } from "../ChangeValue";
import { ChartCard } from "../ChartCard";
import { Explain } from "../Explain";
import {
  ExplainAverage,
  ExplainActive,
  ExplainInactive,
} from "../Explanations";
import { FormattedDate } from "../FormattedDate";
import { FormattedNumber } from "../FormattedNumber";
import { FormattedTokens } from "../FormattedTokens";
import { Meter } from "../Meter";
import { PublisherIcon } from "../PublisherIcon";
import { PublisherKey } from "../PublisherKey";
import { PublisherTag } from "../PublisherTag";
import { SemicircleMeter } from "../SemicircleMeter";
import { TabPanel, TabRoot, Tabs } from "../Tabs";
import { TokenIcon } from "../TokenIcon";

type Props = {
  children: ReactNode;
  params: Promise<{
    cluster: string;
    key: string;
  }>;
};

export const PublishersLayout = async ({ children, params }: Props) => {
  const { cluster, key } = await params;
  const parsedCluster = parseCluster(cluster);

  if (parsedCluster === undefined) {
    notFound();
  }

  const [
    rankingHistory,
    averageScoreHistory,
    oisStats,
    priceFeeds,
    publishers,
  ] = await Promise.all([
    getPublisherRankingHistory(parsedCluster, key),
    getPublisherAverageScoreHistory(parsedCluster, key),
    getOisStats(key),
    getPriceFeeds(parsedCluster, key),
    getPublishers(parsedCluster),
  ]);

  const currentRanking = rankingHistory.at(-1);
  const previousRanking = rankingHistory.at(-2);

  const currentAverageScore = averageScoreHistory.at(-1);
  const previousAverageScore = averageScoreHistory.at(-2);
  const knownPublisher = lookup(key);
  const publisher = publishers.find((publisher) => publisher.key === key);

  return publisher && currentRanking && currentAverageScore ? (
    <PriceFeedDrawerProvider
      cluster={parsedCluster}
      publisherKey={key}
      priceFeeds={priceFeeds.map(({ feed, ranking, status }) => ({
        symbol: feed.symbol,
        score: ranking?.final_score,
        rank: ranking?.final_rank,
        firstEvaluation: ranking?.first_ranking_time,
        status,
      }))}
    >
      <div className={styles.publisherLayout}>
        <section className={styles.header}>
          <div className={styles.breadcrumbRow}>
            <Breadcrumbs
              className={styles.breadcrumbs ?? ""}
              label="Breadcrumbs"
              items={[
                { href: "/", label: "Home" },
                { href: "/publishers", label: "Publishers" },
                { label: <PublisherKey publisherKey={key} /> },
              ]}
            />
          </div>
          <PublisherTag
            cluster={parsedCluster}
            publisherKey={key}
            {...(knownPublisher && {
              name: knownPublisher.name,
              icon: <PublisherIcon knownPublisher={knownPublisher} />,
            })}
          />
          <Cards className={styles.stats ?? ""}>
            <ChartCard
              variant="primary"
              header="Publisher Ranking"
              corner={
                <Explain size="xs" title="Publisher Ranking">
                  <p>
                    Each <b>Publisher</b> receives a <b>Ranking</b> which is
                    derived from the number of price feeds the <b>Publisher</b>{" "}
                    is actively publishing.
                  </p>
                </Explain>
              }
              data={rankingHistory.map(({ timestamp, rank }) => ({
                x: timestamp,
                y: rank,
                displayX: (
                  <span className={styles.activeDate}>
                    <FormattedDate value={timestamp} />
                  </span>
                ),
              }))}
              stat={currentRanking.rank}
              {...(previousRanking && {
                miniStat: (
                  <ChangeValue
                    direction={getChangeDirection(
                      currentRanking.rank,
                      previousRanking.rank,
                    )}
                  >
                    {Math.abs(currentRanking.rank - previousRanking.rank)}
                  </ChangeValue>
                ),
              })}
            />
            <ChartCard
              header="Average Score"
              corner={<ExplainAverage />}
              data={averageScoreHistory.map(({ time, averageScore }) => ({
                x: time,
                y: averageScore,
                displayX: (
                  <span className={styles.activeDate}>
                    <FormattedDate value={time} />
                  </span>
                ),
                displayY: (
                  <FormattedNumber
                    maximumSignificantDigits={5}
                    value={averageScore}
                  />
                ),
              }))}
              stat={
                <FormattedNumber
                  maximumSignificantDigits={5}
                  value={currentAverageScore.averageScore}
                />
              }
              {...(previousAverageScore && {
                miniStat: (
                  <ChangePercent
                    currentValue={currentAverageScore.averageScore}
                    previousValue={previousAverageScore.averageScore}
                  />
                ),
              })}
            />
            <StatCard
              header1={
                <>
                  Active Feeds
                  <ExplainActive />
                </>
              }
              header2={
                <>
                  <ExplainInactive />
                  Inactive Feeds
                </>
              }
              stat1={
                <Link
                  href={`/publishers/${ClusterToName[parsedCluster]}/${key}/price-feeds?status=Active`}
                  invert
                >
                  {publisher.activeFeeds}
                </Link>
              }
              stat2={
                <Link
                  href={`/publishers/${ClusterToName[parsedCluster]}/${key}/price-feeds?status=Inactive`}
                  invert
                >
                  {publisher.inactiveFeeds}
                </Link>
              }
              miniStat1={
                <>
                  <FormattedNumber
                    maximumFractionDigits={1}
                    value={(100 * publisher.activeFeeds) / priceFeeds.length}
                  />
                  %
                </>
              }
              miniStat2={
                <>
                  <FormattedNumber
                    maximumFractionDigits={1}
                    value={(100 * publisher.inactiveFeeds) / priceFeeds.length}
                  />
                  %
                </>
              }
            >
              <Meter
                value={publisher.activeFeeds}
                maxValue={priceFeeds.length}
                label="Active Feeds"
              />
            </StatCard>
            {parsedCluster === Cluster.Pythnet && (
              <DrawerTrigger>
                <StatCard
                  header="OIS Pool Allocation"
                  stat={
                    <span
                      className={styles.oisAllocation}
                      data-is-overallocated={
                        Number(oisStats.poolUtilization) > oisStats.maxPoolSize
                          ? ""
                          : undefined
                      }
                    >
                      <FormattedNumber
                        maximumFractionDigits={2}
                        value={
                          (100 * Number(oisStats.poolUtilization)) /
                          oisStats.maxPoolSize
                        }
                      />
                      %
                    </span>
                  }
                  corner={<ArrowsOutSimple />}
                >
                  <Meter
                    value={Number(oisStats.poolUtilization)}
                    maxValue={oisStats.maxPoolSize}
                    label="OIS Pool"
                    startLabel={
                      <span className={styles.tokens}>
                        <TokenIcon />
                        <span>
                          <FormattedTokens tokens={oisStats.poolUtilization} />
                        </span>
                      </span>
                    }
                    endLabel={
                      <span className={styles.tokens}>
                        <TokenIcon />
                        <span>
                          <FormattedTokens
                            tokens={BigInt(oisStats.maxPoolSize)}
                          />
                        </span>
                      </span>
                    }
                  />
                </StatCard>
                <Drawer
                  title="OIS Pool Allocation"
                  className={styles.oisDrawer ?? ""}
                  bodyClassName={styles.oisDrawerBody}
                  footerClassName={styles.oisDrawerFooter}
                  footer={
                    <>
                      <Button
                        variant="solid"
                        size="sm"
                        href="https://staking.pyth.network"
                        target="_blank"
                        beforeIcon={Browsers}
                      >
                        Open Staking App
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        href="https://docs.pyth.network/home/oracle-integrity-staking"
                        target="_blank"
                        beforeIcon={BookOpenText}
                      >
                        Documentation
                      </Button>
                    </>
                  }
                >
                  <SemicircleMeter
                    width={260}
                    height={310}
                    value={Number(oisStats.poolUtilization)}
                    maxValue={oisStats.maxPoolSize}
                    className={styles.smallOisMeter ?? ""}
                    aria-label="OIS Pool Utilization"
                  >
                    <TokenIcon className={styles.oisMeterIcon} />
                    <div className={styles.oisMeterLabel}>OIS Pool</div>
                  </SemicircleMeter>
                  <SemicircleMeter
                    width={420}
                    height={420}
                    value={Number(oisStats.poolUtilization)}
                    maxValue={oisStats.maxPoolSize}
                    className={styles.oisMeter ?? ""}
                    aria-label="OIS Pool Utilization"
                  >
                    <TokenIcon className={styles.oisMeterIcon} />
                    <div className={styles.oisMeterLabel}>OIS Pool</div>
                  </SemicircleMeter>
                  <StatCard
                    header="Total Staked"
                    variant="secondary"
                    nonInteractive
                    stat={
                      <>
                        <TokenIcon />
                        <FormattedTokens tokens={oisStats.poolUtilization} />
                      </>
                    }
                  />
                  <StatCard
                    header="Pool Capacity"
                    variant="secondary"
                    nonInteractive
                    stat={
                      <>
                        <TokenIcon />
                        <FormattedTokens
                          tokens={BigInt(oisStats.maxPoolSize)}
                        />
                      </>
                    }
                  />
                  <OisApyHistory apyHistory={oisStats.apyHistory ?? []} />
                  <InfoBox
                    className={styles.oisInfoBox}
                    icon={<ShieldChevron />}
                    header="Oracle Integrity Staking (OIS)"
                  >
                    OIS allows anyone to help secure Pyth and protect DeFi.
                    Through decentralized staking rewards and slashing, OIS
                    incentivizes Pyth publishers to maintain high-quality data
                    contributions. PYTH holders can stake to publishers to
                    further reinforce oracle security. Rewards are
                    programmatically distributed to high quality publishers and
                    the stakers supporting them to strengthen oracle integrity.
                  </InfoBox>
                </Drawer>
              </DrawerTrigger>
            )}
          </Cards>
        </section>
        <TabRoot>
          <Tabs
            label="Price Feed Navigation"
            prefix={`/publishers/${ClusterToName[parsedCluster]}/${key}`}
            items={[
              { segment: undefined, children: "Performance" },
              {
                segment: "price-feeds",
                children: (
                  <div className={styles.priceFeedsTabLabel}>
                    <span>Price Feeds</span>
                    <Badge size="xs" style="filled" variant="neutral">
                      {priceFeeds.length}
                    </Badge>
                  </div>
                ),
              },
            ]}
          />
          <TabPanel className={styles.body ?? ""}>{children}</TabPanel>
        </TabRoot>
      </div>
    </PriceFeedDrawerProvider>
  ) : (
    notFound()
  );
};

const getChangeDirection = (previousValue: number, currentValue: number) => {
  if (currentValue < previousValue) {
    return "down";
  } else if (currentValue > previousValue) {
    return "up";
  } else {
    return "flat";
  }
};

const getOisStats = async (key: string) => {
  const [publisherPoolData, publisherCaps] = await Promise.all([
    getPublisherPoolData(),
    getPublisherCaps(),
  ]);

  const publisher = publisherPoolData.find(
    (publisher) => publisher.pubkey === key,
  );

  return {
    apyHistory: publisher?.apyHistory,
    poolUtilization:
      (publisher?.totalDelegation ?? 0n) +
      (publisher?.totalDelegationDelta ?? 0n),
    maxPoolSize:
      publisherCaps.parsed?.[0]?.publisher_stake_caps.find(
        ({ publisher }) => publisher === key,
      )?.cap ?? 0,
  };
};
