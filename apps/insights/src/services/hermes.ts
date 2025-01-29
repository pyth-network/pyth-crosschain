import "server-only";

import { HermesClient } from "@pythnetwork/hermes-client";

import { cache } from "../cache";

const ONE_MINUTE_IN_SECONDS = 60;
const ONE_HOUR_IN_SECONDS = 60 * ONE_MINUTE_IN_SECONDS;

const client = new HermesClient("https://hermes.pyth.network");

export const getPublisherCaps = cache(
  async () => client.getLatestPublisherCaps({ parsed: true }),
  ["publisher-caps"],
  {
    revalidate: ONE_HOUR_IN_SECONDS,
  },
);
