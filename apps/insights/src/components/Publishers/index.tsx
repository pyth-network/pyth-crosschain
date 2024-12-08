import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr/ArrowSquareOut";
import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Info } from "@phosphor-icons/react/dist/ssr/Info";
import { Lightbulb } from "@phosphor-icons/react/dist/ssr/Lightbulb";
import { Alert, AlertTrigger } from "@pythnetwork/component-library/Alert";
import { ButtonLink, Button } from "@pythnetwork/component-library/Button";
import { Card } from "@pythnetwork/component-library/Card";
import { Skeleton } from "@pythnetwork/component-library/Skeleton";
import { StatCard } from "@pythnetwork/component-library/StatCard";
import { lookup as lookupPublisher } from "@pythnetwork/known-publishers";
import clsx from "clsx";
import type { ComponentProps } from "react";
import { z } from "zod";

import styles from "./index.module.scss";
import { PublishersCard } from "./publishers-card";
import { SemicircleMeter, Label } from "./semicircle-meter";
import { client as clickhouseClient } from "../../services/clickhouse";
import { client as hermesClient } from "../../services/hermes";
import { CLUSTER, client as pythClient } from "../../services/pyth";
import { client as stakingClient } from "../../services/staking";
import { CopyButton } from "../CopyButton";
import { FormattedTokens } from "../FormattedTokens";
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
        <div className={styles.stats}>
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
                  <ButtonLink
                    size="xs"
                    variant="solid"
                    href="https://docs.pyth.network/home/oracle-integrity-staking/publisher-quality-ranking"
                    target="_blank"
                  >
                    Learn more
                  </ButtonLink>
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
              <ButtonLink
                href="https://staking.pyth.network"
                target="_blank"
                size="sm"
                variant="outline"
                afterIcon={ArrowSquareOut}
              >
                Staking App
              </ButtonLink>
            }
          >
            <SemicircleMeter
              width={340}
              height={340}
              value={Number(oisStats.totalStaked)}
              maxValue={oisStats.maxPoolSize ?? 0}
              className={styles.oisPool ?? ""}
              chartClassName={styles.oisPoolChart}
              barClassName={styles.bar}
              backgroundClassName={styles.background}
            >
              <div className={styles.legend}>
                <Label className={styles.title}>PYTH Staking Pool</Label>
                <p className={styles.poolUsed}>
                  <FormattedTokens mode="wholePart">
                    {oisStats.totalStaked}
                  </FormattedTokens>
                </p>
                <p className={styles.poolTotal}>
                  /{" "}
                  <FormattedTokens mode="wholePart">
                    {BigInt(oisStats.maxPoolSize ?? 0)}
                  </FormattedTokens>
                </p>
              </div>
            </SemicircleMeter>
            <div className={styles.oisStats}>
              <StatCard
                header="Total Staked"
                variant="tertiary"
                stat={
                  <>
                    <TokenIcon />
                    <FormattedTokens>{oisStats.totalStaked}</FormattedTokens>
                  </>
                }
              />
              <StatCard
                header="Total Rewards Distributed"
                variant="tertiary"
                stat={
                  <>
                    <TokenIcon />
                    <FormattedTokens>
                      {oisStats.rewardsDistributed}
                    </FormattedTokens>
                  </>
                }
              />
            </div>
          </Card>
        </div>
        <PublishersCard
          className={styles.publishersCard}
          rankingLoadingSkeleton={
            <Skeleton className={styles.rankingLoader} fill />
          }
          nameLoadingSkeleton={
            <div
              className={clsx(
                styles.publisherName,
                styles.publisherNamePlaceholder,
              )}
            >
              <Skeleton className={styles.publisherIcon} fill />
              <div className={styles.nameAndKey}>
                <div className={styles.name}>
                  <Skeleton width={40} />
                </div>
                <Skeleton className={styles.publisherKey ?? ""} width={20} />
              </div>
            </div>
          }
          publishers={publishers.map(
            ({ key, rank, numSymbols, medianScore }) => ({
              id: key,
              nameAsString: lookupPublisher(key)?.name,
              name: <PublisherName>{key}</PublisherName>,
              ranking: <Ranking>{rank}</Ranking>,
              activeFeeds: numSymbols,
              inactiveFeeds: totalFeeds - numSymbols,
              medianScore,
            }),
          )}
        />
      </div>
    </div>
  );
};

const Ranking = ({ className, ...props }: ComponentProps<"span">) => (
  <span className={clsx(styles.ranking, className)} {...props} />
);

const PublisherName = ({ children }: { children: string }) => {
  const knownPublisher = lookupPublisher(children);
  const Icon = knownPublisher?.icon.color ?? UndisclosedIcon;
  const name = knownPublisher?.name ?? "Undisclosed";
  return (
    <div
      data-is-undisclosed={knownPublisher === undefined ? "" : undefined}
      className={styles.publisherName}
    >
      <Icon className={styles.publisherIcon} />
      {knownPublisher ? (
        <div className={styles.nameAndKey}>
          <div className={styles.name}>{name}</div>
          <CopyButton className={styles.publisherKey ?? ""} text={children}>
            {`${children.slice(0, 4)}...${children.slice(-4)}`}
          </CopyButton>
        </div>
      ) : (
        <CopyButton className={styles.name ?? ""} text={children}>
          {`${children.slice(0, 4)}...${children.slice(-4)}`}
        </CopyButton>
      )}
    </div>
  );
};

const UndisclosedIcon = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={clsx(styles.undisclosedIconWrapper, className)} {...props}>
    <Broadcast className={styles.undisclosedIcon} />
  </div>
);

const getPublishers = async () => {
  const rows = await clickhouseClient.query({
    query:
      "SELECT key, rank, numSymbols, medianScore FROM insights_publishers(cluster={cluster: String})",
    query_params: { cluster: CLUSTER },
  });
  const result = await rows.json();

  return publishersSchema.parse(result.data);
};

const publishersSchema = z.array(
  z.strictObject({
    key: z.string(),
    rank: z.number(),
    numSymbols: z.number(),
    medianScore: z.number(),
  }),
);

const getTotalFeedCount = async () => {
  const pythData = await pythClient.getData();
  return pythData.symbols.filter(
    (symbol) =>
      (pythData.productPrice.get(symbol)?.numComponentPrices ?? 0) > 0,
  ).length;
};

const getOisStats = async () => {
  const [poolData, rewardCustodyAccount, publisherCaps] = await Promise.all([
    stakingClient.getPoolDataAccount(),
    stakingClient.getRewardCustodyAccount(),
    hermesClient.getLatestPublisherCaps({ parsed: true }),
  ]);

  return {
    totalStaked:
      sumDelegations(poolData.delState) + sumDelegations(poolData.selfDelState),
    rewardsDistributed:
      poolData.claimableRewards +
      INITIAL_REWARD_POOL_SIZE -
      rewardCustodyAccount.amount,
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
