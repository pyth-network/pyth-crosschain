import { z } from "zod";

import { PRICE_FEEDS_PRO_API_URL } from "./constants";

export const PriceFeedsProPriceIdSchema = z.object({
  asset_type: z.string(),
  description: z.string(),
  exponent: z.number(),
  name: z.string(),
  pyth_lazer_id: z.number(),
  symbol: z.string(),
});

export type PriceFeedsProPriceIdMetadata = {
  asset_type: string;
  description: string;
  exponent: number;
  name: string;
  pyth_lazer_id: number;
  symbol: string;
};

export async function fetchPriceFeedsProPriceIdMetadata(): Promise<
  PriceFeedsProPriceIdMetadata[]
> {
  const response = await fetch(PRICE_FEEDS_PRO_API_URL);
  const json: unknown = await response.json();
  return z.array(PriceFeedsProPriceIdSchema).parse(json);
}
