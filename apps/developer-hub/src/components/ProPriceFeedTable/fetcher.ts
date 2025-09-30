import { z } from "zod";

import { PRICE_FEEDS_PRO_API_URL } from "./constants";

export const priceFeedsProPriceIdSchema = z.object({
  asset_type: z.string(),
  description: z.string(),
  exponent: z.number(),
  name: z.string(),
  pyth_lazer_id: z.number(),
  symbol: z.string(),
});

export async function fetchPriceFeedsProPriceIdMetadata(): Promise<
  z.infer<typeof priceFeedsProPriceIdSchema>[]
> {
  const response = await fetch(PRICE_FEEDS_PRO_API_URL);
  const json: unknown = await response.json();
  return z.array(priceFeedsProPriceIdSchema).parse(json);
}
