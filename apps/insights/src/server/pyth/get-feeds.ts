
import { getPythMetadata } from './get-metadata';
import { Cluster, priceFeedsSchema } from '../../services/pyth';
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

export const getFeeds = redisCache.define(
  "getFeeds",
  {
    ttl: 1000 * 60 * 60 * 24,
    references: (cluster: Cluster) => {
      return[`pyth:feeds:${cluster.toString()}`];
    },
  },
  _getFeeds,
).getFeeds;


// const _getFeedsBySymbol = async (cluster: Cluster, symbol: string) => {
//   const feeds = await getFeeds(cluster);
//   return feeds.find((feed) => feed.symbol === symbol);
// };

// export const getFeedsBySymbol = redisCache.define(
//   "getFeedsBySymbol",
//   _getFeedsBySymbol,
// ).getFeedsBySymbol;