import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { Alert, AlertTrigger } from "@pythnetwork/component-library/Alert";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";

import styles from "./index.module.scss";
import { PublishersCard } from "./publishers-card";
import { getPublishers } from "../../services/clickhouse";
import { getPublisherCaps } from "../../services/hermes";
import { Cluster, getData } from "../../services/pyth";
import {
  getDelState,
  getClaimableRewards,
  getDistributedRewards,
} from "../../services/staking";
import { FormattedTokens } from "../FormattedTokens";
import { PublisherIcon } from "../PublisherIcon";
import { PublisherTag } from "../PublisherTag";
import { SemicircleMeter, Label } from "../SemicircleMeter";
import { TokenIcon } from "../TokenIcon";

const INITIAL_REWARD_POOL_SIZE = 60_000_000_000_000n;

export const Publishers = async () => {
  const [publishers, totalFeeds, oisStats] = await Promise.all([
    getPublishers(),
    getTotalFeedCount(),
    getOisStats(),
  ]);

  return (
    <div className={styles.publishers}>
      <h1 className={styles.header}>Publishers</h1>
      <div className={styles.body}>
        <section className={styles.stats}>
          <StatCard
            variant="primary"
            header="Active Publishers"
            stat={publishers.length}
          />
          <StatCard
            header="Avg. Median Score"
            corner={
              <AlertTrigger>
                <Button
                  variant="ghost"
                  size="xs"
                  beforeIcon={(props) => <Info weight="fill" {...props} />}
                  rounded
                  hideText
                  className={styles.averageMedianScoreExplainButton ?? ""}
                >
                  Explain Average Median Score
                </Button>
                <Alert title="Average Median Score" icon={<Lightbulb />}>
                  <p className={styles.averageMedianScoreDescription}>
                    Each <b>Price Feed Component</b> that a <b>Publisher</b>{" "}
                    provides has an associated <b>Score</b>, which is determined
                    by that component{"'"}s <b>Uptime</b>,{" "}
                    <b>Price Deviation</b>, and <b>Staleness</b>. The publisher
                    {"'"}s <b>Median Score</b> measures the 50th percentile of
                    the <b>Score</b> across all of that publisher{"'"}s{" "}
                    <b>Price Feed Components</b>. The{" "}
                    <b>Average Median Score</b> is the average of the{" "}
                    <b>Median Scores</b> of all publishers who contribute to the
                    Pyth Network.
                  </p>
                  <Button
                    size="xs"
                    variant="solid"
                    href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking"
                    target="_blank"
                  >
                    Learn more
                  </Button>
                </Alert>
              </AlertTrigger>
            }
            stat={(
              publishers.reduce(
                (sum, publisher) => sum + publisher.medianScore,
                0,
              ) / publishers.length
            ).toFixed(2)}
          />
          <Card
            title="Oracle Integrity Staking (OIS)"
            className={styles.oisCard}
            toolbar={
              <Button
                href="https://staking.pyth.network"
                target="_blank"
                size="sm"
                variant="outline"
                afterIcon={ArrowSquareOut}
              >
                Staking App
              </Button>
            }
          >
            <SemicircleMeter
              width={340}
              height={340}
              value={Number(oisStats.totalStaked)}
              maxValue={oisStats.maxPoolSize ?? 0}
              className={styles.oisPool ?? ""}
            >
              <Label className={styles.title}>PYTH Staking Pool</Label>
              <p className={styles.poolUsed}>
                <FormattedTokens
                  mode="wholePart"
                  tokens={oisStats.totalStaked}
                />
              </p>
              <p className={styles.poolTotal}>
                /{" "}
                <FormattedTokens
                  mode="wholePart"
                  tokens={BigInt(oisStats.maxPoolSize ?? 0)}
                />
              </p>
            </SemicircleMeter>
            <div className={styles.oisStats}>
              <StatCard
                header="Total Staked"
                variant="tertiary"
                stat={
                  <>
                    <TokenIcon />
                    <FormattedTokens tokens={oisStats.totalStaked} />
                  </>
                }
              />
              <StatCard
                header="Total Rewards Distributed"
                variant="tertiary"
                stat={
                  <>
                    <TokenIcon />
                    <FormattedTokens tokens={oisStats.rewardsDistributed} />
                  </>
                }
              />
            </div>
          </Card>
        </section>
        <PublishersCard
          className={styles.publishersCard}
          nameLoadingSkeleton={<PublisherTag isLoading />}
          publishers={publishers.map(
            ({ key, rank, numSymbols, medianScore }) => {
              const knownPublisher = lookupPublisher(key);
              return {
                id: key,
                ranking: rank,
                activeFeeds: numSymbols,
                inactiveFeeds: totalFeeds - numSymbols,
                medianScore: medianScore,
                ...(knownPublisher && {
                  name: knownPublisher.name,
                  icon: <PublisherIcon knownPublisher={knownPublisher} />,
                }),
              };
            },
          )}
        />
      </div>
    </div>
  );
};

const getTotalFeedCount = async () => {
  const pythData = await getData(Cluster.Pythnet);
  return pythData.filter(({ price }) => price.numComponentPrices > 0).length;
};

const getOisStats = async () => {
  const [delState, claimableRewards, distributedRewards, publisherCaps] =
    await Promise.all([
      getDelState(),
      getClaimableRewards(),
      getDistributedRewards(),
      getPublisherCaps(),
    ]);

  return {
    totalStaked:
      sumDelegations(delState.delState) + sumDelegations(delState.selfDelState),
    rewardsDistributed:
      claimableRewards + INITIAL_REWARD_POOL_SIZE - distributedRewards,
    maxPoolSize: publisherCaps.parsed?.[0]?.publisher_stake_caps
      .map(({ cap }) => cap)
      .reduce((acc, value) => acc + value),
  };
};

const sumDelegations = (
  values: { totalDelegation: bigint; deltaDelegation: bigint }[],
) =>
  values.reduce(
    (acc, value) => acc + value.totalDelegation + value.deltaDelegation,
    0n,
  );
