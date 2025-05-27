import { ArrowsOutSimple } from "@phosphor-icons/react/dist/ssr/ArrowsOutSimple";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr/BookOpenText";
import { Browsers } from "@phosphor-icons/react/dist/ssr/Browsers";
import { ShieldChevron } from "@phosphor-icons/react/dist/ssr/ShieldChevron";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Breadcrumbs } from "@pythnetwork/component-library/Breadcrumbs";
import { Button } from "@pythnetwork/component-library/Button";
import { InfoBox } from "@pythnetwork/component-library/InfoBox";
import { Link } from "@pythnetwork/component-library/Link";
import { Meter } from "@pythnetwork/component-library/Meter";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { lookup } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense } from "react";

import {
  getPublisherRankingHistory,
  getPublisherAverageScoreHistory,
  getPublishers,
} from "../../services/clickhouse";
import { getPublisherCaps } from "../../services/hermes";
import { ClusterToName, parseCluster, Cluster } from "../../services/pyth";
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
import { FormattedNumber } from "../FormattedNumber";
import { PublisherIcon } from "../PublisherIcon";
import { PublisherKey } from "../PublisherKey";
import { PublisherTag } from "../PublisherTag";
import { getPriceFeeds } from "./get-price-feeds";
import styles from "./layout.module.scss";
import { FormattedDate } from "../FormattedDate";
import { FormattedTokens } from "../FormattedTokens";
import { SemicircleMeter } from "../SemicircleMeter";
import { TabPanel, TabRoot, Tabs } from "../Tabs";
import { TokenIcon } from "../TokenIcon";
import { OisApyHistory } from "./ois-apy-history";

type Props = {
  children: ReactNode;
  params: Promise<{
    cluster: string;
    key: string;
  }>;
};

export const PublisherLayout = async ({ children, params }: Props) => {
  const { cluster, key } = await params;
  const parsedCluster = parseCluster(cluster);

  if (parsedCluster === undefined) {
    notFound();
  } else {
    const knownPublisher = lookup(key);
    return (
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
            <Suspense fallback={<RankingCardImpl isLoading />}>
              <RankingCard cluster={parsedCluster} publisherKey={key} />
            </Suspense>
            <Suspense fallback={<ScoreCardImpl isLoading />}>
              <ScoreCard cluster={parsedCluster} publisherKey={key} />
            </Suspense>
            <Suspense fallback={<ActiveFeedsCardImpl isLoading />}>
              <ActiveFeedsCard cluster={parsedCluster} publisherKey={key} />
            </Suspense>
            {parsedCluster === Cluster.Pythnet && (
              <Suspense fallback={<OisPoolCardImpl isLoading />}>
                <OisPoolCard publisherKey={key} />
              </Suspense>
            )}
          </Cards>
        </section>
        <TabRoot>
          <Tabs
            label="Price Feed Navigation"
            items={[
              {
                id: "(performance)",
                segment: undefined,
                children: "Performance",
              },
              {
                segment: "price-feeds",
                children: (
                  <div className={styles.priceFeedsTabLabel}>
                    <span>Price Feeds</span>
                    <Badge size="xs" style="filled" variant="neutral">
                      <Suspense>
                        <NumFeeds cluster={parsedCluster} publisherKey={key} />
                      </Suspense>
                    </Badge>
                  </div>
                ),
              },
            ]}
          />
          <TabPanel className={styles.body ?? ""}>{children}</TabPanel>
        </TabRoot>
      </div>
    );
  }
};

const NumFeeds = async ({
  cluster,
  publisherKey,
}: {
  cluster: Cluster;
  publisherKey: string;
}) => {
  const feeds = await getPriceFeeds(cluster, publisherKey);
  return feeds.length;
};

const RankingCard = async ({
  cluster,
  publisherKey,
}: {
  cluster: Cluster;
  publisherKey: string;
}) => {
  const rankingHistory = await getPublisherRankingHistory(
    cluster,
    publisherKey,
  );
  return <RankingCardImpl rankingHistory={rankingHistory} />;
};

type RankingCardImplProps =
  | {
      isLoading: true;
    }
  | {
      isLoading?: false | undefined;
      rankingHistory: {
        timestamp: Date;
        rank: number;
      }[];
    };

const RankingCardImpl = (props: RankingCardImplProps) => (
  <ChartCard
    variant="primary"
    header="Publisher Ranking"
    corner={
      <Explain size="xs" title="Publisher Ranking">
        <p>
          Each <b>Publisher</b> receives a <b>Ranking</b> which is derived from
          the number of price feeds the <b>Publisher</b> is actively publishing.
        </p>
      </Explain>
    }
    data={
      props.isLoading
        ? []
        : props.rankingHistory.map(({ timestamp, rank }) => ({
            x: timestamp,
            y: rank,
            displayX: (
              <span className={styles.activeDate}>
                <FormattedDate value={timestamp} />
              </span>
            ),
          }))
    }
    stat={
      props.isLoading ? (
        <Skeleton width={20} />
      ) : (
        props.rankingHistory.at(-1)?.rank
      )
    }
    miniStat={
      props.isLoading ? (
        <Skeleton width={14} />
      ) : (
        <RankingChange rankingHistory={props.rankingHistory} />
      )
    }
  />
);

