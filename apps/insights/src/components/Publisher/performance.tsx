import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Network } from "@phosphor-icons/react/dist/ssr/Network";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Table } from "@pythnetwork/component-library/Table";
import { notFound } from "next/navigation";

import { getRankingsWithData } from "./get-rankings-with-data";
import styles from "./performance.module.scss";
import { getPublishers } from "../../services/clickhouse";
import { getTotalFeedCount } from "../../services/pyth";
import { PriceFeedTag } from "../PriceFeedTag";
import { PublisherTag } from "../PublisherTag";
import { Ranking } from "../Ranking";
import { Score } from "../Score";

const PUBLISHER_SCORE_WIDTH = 24;

type Props = {
  params: Promise<{
    key: string;
  }>;
};

export const Performance = async ({ params }: Props) => {
  const { key } = await params;
  const [publishers, rankingsWithData, totalFeeds] = await Promise.all([
    getPublishers(),
    getRankingsWithData(key),
    getTotalFeedCount(),
  ]);
  const slicedPublishers = sliceAround(
    publishers,
    (publisher) => publisher.key === key,
    2,
  );

  return slicedPublishers === undefined ? (
    notFound()
  ) : (
    <div className={styles.performance}>
      <Card icon={<Broadcast />} title="Publishers Ranking">
        <Table
          rounded
          fill
          label="Publishers Ranking"
          columns={[
            {
              id: "ranking",
              name: "RANKING",
              width: 30,
            },
            {
              id: "name",
              name: "NAME / ID",
              isRowHeader: true,
              alignment: "left",
            },
            {
              id: "activeFeeds",
              name: "ACTIVE FEEDS",
              alignment: "center",
              width: 40,
            },
            {
              id: "inactiveFeeds",
              name: "INACTIVE FEEDS",
              alignment: "center",
              width: 45,
            },
            {
              id: "medianScore",
              name: "MEDIAN SCORE",
              alignment: "right",
              width: PUBLISHER_SCORE_WIDTH,
            },
          ]}
          rows={slicedPublishers.map((publisher) => ({
            id: publisher.key,
            data: {
              ranking: (
                <Ranking isCurrent={publisher.key === key}>
                  {publisher.rank}
                </Ranking>
              ),
              activeFeeds: publisher.numSymbols,
              inactiveFeeds: totalFeeds - publisher.numSymbols,
              medianScore: (
                <Score
                  width={PUBLISHER_SCORE_WIDTH}
                  score={publisher.medianScore}
                />
              ),
              name: <PublisherTag publisherKey={publisher.key} />,
            },
            ...(publisher.key !== key && {
              href: `/publishers/${publisher.key}`,
            }),
          }))}
        />
      </Card>
      <Card icon={<Network />} title="High-performing feeds">
        <Table
          rounded
          fill
          label="High-performing feeds"
          columns={feedColumns}
          rows={getFeedRows(
            rankingsWithData
              .filter(({ ranking }) => ranking.final_score > 0.9)
              .sort((a, b) => b.ranking.final_score - a.ranking.final_score),
          )}
        />
      </Card>
      <Card icon={<Network />} title="Low-performing feeds">
        <Table
          rounded
          fill
          label="Low-performing feeds"
          columns={feedColumns}
          rows={getFeedRows(
            rankingsWithData
              .filter(({ ranking }) => ranking.final_score < 0.7)
              .sort((a, b) => a.ranking.final_score - b.ranking.final_score),
          )}
        />
      </Card>
    </div>
  );
};

const feedColumns = [
  {
    id: "score" as const,
    name: "SCORE",
    alignment: "left" as const,
    width: 40,
  },
  {
    id: "asset" as const,
    name: "ASSET",
    isRowHeader: true,
    alignment: "left" as const,
    fill: true,
  },
  {
    id: "assetClass" as const,
    name: "ASSET CLASS",
    alignment: "right" as const,
    width: 50,
  },
];

const getFeedRows = (
  rankingsWithData: Awaited<ReturnType<typeof getRankingsWithData>>,
) =>
  rankingsWithData.slice(0, 10).map(({ feed, ranking }) => ({
    id: ranking.symbol,
    data: {
      asset: <PriceFeedTag compact feed={feed} />,
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
