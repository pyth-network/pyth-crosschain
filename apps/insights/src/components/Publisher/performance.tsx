import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Confetti } from "@phosphor-icons/react/dist/ssr/Confetti";
import { Network } from "@phosphor-icons/react/dist/ssr/Network";
import { SmileySad } from "@phosphor-icons/react/dist/ssr/SmileySad";
import { Card } from "@pythnetwork/component-library/Card";
import { EntityList } from "@pythnetwork/component-library/EntityList";
import { Link } from "@pythnetwork/component-library/Link";
import type { Variant as NoResultsVariant } from "@pythnetwork/component-library/NoResults";
import { NoResults } from "@pythnetwork/component-library/NoResults";
import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import { Table } from "@pythnetwork/component-library/Table";
import { lookup } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { getPublishersWithRankings } from "../../get-publishers-with-rankings";
import type { Cluster } from "../../services/pyth";
import { ClusterToName, parseCluster } from "../../services/pyth";
import { Status } from "../../status";
import {
  ExplainActive,
  ExplainAverage,
  ExplainInactive,
} from "../Explanations";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PublisherIcon } from "../PublisherIcon";
import { PublisherTag } from "../PublisherTag";
import { Ranking } from "../Ranking";
import { Score } from "../Score";
import { getPriceFeeds } from "./get-price-feeds";
import styles from "./performance.module.scss";
import { TopFeedsTable } from "./top-feeds-table";

const PUBLISHER_SCORE_WIDTH = 24;

type Props = {
  params: Promise<{
    cluster: string;
    key: string;
  }>;
};

export const Performance = async ({ params }: Props) => {
  const { key, cluster } = await params;
  const parsedCluster = parseCluster(cluster);

  if (parsedCluster === undefined) {
    notFound();
  }
  const [publishers, priceFeeds] = await Promise.all([
    getPublishersWithRankings(parsedCluster),
    getPriceFeeds(parsedCluster, key),
  ]);
  const slicedPublishers = sliceAround(
    publishers,
    (publisher) => publisher.key === key,
    2,
  );
  const rows = slicedPublishers?.map((publisher) => {
    const knownPublisher = lookup(publisher.key);
    return {
      data: {
        activeFeeds: (
          <Link
            href={`/publishers/${ClusterToName[parsedCluster]}/${publisher.key}/price-feeds?status=Active`}
            invert
            prefetch={false}
          >
            {publisher.activeFeeds}
          </Link>
        ),
        averageScore: publisher.averageScore !== undefined && (
          <Score score={publisher.averageScore} width={PUBLISHER_SCORE_WIDTH} />
        ),
        inactiveFeeds: (
          <Link
            href={`/publishers/${ClusterToName[parsedCluster]}/${publisher.key}/price-feeds?status=Inactive`}
            invert
            prefetch={false}
          >
            {publisher.inactiveFeeds}
          </Link>
        ),
        name: (
          <PublisherTag
            cluster={parsedCluster}
            publisherKey={publisher.key}
            {...(knownPublisher && {
              icon: <PublisherIcon knownPublisher={knownPublisher} />,
              name: knownPublisher.name,
            })}
          />
        ),
        ranking: (publisher.rank !== undefined || publisher.key === key) && (
          <Ranking className={styles.ranking} isCurrent={publisher.key === key}>
            {publisher.rank}
          </Ranking>
        ),
      },
      id: publisher.key,
      nameAsString: knownPublisher?.name ?? publisher.key,
      prefetch: false,
      ...(publisher.key !== key && {
        href: `/publishers/${ClusterToName[parsedCluster]}/${publisher.key}`,
      }),
    };
  });

  const highPerformingFeeds = getFeedRows(
    priceFeeds
      .filter((feed) => hasRanking(feed))
      .filter(({ ranking }) => ranking.final_score > 0.9)
      .sort((a, b) => b.ranking.final_score - a.ranking.final_score),
  );

  const lowPerformingFeeds = getFeedRows(
    priceFeeds
      .filter((feed) => hasRanking(feed))
      .filter(({ ranking }) => ranking.final_score < 0.7)
      .sort((a, b) => a.ranking.final_score - b.ranking.final_score),
  );

  return rows === undefined ? (
    notFound()
  ) : (
    <PerformanceImpl
      averageScoreTime={publishers[0]?.scoreTime}
      cluster={parsedCluster}
      highPerformingFeeds={highPerformingFeeds}
      lowPerformingFeeds={lowPerformingFeeds}
      publisherKey={key}
      publishers={rows}
    />
  );
};

export const PerformanceLoading = () => <PerformanceImpl isLoading />;

type PerformanceImplProps =
  | { isLoading: true }
  | {
      isLoading?: false;
      publisherKey: string;
      cluster: Cluster;
      publishers: (NonNullable<
        ComponentProps<
          typeof Table<
            | "ranking"
            | "averageScore"
            | "activeFeeds"
            | "inactiveFeeds"
            | "name"
          >
        >["rows"]
      >[number] & {
        prefetch: boolean;
        nameAsString: string;
      })[];
      highPerformingFeeds: ReturnType<typeof getFeedRows>;
      lowPerformingFeeds: ReturnType<typeof getFeedRows>;
      averageScoreTime?: Date | undefined;
    };

