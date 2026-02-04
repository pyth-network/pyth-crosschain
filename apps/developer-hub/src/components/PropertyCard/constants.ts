// List of fields that don't have detailed specifications in PropertyCard
export const FIELDS_WITHOUT_SPECS = [
  "type",
  "subscriptionId",
  "parsed",
  "timestampUs",
  "priceFeeds",
  "priceFeedId",
  "evm",
  "encoding",
  "data",
] as const;

// Animation timing constants (in milliseconds)
export const SCROLL_DELAY_AFTER_EXPAND = 300;
export const SCROLL_DELAY_IMMEDIATE = 50;
export const SCROLL_DELAY_SHORT = 100;
export const HINT_AUTO_HIDE_DELAY = 5000;
