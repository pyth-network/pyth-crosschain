import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import { getPublishersWithRankings } from "../../get-publishers-with-rankings";
import { getPublisherCaps } from "../../services/hermes";
import { Cluster } from "../../services/pyth";
import {
  getClaimableRewards,
  getDelState,
  getDistributedRewards,
} from "../../services/staking";
import { ExplainAverage } from "../Explanations";
import { FormattedDate } from "../FormattedDate";
import { FormattedTokens } from "../FormattedTokens";
import { PublisherIcon } from "../PublisherIcon";
import { Label, SemicircleMeter } from "../SemicircleMeter";
import { TokenIcon } from "../TokenIcon";
import styles from "./index.module.scss";
import { PublishersCard } from "./publishers-card";

const INITIAL_REWARD_POOL_SIZE = 110_000_010_000_000n;

export const Publishers = async () => {
  const [pythnetPublishers, pythtestConformancePublishers, oisStats] =
    await Promise.all([
      getPublishersWithRankings(Cluster.Pythnet),
      getPublishersWithRankings(Cluster.PythtestConformance),
      getOisStats(),
    ]);
  const rankedPublishers = pythnetPublishers.filter(
    (publisher) => publisher.scoreTime !== undefined,
  );
  const rankingTime = rankedPublishers[0]?.timestamp;
  const scoreTime = rankedPublishers[0]?.scoreTime;

  return (
    <div className={styles.publishers}>
      <div className={styles.headerContainer}>
        <h1 className={styles.header}>Publishers</h1>
        {rankingTime && (
          <div className={styles.rankingsLastUpdated}>
            <span>
              Rankings last updated{" "}
              <FormattedDate
                dateStyle="long"
                timeStyle="long"
                timeZone="utc"
                value={rankingTime}
              />
            </span>
            <ClockCountdown className={styles.clockIcon} />
          </div>
        )}
      </div>
      <div className={styles.body}>
        <StatCard
          className={styles.statCard ?? ""}
          header="Active Publishers"
          stat={pythnetPublishers.length}
          variant="primary"
        />
        <StatCard
          className={styles.statCard ?? ""}
          corner={<ExplainAverage scoreTime={scoreTime} />}
          header="Average Feed Score"
          stat={(
            rankedPublishers.reduce(
              (sum, publisher) => sum + (publisher.averageScore ?? 0),
              0,
            ) / rankedPublishers.length
          ).toFixed(2)}
        />
        <PublishersCard
          className={styles.publishersCard}
          explainAverage={<ExplainAverage scoreTime={scoreTime} />}
          pythnetPublishers={pythnetPublishers.map((publisher) =>
            toTableRow(publisher),
          )}
          pythtestConformancePublishers={pythtestConformancePublishers.map(
            (publisher) => toTableRow(publisher),
          )}
        />
        <Card
          className={styles.oisCard}
          title="Oracle Integrity Staking (OIS)"
          toolbar={
            <Button
              afterIcon={<ArrowSquareOut />}
              href="https://staking.pyth.network"
              size="sm"
              target="_blank"
              variant="outline"
            >
              Staking App
            </Button>
          }
        >
          <SemicircleMeter
            className={styles.oisPool ?? ""}
            height={340}
            maxValue={oisStats.maxPoolSize ?? 0}
            value={Number(oisStats.totalStaked)}
            width={340}
          >
            <Label className={styles.title}>PYTH Staking Pool</Label>
            <p className={styles.poolUsed}>
              <FormattedTokens mode="wholePart" tokens={oisStats.totalStaked} />
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
              stat={
                <>
                  <TokenIcon />
                  <FormattedTokens tokens={oisStats.totalStaked} />
                </>
              }
              variant="tertiary"
            />
            <StatCard
              header="Total Rewards Distributed"
              stat={
                <>
                  <TokenIcon />
                  <FormattedTokens tokens={oisStats.rewardsDistributed} />
                </>
              }
              variant="tertiary"
            />
          </div>
        </Card>
      </div>
    </div>
  );
};

const toTableRow = ({
  key,
  rank,
  permissionedFeeds,
  activeFeeds,
  averageScore,
}: Awaited<ReturnType<typeof getPublishersWithRankings>>[number]) => {
  const knownPublisher = lookupPublisher(key);
  return {
    activeFeeds,
    averageScore,
    id: key,
    permissionedFeeds,
    ranking: rank,
    ...(knownPublisher && {
      icon: <PublisherIcon knownPublisher={knownPublisher} />,
      name: knownPublisher.name,
    }),
  };
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
    maxPoolSize: publisherCaps.parsed?.[0]?.publisher_stake_caps
      .map(({ cap }) => cap)
      .reduce((acc, value) => acc + value),
    rewardsDistributed:
      claimableRewards + INITIAL_REWARD_POOL_SIZE - distributedRewards,
    totalStaked:
      sumDelegations(delState.delState) + sumDelegations(delState.selfDelState),
  };
};

const sumDelegations = (
  values: { totalDelegation: bigint; deltaDelegation: bigint }[],
) =>
  values.reduce(
    (acc, value) => acc + value.totalDelegation + value.deltaDelegation,
    0n,
  );