const RankingChange = ({
  rankingHistory,
}: {
  rankingHistory: { rank: number }[];
}) => {
  const current = rankingHistory.at(-1)?.rank;
  const prev = rankingHistory.at(-2)?.rank;

  // eslint-disable-next-line unicorn/no-null
  return current === undefined || prev === undefined ? null : (
    <ChangeValue direction={getChangeDirection(current, prev)}>
      {Math.abs(current - prev)}
    </ChangeValue>
  );
};

const ScoreCard = async ({
  cluster,
  publisherKey,
}: {
  cluster: Cluster;
  publisherKey: string;
}) => {
  const averageScoreHistory = await getPublisherAverageScoreHistory(
    cluster,
    publisherKey,
  );
  return <ScoreCardImpl averageScoreHistory={averageScoreHistory} />;
};

type ScoreCardImplProps =
  | {
      isLoading: true;
    }
  | {
      isLoading?: false | undefined;
      averageScoreHistory: {
        time: Date;
        averageScore: number;
      }[];
    };

const ScoreCardImpl = (props: ScoreCardImplProps) => (
  <ChartCard
    header="Average Score"
    corner={<ExplainAverage />}
    data={
      props.isLoading
        ? []
        : props.averageScoreHistory.map(({ time, averageScore }) => ({
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
          }))
    }
    stat={
      props.isLoading ? (
        <Skeleton width={20} />
      ) : (
        <CurrentAverageScore averageScoreHistory={props.averageScoreHistory} />
      )
    }
    miniStat={
      props.isLoading ? (
        <Skeleton width={20} />
      ) : (
        <ScoreChange averageScoreHistory={props.averageScoreHistory} />
      )
    }
  />
);

const CurrentAverageScore = ({
  averageScoreHistory,
}: {
  averageScoreHistory: { averageScore: number }[];
}) => {
  const currentAverageScore = averageScoreHistory.at(-1)?.averageScore;

  // eslint-disable-next-line unicorn/no-null
  return currentAverageScore === undefined ? null : (
    <FormattedNumber maximumSignificantDigits={5} value={currentAverageScore} />
  );
};

const ScoreChange = ({
  averageScoreHistory,
}: {
  averageScoreHistory: { averageScore: number }[];
}) => {
  const current = averageScoreHistory.at(-1)?.averageScore;
  const prev = averageScoreHistory.at(-2)?.averageScore;

  // eslint-disable-next-line unicorn/no-null
  return current === undefined || prev === undefined ? null : (
    <ChangePercent currentValue={current} previousValue={prev} />
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

const ActiveFeedsCard = async ({
  cluster,
  publisherKey,
}: {
  cluster: Cluster;
  publisherKey: string;
}) => {
  const [publishers, priceFeeds] = await Promise.all([
    getPublishers(cluster),
    getPriceFeeds(cluster, publisherKey),
  ]);
  const publisher = publishers.find(
    (publisher) => publisher.key === publisherKey,
  );

  return publisher ? (
    <ActiveFeedsCardImpl
      cluster={cluster}
      publisherKey={publisherKey}
      activeFeeds={publisher.activeFeeds}
      inactiveFeeds={publisher.inactiveFeeds}
      allFeeds={priceFeeds.length}
    />
  ) : (
    notFound()
  );
};

type ActiveFeedsCardImplProps =
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      cluster: Cluster;
      publisherKey: string;
      activeFeeds: number;
      inactiveFeeds: number;
      allFeeds: number;
    };

const ActiveFeedsCardImpl = (props: ActiveFeedsCardImplProps) => (
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
      props.isLoading ? (
        <Skeleton width={10} />
      ) : (
        <Link
          href={`/publishers/${ClusterToName[props.cluster]}/${props.publisherKey}/price-feeds?status=Active`}
          invert
        >
          {props.activeFeeds}
        </Link>
      )
    }
    stat2={
      props.isLoading ? (
        <Skeleton width={10} />
      ) : (
        <Link
          href={`/publishers/${ClusterToName[props.cluster]}/${props.publisherKey}/price-feeds?status=Inactive`}
          invert
        >
          {props.inactiveFeeds}
        </Link>
      )
    }
    miniStat1={
      props.isLoading ? (
        <Skeleton width={10} />
      ) : (
        <>
          <FormattedNumber
            maximumFractionDigits={1}
            value={(100 * props.activeFeeds) / props.allFeeds}
          />
          %
        </>
      )
    }
    miniStat2={
      props.isLoading ? (
        <Skeleton width={10} />
      ) : (
        <>
          <FormattedNumber
            maximumFractionDigits={1}
            value={(100 * props.inactiveFeeds) / props.allFeeds}
          />
          %
        </>
      )
    }
  >
    {!props.isLoading && (
      <Meter
        value={props.activeFeeds}
        maxValue={props.allFeeds}
        label="Active Feeds"
      />
    )}
  </StatCard>
);

