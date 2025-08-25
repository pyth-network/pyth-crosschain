import { INTERVAL_NAMES } from "./components/PriceFeed/Chart/chart-toolbar";

export const intervalToResolution = (interval: typeof INTERVAL_NAMES[keyof typeof INTERVAL_NAMES]) => {
  switch (interval) {
    case '1H':
      return Resolution.Hour;
    case '1D':
      return Resolution.Day;
  }
}