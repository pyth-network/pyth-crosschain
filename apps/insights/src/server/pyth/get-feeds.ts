// disable file
//  @typescript-eslint/no-unused-vars
import { z } from 'zod';


import { getPythMetadata } from './get-metadata';
import { Cluster, priceFeedsSchema } from "../../services/pyth";
import { redisCache } from '../../utils/cache';


/**
 * Prepare a JSON-serializable version for Redis (strip Maps / transform).
 * This is what we actually persist in L2 (Redis).
 */
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
    ttl: 1000 * 60 * 60 * 24,
  },
  _getFeeds,
).getFeeds;




export const getFeeds = async (cluster: Cluster): Promise<z.infer<typeof priceFeedsSchema>> => {
  // eslint-disable-next-line no-console
  console.log('getFeeds function called');
  return getFeedsCached(cluster);
};

// const _getFeedsBySymbol = async (cluster: Cluster, symbol: string) => {
//   const feeds = await getFeeds(cluster);
//   return feeds.find((feed) => feed.symbol === symbol);
// };

// export const getFeedsBySymbol = redisCache.define(
//   "getFeedsBySymbol",
//   {
//     ttl: 1000 * 60 * 60 * 24,
//   },
//   _getFeedsBySymbol,
// ).getFeedsBySymbol;