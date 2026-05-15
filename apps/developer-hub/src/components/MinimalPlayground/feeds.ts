export type LandingFeed = {
  lazerId: number;
  symbol: string;
  label: string;
  assetClass: string;
  exponent: number;
  displayPrecision: number;
};

export const LANDING_FEEDS: LandingFeed[] = [
  {
    lazerId: 1,
    symbol: "Crypto.BTC/USD",
    label: "BTC/USD",
    assetClass: "Crypto",
    exponent: -8,
    displayPrecision: 2,
  },
  {
    lazerId: 922,
    symbol: "Equity.US.AAPL/USD",
    label: "AAPL",
    assetClass: "Equity",
    exponent: -5,
    displayPrecision: 2,
  },
  {
    lazerId: 1398,
    symbol: "Equity.US.SPY/USD",
    label: "SPY",
    assetClass: "Equity",
    exponent: -5,
    displayPrecision: 2,
  },
  {
    lazerId: 327,
    symbol: "FX.EUR/USD",
    label: "EUR/USD",
    assetClass: "FX",
    exponent: -5,
    displayPrecision: 4,
  },
  {
    lazerId: 346,
    symbol: "Metal.XAU/USD",
    label: "XAU/USD",
    assetClass: "Metal",
    exponent: -3,
    displayPrecision: 2,
  },
];
