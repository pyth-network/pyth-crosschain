import { z } from "zod";

export const scalarValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type ScalarValue = z.infer<typeof scalarValueSchema>;

export const changeTypeSchema = z.enum([
  "went_live",
  "added",
  "changed",
  "removed",
]);
export type ChangeType = z.infer<typeof changeTypeSchema>;

export const fieldDiffSchema = z.object({
  path: z.string(),
  before: scalarValueSchema,
  after: scalarValueSchema,
});
export type FieldDiff = z.infer<typeof fieldDiffSchema>;

export const changeEntrySchema = z.object({
  changeType: changeTypeSchema,
  pythLazerId: z.number(),
  symbol: z.string(),
  name: z.string(),
  statusBefore: z.string().nullable(),
  statusAfter: z.string().nullable(),
  changedFields: z.array(fieldDiffSchema),
});
export type ChangeEntry = z.infer<typeof changeEntrySchema>;

export const dailyRollupSchema = z.object({
  date: z.string(),
  totals: z.object({
    went_live: z.number(),
    added: z.number(),
    changed: z.number(),
    removed: z.number(),
  }),
  changes: z.array(changeEntrySchema),
});
export type DailyRollup = z.infer<typeof dailyRollupSchema>;

export const dailyRollupFileSchema = z.object({
  generatedAt: z.string(),
  source: z.string(),
  days: z.array(dailyRollupSchema),
});
export type DailyRollupFile = z.infer<typeof dailyRollupFileSchema>;
