import { notFound } from "next/navigation";

import { getPriceFeeds } from "./get-price-feeds";
import type { Cluster } from "../../services/pyth";
import { parseCluster } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import type { PriceComponent } from "../PriceComponentsCard";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { PriceFeedTag } from "../PriceFeedTag";

type Props = {
  params: Promise<{
    cluster: string;
    key: string;
  }>;
};

export const PriceFeeds = async ({ params }: Props) => {
  const { key, cluster } = await params;
  const parsedCluster = parseCluster(cluster);

  if (parsedCluster === undefined) {
    notFound();
  }

  const feeds = await getPriceFeeds(parsedCluster, key);
  const metricsTime = feeds.find((feed) => feed.ranking !== undefined)?.ranking
    ?.time;

  return (
    <PriceFeedsCard
      metricsTime={metricsTime}
      publisherKey={key}
      cluster={parsedCluster}
      priceFeeds={feeds.map(({ ranking, feed, status }) => ({
        symbol: feed.symbol,
        name: (
          <PriceFeedTag
            displaySymbol={feed.product.display_symbol}
            description={feed.product.description}
            icon={
              <PriceFeedIcon
                assetClass={feed.product.asset_type}
                symbol={feed.symbol}
              />
            }
          />
        ),
        score: ranking?.final_score,
        rank: ranking?.final_rank,
        uptimeScore: ranking?.uptime_score,
        deviationScore: ranking?.deviation_score,
        stalledScore: ranking?.stalled_score,
        status,
        feedKey: feed.product.price_account,
        nameAsString: feed.product.display_symbol,
        id: feed.product.price_account,
        assetClass: feed.product.asset_type,
        displaySymbol: feed.product.display_symbol,
        firstEvaluation: ranking?.first_ranking_time,
      }))}
    />
  );
};

export const PriceFeedsLoading = () => <PriceFeedsCard isLoading />;

type PriceFeedsCardProps =
  | { isLoading: true }
  | {
      isLoading?: false | undefined;
      publisherKey: string;
      cluster: Cluster;
      priceFeeds: Omit<PriceComponent, "cluster" | "publisherKey">[];
      metricsTime?: Date | undefined;
    };

const PriceFeedsCard = (props: PriceFeedsCardProps) => (
  <PriceComponentsCard
    label="Price Feeds"
    searchPlaceholder="Feed symbol"
    nameLoadingSkeleton={<PriceFeedTag isLoading />}
    extraColumns={[
      {
        id: "assetClassBadge",
        name: "ASSET CLASS",
        alignment: "left",
        allowsSorting: true,
      },
    ]}
    nameWidth={90}
    {...(props.isLoading
      ? { isLoading: true }
      : {
          metricsTime: props.metricsTime,
          priceComponents: props.priceFeeds.map((feed) => ({
            ...feed,
            cluster: props.cluster,
            publisherKey: props.publisherKey,
            assetClassBadge: (
              <AssetClassBadge>{feed.assetClass}</AssetClassBadge>
            ),
          })),
        })}
  />
);
