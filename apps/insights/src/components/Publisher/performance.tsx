import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Confetti } from "@phosphor-icons/react/dist/ssr/Confetti";
import { Network } from "@phosphor-icons/react/dist/ssr/Network";
import { SmileySad } from "@phosphor-icons/react/dist/ssr/SmileySad";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Link } from "@pythnetwork/component-library/Link";
import { Table } from "@pythnetwork/component-library/Table";
import { lookup } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getPriceFeeds } from "./get-price-feeds";
import styles from "./performance.module.scss";
import { TopFeedsTable } from "./top-feeds-table";
import { getPublishers } from "../../services/clickhouse";
import { ClusterToName, parseCluster } from "../../services/pyth";
import { Status } from "../../status";
import { EntityList } from "../EntityList";
import {
  ExplainActive,
  ExplainInactive,
  ExplainAverage,
} from "../Explanations";
import type { Variant as NoResultsVariant } from "../NoResults";
import { NoResults } from "../NoResults";
import { PriceFeedTag } from "../PriceFeedTag";
import { PublisherIcon } from "../PublisherIcon";
import { PublisherTag } from "../PublisherTag";
import { Ranking } from "../Ranking";
import { Score } from "../Score";

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
    getPublishers(parsedCluster),
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
      id: publisher.key,
      nameAsString: knownPublisher?.name ?? publisher.key,
      data: {
        ranking: (
          <Ranking isCurrent={publisher.key === key} className={styles.ranking}>
            {publisher.rank}
          </Ranking>
        ),
        activeFeeds: (
          <Link
            href={`/publishers/${ClusterToName[parsedCluster]}/${publisher.key}/price-feeds?status=Active`}
            invert
          >
            {publisher.activeFeeds}
          </Link>
        ),
        inactiveFeeds: (
          <Link
            href={`/publishers/${ClusterToName[parsedCluster]}/${publisher.key}/price-feeds?status=Inactive`}
            invert
          >
            {publisher.inactiveFeeds}
          </Link>
        ),
        averageScore: (
          <Score width={PUBLISHER_SCORE_WIDTH} score={publisher.averageScore} />
        ),
        name: (
          <PublisherTag
            cluster={parsedCluster}
            publisherKey={publisher.key}
            {...(knownPublisher && {
              name: knownPublisher.name,
              icon: <PublisherIcon knownPublisher={knownPublisher} />,
            })}
          />
        ),
      },
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
    <div className={styles.performance}>
      <Card
        icon={<Broadcast />}
        title="Publishers Ranking"
        className={styles.publishersRankingCard ?? ""}
      >
        <EntityList
          label="Publishers Ranking"
          className={styles.publishersRankingList ?? ""}
          fields={[
            { id: "ranking", name: "Ranking" },
            { id: "averageScore", name: "Average Score" },
            { id: "activeFeeds", name: "Active Feeds" },
            { id: "inactiveFeeds", name: "Inactive Feeds" },
          ]}
          rows={rows.map((row) => ({
            ...row,
            textValue: row.nameAsString,
            header: row.data.name,
          }))}
        />
        <Table
          rounded
          fill
          className={styles.publishersRankingTable ?? ""}
          label="Publishers Ranking"
          columns={[
            {
              id: "ranking",
              name: "RANKING",
              width: 25,
            },
            {
              id: "name",
              name: "NAME / ID",
              isRowHeader: true,
              alignment: "left",
            },
            {
              id: "activeFeeds",
              name: (
                <>
                  ACTIVE FEEDS
                  <ExplainActive />
                </>
              ),
              alignment: "center",
              width: 30,
            },
            {
              id: "inactiveFeeds",
              name: (
                <>
                  INACTIVE FEEDS
                  <ExplainInactive />
                </>
              ),
              alignment: "center",
              width: 30,
            },
            {
              id: "averageScore",
              name: (
                <>
                  AVERAGE SCORE
                  <ExplainAverage scoreTime={publishers[0]?.scoreTime} />
                </>
              ),
              alignment: "right",
              width: PUBLISHER_SCORE_WIDTH,
            },
          ]}
          rows={rows}
        />
      </Card>
      <TopFeedsCard
        title="High-Performing"
        emptyIcon={<SmileySad />}
        emptyHeader="Oh no!"
        emptyBody="This publisher has no high performing feeds"
        emptyVariant="error"
        feeds={highPerformingFeeds}
      />
      <TopFeedsCard
        title="Low-Performing"
        emptyIcon={<Confetti />}
        emptyHeader="Looking good!"
        emptyBody="This publisher has no low performing feeds"
        emptyVariant="success"
        feeds={lowPerformingFeeds}
      />
    </div>
  );
};

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
    .map(({ feed, ranking }) => ({
      id: feed.symbol,
      textValue: feed.symbol,
      data: {
        asset: <PriceFeedTag compact symbol={feed.symbol} />,
        assetClass: (
          <Badge variant="neutral" style="outline" size="xs">
            {feed.product.asset_type.toUpperCase()}
          </Badge>
        ),
        score: (
          <Score width={PUBLISHER_SCORE_WIDTH} score={ranking.final_score} />
        ),
      },
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
  feeds: ReturnType<typeof getFeedRows>;
};

const TopFeedsCard = ({
  title,
  emptyIcon,
  emptyHeader,
  emptyBody,
  emptyVariant,
  feeds,
}: TopFeedsCardProps) => (
  <Card icon={<Network />} title={`${title} Feeds`}>
    {feeds.length === 0 ? (
      <NoResults
        icon={emptyIcon}
        header={emptyHeader}
        body={emptyBody}
        variant={emptyVariant}
      />
    ) : (
      <TopFeedsTable
        label={`${title} Feeds`}
        publisherScoreWidth={PUBLISHER_SCORE_WIDTH}
        rows={feeds}
      />
    )}
  </Card>
);
