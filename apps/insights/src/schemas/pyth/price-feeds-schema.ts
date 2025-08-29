import { z } from "zod";

export const priceFeedsSchema = z.array(
  z.object({
    symbol: z.string(),
    product: z.object({
      display_symbol: z.string(),
      asset_type: z.string(),
      description: z.string(),
      price_account: z.string(),
      base: z.string().optional(),
      country: z.string().optional(),
      quote_currency: z.string().optional(),
      tenor: z.string().optional(),
      cms_symbol: z.string().optional(),
      cqs_symbol: z.string().optional(),
      nasdaq_symbol: z.string().optional(),
      generic_symbol: z.string().optional(),
      weekly_schedule: z.string().optional(),
      schedule: z.string().optional(),
      contract_id: z.string().optional(),
    }),
    price: z.object({
      exponent: z.number(),
      numComponentPrices: z.number(),
      numQuoters: z.number(),
      minPublishers: z.number(),
      lastSlot: z.bigint(),
      validSlot: z.bigint(),
      priceComponents: z.array(
        z.object({
          publisher: z.string(),
        }),
      ),
    }),
  }),
);
