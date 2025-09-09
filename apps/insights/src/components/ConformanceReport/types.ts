export const INTERVALS = ["24H", "48H", "72H", "1W", "1M"] as const;
export type Interval = (typeof INTERVALS)[number];
