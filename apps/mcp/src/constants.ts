// The History API's AssetTypeFilter list, plus crypto-index and
// crypto-redemption-rate, which appear in /v1/symbols data but are rejected as
// a server-side filter (we filter client-side). Replace with the /assets API
// once it exists (see TODO.md).
export const ASSET_TYPES = [
  "crypto",
  "crypto-index",
  "crypto-redemption-rate",
  "fx",
  "equity",
  "metal",
  "rates",
  "interest-rate",
  "nav",
  "commodity",
  "funding-rate",
  "eco",
  "kalshi",
] as const;

// The History API's InstrumentType enum, plus "perp" seen in live data.
export const INSTRUMENT_TYPES = [
  "spot",
  "future",
  "perp",
  "rate",
  "index",
  "nav",
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
