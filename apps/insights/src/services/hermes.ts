import "server-only";

import { HermesClient } from "@pythnetwork/hermes-client";

const client = new HermesClient("https://hermes.pyth.network");

export const getPublisherCaps = async () =>
  client.getLatestPublisherCaps({ parsed: true });

export const foo = async () => client.getPriceFeeds({});
