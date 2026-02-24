// TODO: We need to find a better way to handle this.
export const ASSET_TYPES = [
  "crypto",
  "fx",
  "equity",
  "metal",
  "rates",
  "commodity",
  "funding-rate",
] as const;

export const RESOLUTIONS = [
  "1",
  "5",
  "15",
  "30",
  "60",
  "120",
  "240",
  "360",
  "720",
  "D",
  "W",
  "M",
] as const;