const OisPoolCard = async ({ publisherKey }: { publisherKey: string }) => {
  const [publisherPoolData, publisherCaps] = await Promise.all([
    getPublisherPoolData(),
    getPublisherCaps(),
  ]);

  const publisher = publisherPoolData.find(
    (publisher) => publisher.pubkey === publisherKey,
  );

  return (
    <OisPoolCardImpl
      apyHistory={publisher?.apyHistory ?? []}
      poolUtilization={
        (publisher?.totalDelegation ?? 0n) +
        (publisher?.totalDelegationDelta ?? 0n)
      }
      maxPoolSize={
        publisherCaps.parsed?.[0]?.publisher_stake_caps.find(
          ({ publisher }) => publisher === publisherKey,
        )?.cap ?? 0
      }
    />
  );
};

type OisPoolCardImplProps =
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      apyHistory: { date: Date; apy: number }[];
      poolUtilization: bigint;
      maxPoolSize: number;
    };

const OisPoolCardImpl = (props: OisPoolCardImplProps) => (
  <StatCard
    header="OIS Pool Allocation"
    drawer={{
      title: "OIS Pool Allocation",
      className: styles.oisDrawer ?? "",
      bodyClassName: styles.oisDrawerBody,
      footerClassName: styles.oisDrawerFooter,
      footer: (
        <>
          <Button
            variant="solid"
            size="sm"
            href="https://staking.pyth.network"
            target="_blank"
            beforeIcon={<Browsers />}
          >
            Open Staking App
          </Button>
          <Button
            variant="outline"
            size="sm"
            href="https://docs.pyth.network/home/oracle-integrity-staking"
            target="_blank"
            beforeIcon={<BookOpenText />}
          >
            Documentation
          </Button>
        </>
      ),
      contents: (
        <>
          {!props.isLoading && (
            <>
              <SemicircleMeter
                width={260}
                height={310}
                value={Number(props.poolUtilization)}
                maxValue={props.maxPoolSize}
                className={styles.smallOisMeter ?? ""}
                aria-label="OIS Pool Utilization"
              >
                <TokenIcon className={styles.oisMeterIcon} />
                <div className={styles.oisMeterLabel}>OIS Pool</div>
              </SemicircleMeter>
              <SemicircleMeter
                width={420}
                height={420}
                value={Number(props.poolUtilization)}
                maxValue={props.maxPoolSize}
                className={styles.oisMeter ?? ""}
                aria-label="OIS Pool Utilization"
              >
                <TokenIcon className={styles.oisMeterIcon} />
                <div className={styles.oisMeterLabel}>OIS Pool</div>
              </SemicircleMeter>
            </>
          )}
          <StatCard
            header="Total Staked"
            variant="secondary"
            nonInteractive
            stat={
              <>
                <TokenIcon />
                {props.isLoading ? (
                  <Skeleton width={20} />
                ) : (
                  <FormattedTokens tokens={props.poolUtilization} />
                )}
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

                {props.isLoading ? (
                  <Skeleton width={20} />
                ) : (
                  <FormattedTokens tokens={BigInt(props.maxPoolSize)} />
                )}
              </>
            }
          />
          <OisApyHistory apyHistory={props.isLoading ? [] : props.apyHistory} />
          <InfoBox
            className={styles.oisInfoBox}
            icon={<ShieldChevron />}
            header="Oracle Integrity Staking (OIS)"
          >
            OIS allows anyone to help secure Pyth and protect DeFi. Through
            decentralized staking rewards and slashing, OIS incentivizes Pyth
            publishers to maintain high-quality data contributions. PYTH holders
            can stake to publishers to further reinforce oracle security.
            Rewards are programmatically distributed to high quality publishers
            and the stakers supporting them to strengthen oracle integrity.
          </InfoBox>
        </>
      ),
    }}
    stat={
      props.isLoading ? (
        <Skeleton width={20} />
      ) : (
        <span
          className={styles.oisAllocation}
          data-is-overallocated={
            Number(props.poolUtilization) > props.maxPoolSize ? "" : undefined
          }
        >
          <FormattedNumber
            maximumFractionDigits={2}
            value={(100 * Number(props.poolUtilization)) / props.maxPoolSize}
          />
          %
        </span>
      )
    }
    corner={<ArrowsOutSimple />}
  >
    <Meter
      value={props.isLoading ? 0 : Number(props.poolUtilization)}
      maxValue={props.isLoading ? 0 : props.maxPoolSize}
      label="OIS Pool"
      startLabel={
        <span className={styles.tokens}>
          <TokenIcon />
          <span>
            {props.isLoading ? (
              <Skeleton width={10} />
            ) : (
              <FormattedTokens tokens={props.poolUtilization} />
            )}
          </span>
        </span>
      }
      endLabel={
        <span className={styles.tokens}>
          <TokenIcon />
          <span>
            {props.isLoading ? (
              <Skeleton width={10} />
            ) : (
              <FormattedTokens tokens={BigInt(props.maxPoolSize)} />
            )}
          </span>
        </span>
      }
    />
  </StatCard>
);
