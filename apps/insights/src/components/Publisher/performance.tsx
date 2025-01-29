import { Broadcast } from "@phosphor-icons/react/dist/ssr/Broadcast";
import { Confetti } from "@phosphor-icons/react/dist/ssr/Confetti";
import { Network } from "@phosphor-icons/react/dist/ssr/Network";
import { SmileySad } from "@phosphor-icons/react/dist/ssr/SmileySad";
import { Badge } from "@pythnetwork/component-library/Badge";
import { Card } from "@pythnetwork/component-library/Card";
import { Table } from "@pythnetwork/component-library/Table";
import { lookup } from "@pythnetwork/known-publishers";
import { notFound } from "next/navigation";

import { getPriceFeeds } from "./get-price-feeds";
import styles from "./performance.module.scss";
import { TopFeedsTable } from "./top-feeds-table";
import { getPublishers } from "../../services/clickhouse";
import { Cluster, getTotalFeedCount } from "../../services/pyth";
import { Status } from "../../status";
import { NoResults } from "../NoResults";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PriceFeedTag } from "../PriceFeedTag";
import { PublisherIcon } from "../PublisherIcon";
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
  const [publishers, priceFeeds, totalFeeds] = await Promise.all([
    getPublishers(),
    getPriceFeeds(Cluster.Pythnet, key),
    getTotalFeedCount(Cluster.Pythnet),
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
              name: "ACTIVE FEEDS",
              alignment: "center",
              width: 30,
            },
            {
              id: "inactiveFeeds",
              name: "INACTIVE FEEDS",
              alignment: "center",
              width: 30,
            },
            {
              id: "medianScore",
              name: "MEDIAN SCORE",
              alignment: "right",
              width: PUBLISHER_SCORE_WIDTH,
            },
          ]}
          rows={slicedPublishers.map((publisher) => {
            const knownPublisher = lookup(publisher.key);
            return {
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
                name: (
                  <PublisherTag
                    publisherKey={publisher.key}
                    {...(knownPublisher && {
                      name: knownPublisher.name,
                      icon: <PublisherIcon knownPublisher={knownPublisher} />,
                    })}
                  />
                ),
              },
              ...(publisher.key !== key && {
                href: `/publishers/${publisher.key}`,
              }),
            };
          })}
        />
      </Card>
      <Card icon={<Network />} title="High-Performing Feeds">
        <TopFeedsTable
          label="High-Performing Feeds"
          publisherScoreWidth={PUBLISHER_SCORE_WIDTH}
          emptyState={
            <NoResults
              icon={<SmileySad />}
              header="Oh no!"
              body="This publisher has no high performing feeds"
              variant="error"
            />
          }
          rows={getFeedRows(
            priceFeeds
              .filter((feed) => hasRanking(feed))
              .filter(({ ranking }) => ranking.final_score > 0.9)
              .sort((a, b) => b.ranking.final_score - a.ranking.final_score),
          )}
        />
      </Card>
      <Card icon={<Network />} title="Low-Performing Feeds">
        <TopFeedsTable
          label="Low-Performing Feeds"
          publisherScoreWidth={PUBLISHER_SCORE_WIDTH}
          emptyState={
            <NoResults
              icon={<Confetti />}
              header="Looking good!"
              body="This publisher has no low performing feeds"
              variant="success"
            />
          }
          rows={getFeedRows(
            priceFeeds
              .filter((feed) => hasRanking(feed))
              .filter(({ ranking }) => ranking.final_score < 0.7)
              .sort((a, b) => a.ranking.final_score - b.ranking.final_score),
          )}
        />
      </Card>
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
      id: ranking.symbol,
      data: {
        asset: (
          <PriceFeedTag
            compact
            symbol={feed.product.display_symbol}
            icon={<PriceFeedIcon symbol={feed.symbol} />}
          />
        ),
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
