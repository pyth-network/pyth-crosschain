import { z } from "zod";

export const priceFeedsSchema = z.array(
  z.object({
    price: z.object({
      exponent: z.number(),
      lastSlot: z.bigint(),
      minPublishers: z.number(),
      numComponentPrices: z.number(),
      numQuoters: z.number(),
      priceComponents: z.array(
        z.object({
          publisher: z.string(),
        }),
      ),
      validSlot: z.bigint(),
    }),
    product: z.object({
      asset_type: z.string(),
      base: z.string().optional(),
      cms_symbol: z.string().optional(),
      contract_id: z.string().optional(),
      country: z.string().optional(),
      cqs_symbol: z.string().optional(),
      description: z.string(),
      display_symbol: z.string(),
      generic_symbol: z.string().optional(),
      nasdaq_symbol: z.string().optional(),
      price_account: z.string(),
      quote_currency: z.string().optional(),
      schedule: z.string().optional(),
      tenor: z.string().optional(),
      weekly_schedule: z.string().optional(),
    }),
    symbol: z.string(),
  }),
);
