import { Cluster } from ".";
import { getPythMetadata } from "./get-metadata";
import { redisCache } from "../../cache";

const _getPublishersByFeedForCluster = async (cluster: Cluster) => {
  const data = await getPythMetadata(cluster);
  const result: Record<string, string[]> = {};
  for (const key of data.productPrice.keys()) {
    const price = data.productPrice.get(key);
    result[key] =
      price?.priceComponents.map(({ publisher }) => publisher.toBase58()) ?? [];
  }
  return result;
};

const _getFeedsByPublisherForCluster = async (cluster: Cluster) => {
  const data = await getPythMetadata(cluster);
  const result: Record<string, string[]> = {};
  for (const symbol of data.productPrice.keys()) {
    const price = data.productPrice.get(symbol);
    if (price !== undefined) {
      for (const component of price.priceComponents) {
        const publisherKey = component.publisher.toBase58();
        if (result[publisherKey] === undefined) {
          result[publisherKey] = [symbol];
        } else {
          result[publisherKey].push(symbol);
        }
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
