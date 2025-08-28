import { Cluster, priceFeedsSchema } from ".";
import { getPythMetadata } from "./get-metadata";
import { redisCache } from "../../cache";

const _getFeeds = async (cluster: Cluster) => {
  const unfilteredData = await getPythMetadata(cluster);
  const filtered = unfilteredData.symbols
    .filter(
      (symbol) =>
        unfilteredData.productFromSymbol.get(symbol)?.display_symbol !==
        undefined,
    )
    .map((symbol) => ({
      symbol,
      product: unfilteredData.productFromSymbol.get(symbol),
      price: {
        ...unfilteredData.productPrice.get(symbol),
        priceComponents:
          unfilteredData.productPrice
            .get(symbol)
            ?.priceComponents.map(({ publisher }) => ({
              publisher: publisher.toBase58(),
            })) ?? [],
      },
    }))
  return priceFeedsSchema.parse(filtered)
};

export const getFeeds = redisCache.define("getFeeds", _getFeeds).getFeeds;
