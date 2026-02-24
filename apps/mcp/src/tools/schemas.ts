import { z } from "zod";

export const channelParam = z
  .string()
  .regex(
    /^(real_time|fixed_rate@\d+ms)$/,
    "Invalid channel format. Valid: real_time, fixed_rate@50ms, fixed_rate@200ms, fixed_rate@1000ms",
  )
  .optional()
  .describe(
    "Override default channel (e.g. fixed_rate@200ms, real_time, fixed_rate@50ms, fixed_rate@1000ms)",
  );
