import dayjs from "dayjs";
import { z } from "zod";

export const PythProHistoricalDataSources = z.enum(["nbbo", "pyth_pro"]);

export const LooseDate = z.union([
  z.date(),
  z
    .string()
    .nonempty()
    .refine(
      (val) => {
        const d = dayjs(val);
        return d.isValid();
      },
      { message: "invalid datetime format found" },
    )
    .transform((val) => new Date(val)),
]);

export const GetPythProFeedPricesOptsSchema = z.object({
  end: LooseDate,
  sources: z.array(PythProHistoricalDataSources),
  symbol: z.string().nonempty(),
  start: LooseDate,
});

export type GetPythProFeedPricesOpts = z.infer<
  typeof GetPythProFeedPricesOptsSchema
>;

const LooseNumberSchema = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((val) => {
    if (val) return Number(val);
    return;
  });

export const GetPythHistoricalPricesFromDBSchema = z.object({
  ask: LooseNumberSchema,
  bid: LooseNumberSchema,
  exponent: LooseNumberSchema,
  price: LooseNumberSchema,
  timestamp: LooseDate,
});

export const GetPythHistoricalPricesSchema =
  GetPythHistoricalPricesFromDBSchema.omit({
    exponent: true,
  }).extend({
    source: PythProHistoricalDataSources,
    symbol: z.string().nonempty(),
  });
export type GetPythHistoricalPricesType = z.infer<
  typeof GetPythHistoricalPricesSchema
>;

export const GetPythHistoricalPricesReturnTypeSchema = z.array(
  GetPythHistoricalPricesSchema,
);
