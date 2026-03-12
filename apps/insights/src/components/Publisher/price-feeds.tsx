import { SymbolPairTag } from "@pythnetwork/component-library/SymbolPairTag";
import { notFound } from "next/navigation";
import type { Cluster } from "../../services/pyth";
import { parseCluster } from "../../services/pyth";
import { AssetClassBadge } from "../AssetClassBadge";
import type { PriceComponent } from "../PriceComponentsCard";
import { PriceComponentsCard } from "../PriceComponentsCard";
import { PriceFeedIcon } from "../PriceFeedIcon";
import { getPriceFeeds } from "./get-price-feeds";
import styles from "./price-feeds.module.scss";

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
      cluster={parsedCluster}
      metricsTime={metricsTime}
      priceFeeds={feeds.map(({ ranking, feed, status }) => ({
        assetClass: feed.product.asset_type,
        deviationScore: ranking?.deviation_score,
        displaySymbol: feed.product.display_symbol,
        feedKey: feed.product.price_account,
        firstEvaluation: ranking?.first_ranking_time,
        id: feed.product.price_account,
        name: (
          <SymbolPairTag
            className={styles.symbol}
            description={feed.product.description}
            displaySymbol={feed.product.display_symbol}
            icon={<PriceFeedIcon assetClass={feed.product.asset_type} />}
          />
        ),
        nameAsString: feed.product.display_symbol,
        rank: ranking?.final_rank,
        score: ranking?.final_score,
        stalledScore: ranking?.stalled_score,
        status,
        symbol: feed.symbol,
        uptimeScore: ranking?.uptime_score,
      }))}
      publisherKey={key}
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
    extraColumns={[
      {
        alignment: "left",
        allowsSorting: true,
        id: "assetClassBadge",
        name: "ASSET CLASS",
      },
    ]}
    label="Price Feeds"
    nameLoadingSkeleton={<SymbolPairTag isLoading />}
    nameWidth={90}
    searchPlaceholder="Feed symbol"
    {...(props.isLoading
      ? { isLoading: true }
      : {
          metricsTime: props.metricsTime,
          priceComponents: props.priceFeeds.map((feed) => ({
            ...feed,
            assetClassBadge: (
              <AssetClassBadge>{feed.assetClass}</AssetClassBadge>
            ),
            cluster: props.cluster,
            publisherKey: props.publisherKey,
          })),
        })}
  />
);
