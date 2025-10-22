import { Cluster } from ".";
import { getPythMetadata } from "./get-metadata";
import { redisCache } from "../../cache";
import { priceFeedsSchema } from "../../schemas/pyth/price-feeds-schema";

const _getFeeds = async (cluster: Cluster) => {
  const unfilteredData = await getPythMetadata(cluster);
  const filtered = unfilteredData.symbols
    .filter((symbol) => {
      const product = unfilteredData.productFromSymbol.get(symbol);
      const hasDisplaySymbol = product?.display_symbol !== undefined;
      const hasPriceAccount = product?.price_account !== undefined;

      return hasDisplaySymbol && hasPriceAccount;
    })
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
    }));
  return priceFeedsSchema.parse(filtered);
};

export const getFeeds = redisCache.define("getFeeds", _getFeeds).getFeeds;
