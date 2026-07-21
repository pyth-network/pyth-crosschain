import { z } from "zod";

// Shape of the Hermes `/v2/price_feeds` response entries we index.
export const hermesSchema = z.array(
  z.object({
    id: z.string(),
    attributes: z.object({ symbol: z.string() }),
  }),
);

// Shape of the Lazer (Pro) symbols API response entries we index.
export const lazerSchema = z.array(
  z.object({
    symbol: z.string(),
    name: z.string(),
    pyth_lazer_id: z.number(),
    description: z.string(),
  }),
);

export type HermesFeed = z.infer<typeof hermesSchema>[number];
export type LazerFeed = z.infer<typeof lazerSchema>[number];

// Top-level structure of the build-time snapshot consumed by the search route.
export type PriceFeedsSnapshot = {
  hermes: HermesFeed[];
  hermesBeta: HermesFeed[];
  lazer: LazerFeed[];
};
