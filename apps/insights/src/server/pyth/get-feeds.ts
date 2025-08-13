import { z } from 'zod';

import { getPythMetadata } from './get-metadata';
import { Cluster, priceFeedsSchema } from "../../services/pyth";
import { DEFAULT_CACHE_TTL, redisCache } from '../../utils/cache';

const _getFeeds = async (cluster: Cluster) => {
  const unfilteredData = await getPythMetadata(cluster);
  const filtered = unfilteredData.symbols
    .filter(
      (symbol) =>
        unfilteredData.productFromSymbol.get(symbol)?.display_symbol !==
        undefined
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
    }));
  return priceFeedsSchema.parse(filtered);
};


export const getFeedsCached = redisCache.define(
  "getFeeds",
  {
    ttl: DEFAULT_CACHE_TTL,
  },
  _getFeeds,
).getFeeds;

export const getFeeds = async (cluster: Cluster): Promise<z.infer<typeof priceFeedsSchema>> => {
  return getFeedsCached(cluster);
};
