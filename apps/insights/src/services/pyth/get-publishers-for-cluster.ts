import { Cluster } from ".";
import { getPythMetadata } from "./get-metadata";
import { redisCache } from "../../cache";

const _getPublishersByFeedForCluster = async (cluster: Cluster) => {
  const data = await getPythMetadata(cluster);
  const result: Record<string, string[]> = {};
  for (const [key, price] of data.productPrice.entries()) {
    result[key] = price.priceComponents.map(({ publisher }) =>
      publisher.toBase58(),
    );
  }
  return result;
};

/**
 * Given a cluster, this function will return a record which maps each
 * permissioned publisher to the list of price feed IDs for which that publisher
 * is permissioned.
 */
const _getFeedsByPublisherForCluster = async (cluster: Cluster) => {
  const data = await getPythMetadata(cluster);
  const result: Record<string, string[]> = {};
  for (const [symbol, price] of data.productPrice.entries()) {
    for (const component of price.priceComponents) {
      const publisherKey = component.publisher.toBase58();
      if (result[publisherKey] === undefined) {
        result[publisherKey] = [symbol];
      } else {
        result[publisherKey].push(symbol);
      }
    }
  }
  return result;
};

export const getPublishersByFeedForCluster = redisCache.define(
  "getPublishersByFeedForCluster",
  _getPublishersByFeedForCluster,
).getPublishersByFeedForCluster;

export const getFeedsByPublisherForCluster = redisCache.define(
  "getFeedsByPublisherForCluster",
  _getFeedsByPublisherForCluster,
).getFeedsByPublisherForCluster;
