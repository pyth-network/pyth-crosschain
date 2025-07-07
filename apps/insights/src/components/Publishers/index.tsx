import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { ClockCountdown } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";

import styles from "./index.module.scss";
import { PublishersCard } from "./publishers-card";
import { getPublishers } from "../../services/clickhouse";
import { getPublisherCaps } from "../../services/hermes";
import { Cluster } from "../../services/pyth";
import {
  getDelState,
  getClaimableRewards,
  getDistributedRewards,
} from "../../services/staking";
import { ExplainAverage } from "../Explanations";
import { FormattedDate } from "../FormattedDate";
import { FormattedTokens } from "../FormattedTokens";
import { PublisherIcon } from "../PublisherIcon";
import { SemicircleMeter, Label } from "../SemicircleMeter";
import { TokenIcon } from "../TokenIcon";

const INITIAL_REWARD_POOL_SIZE = 60_000_000_000_000n;

export const Publishers = async () => {
  const [pythnetPublishers, pythtestConformancePublishers, oisStats] =
    await Promise.all([
      getPublishers(Cluster.Pythnet),
      getPublishers(Cluster.PythtestConformance),
      getOisStats(),
    ]);

  const rankingTime = pythnetPublishers[0]?.timestamp;
  const scoreTime = pythnetPublishers[0]?.scoreTime;

  return (
    <div className={styles.publishers}>
      <div className={styles.headerContainer}>
        <h1 className={styles.header}>Publishers</h1>
        {rankingTime && (
          <div className={styles.rankingsLastUpdated}>
            <span>
              Rankings last updated{" "}
              <FormattedDate
                value={rankingTime}
                dateStyle="long"
                timeStyle="long"
                timeZone="utc"
              />
            </span>
            <ClockCountdown className={styles.clockIcon} />
          </div>
        )}
      </div>
      <div className={styles.body}>
        <StatCard
          variant="primary"
          header="Active Publishers"
          stat={pythnetPublishers.length}
          className={styles.statCard ?? ""}
        />
        <StatCard
          header="Average Feed Score"
          corner={<ExplainAverage scoreTime={scoreTime} />}
          className={styles.statCard ?? ""}
          stat={(
            pythnetPublishers.reduce(
              (sum, publisher) => sum + publisher.averageScore,
              0,
            ) / pythnetPublishers.length
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
          title="Oracle Integrity Staking (OIS)"
          className={styles.oisCard}
          toolbar={
            <Button
              href="https://staking.pyth.network"
              target="_blank"
              size="sm"
              variant="outline"
              afterIcon={<ArrowSquareOut />}
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
}: Awaited<ReturnType<typeof getPublishers>>[number]) => {
  const knownPublisher = lookupPublisher(key);
  return {
    id: key,
    ranking: rank,
    permissionedFeeds,
    activeFeeds,
    averageScore,
    ...(knownPublisher && {
      name: knownPublisher.name,
      icon: <PublisherIcon knownPublisher={knownPublisher} />,
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