const PerformanceImpl = (props: PerformanceImplProps) => (
  <div className={styles.performance}>
    <Card
      className={styles.publishersRankingCard ?? ""}
      icon={<Broadcast />}
      title="Publishers Ranking"
    >
      <EntityList
        className={styles.publishersRankingList ?? ""}
        fields={[
          { id: "ranking", name: "Ranking" },
          { id: "averageScore", name: "Average Score" },
          { id: "activeFeeds", name: "Active Feeds" },
          { id: "inactiveFeeds", name: "Inactive Feeds" },
        ]}
        headerLoadingSkeleton={<PublisherTag isLoading />}
        label="Publishers Ranking"
        {...(props.isLoading
          ? { isLoading: true }
          : {
              rows: props.publishers.map((publisher) => ({
                ...publisher,
                header: publisher.data.name,
                textValue: publisher.nameAsString,
              })),
            })}
      />
      <Table
        className={styles.publishersRankingTable ?? ""}
        columns={[
          {
            id: "ranking",
            name: "RANKING",
            width: 25,
          },
          {
            alignment: "left",
            id: "name",
            isRowHeader: true,
            loadingSkeleton: <PublisherTag isLoading />,
            name: "NAME / ID",
          },
          {
            alignment: "center",
            id: "activeFeeds",
            name: (
              <>
                ACTIVE FEEDS
                <ExplainActive />
              </>
            ),
            width: 30,
          },
          {
            alignment: "center",
            id: "inactiveFeeds",
            name: (
              <>
                INACTIVE FEEDS
                <ExplainInactive />
              </>
            ),
            width: 30,
          },
          {
            alignment: "right",
            id: "averageScore",
            name: (
              <>
                AVERAGE SCORE
                <ExplainAverage
                  {...(!props.isLoading && {
                    scoreTime: props.averageScoreTime,
                  })}
                />
              </>
            ),
            width: PUBLISHER_SCORE_WIDTH,
          },
        ]}
        fill
        label="Publishers Ranking"
        rounded
        {...(props.isLoading
          ? { isLoading: true }
          : {
              rows: props.publishers,
            })}
      />
    </Card>
    <TopFeedsCard
      emptyBody="This publisher has no high performing feeds"
      emptyHeader="Oh no!"
      emptyIcon={<SmileySad />}
      emptyVariant="error"
      title="High-Performing"
      {...(props.isLoading
        ? { isLoading: true }
        : {
            cluster: props.cluster,
            feeds: props.highPerformingFeeds,
            publisherKey: props.publisherKey,
          })}
    />
    <TopFeedsCard
      emptyBody="This publisher has no low performing feeds"
      emptyHeader="Looking good!"
      emptyIcon={<Confetti />}
      emptyVariant="success"
      title="Low-Performing"
      {...(props.isLoading
        ? { isLoading: true }
        : {
            cluster: props.cluster,
            feeds: props.lowPerformingFeeds,
            publisherKey: props.publisherKey,
          })}
    />
  </div>
);

const getFeedRows = (
  priceFeeds: (Omit<
    Awaited<ReturnType<typeof getPriceFeeds>>,
    "ranking"
  >[number] & {
    ranking: NonNullable<
      Awaited<ReturnType<typeof getPriceFeeds>>[number]["ranking"]
    >;
  })[],
) =>
  priceFeeds
    .filter((feed) => feed.status === Status.Active)
    .slice(0, 20)
    .map(({ feed, ranking, status }) => ({
      assetClass: feed.product.asset_type,
      description: feed.product.description,
      displaySymbol: feed.product.display_symbol,
      firstEvaluation: ranking.first_ranking_time,
      href: `/price-feeds/${encodeURIComponent(feed.symbol)}`,
      icon: <PriceFeedIcon assetClass={feed.product.asset_type} />,
      key: feed.product.price_account,
      rank: ranking.final_rank,
      score: ranking.final_score,
      status,
      symbol: feed.symbol,
    }));

const sliceAround = <T,>(
  arr: T[],
  predicate: (elem: T) => boolean,
  count: number,
): T[] | undefined => {
  const index = arr.findIndex((item) => predicate(item));
  if (index === -1) {
    return undefined;
  } else {
    const min = Math.max(
      0,
      index - count - Math.max(0, index + count + 1 - arr.length),
    );
    const max = Math.min(arr.length, min + count * 2 + 1);
    return arr.slice(min, max);
  }
};

const hasRanking = <T,>(feed: {
  ranking: T | undefined;
}): feed is { ranking: T } => feed.ranking !== undefined;

type TopFeedsCardProps = {
  title: string;
  emptyIcon: ReactNode;
  emptyHeader: string;
  emptyBody: string;
  emptyVariant: NoResultsVariant;
} & (
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      publisherKey: string;
      cluster: Cluster;
      feeds: ReturnType<typeof getFeedRows>;
    }
);

const TopFeedsCard = ({
  title,
  emptyIcon,
  emptyHeader,
  emptyBody,
  emptyVariant,
  ...props
}: TopFeedsCardProps) => (
  <Card icon={<Network />} title={`${title} Feeds`}>
    {props.isLoading || props.feeds.length > 0 ? (
      <TopFeedsTable
        label={`${title} Feeds`}
        nameLoadingSkeleton={<SymbolPairTag isLoading />}
        publisherScoreWidth={PUBLISHER_SCORE_WIDTH}
        {...(props.isLoading
          ? { isLoading: true }
          : {
              cluster: props.cluster,
              feeds: props.feeds,
              publisherKey: props.publisherKey,
            })}
      />
    ) : (
      <NoResults
        body={<p>{emptyBody}</p>}
        header={emptyHeader}
        icon={emptyIcon}
        variant={emptyVariant}
      />
    )}
  </Card>
);
