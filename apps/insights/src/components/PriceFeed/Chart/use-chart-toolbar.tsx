import { parseAsStringLiteral, useQueryState } from "nuqs";

export const RESOLUTIONS = ["1s", "1m", "5m", "1H", "1D"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const LOOKBACKS = ["1m", "1H", "1D", "1W", "1M"] as const;
export type Lookback = (typeof LOOKBACKS)[number];

export function useChartLookback() {
  return useQueryState(
    "lookback",
    parseAsStringLiteral(LOOKBACKS).withDefault("1m"),
  );
}

export function useChartResolution() {
  return useQueryState(
    "resolution",
    parseAsStringLiteral(RESOLUTIONS).withDefault("1s"),
  );
}

// TODO fhqvst Clean this up - it's confusing
export function lookbackToMilliseconds(lookback: Lookback): number {
  switch (lookback) {
    case "1m": {
      return 60_000;
    }
    case "1H": {
      return 3_600_000;
    }
    case "1D": {
      return 86_400_000;
    }
    case "1W": {
      return 604_800_000;
    }
    case "1M": {
      return 2_629_746_000;
    }
  }
}

export const RESOLUTION_TO_LOOKBACK: Record<Resolution, Lookback> = {
  "1s": "1m",
  "1m": "1H",
  "5m": "1D",
  "1H": "1W",
  "1D": "1M",
};

export const LOOKBACK_TO_RESOLUTION: Record<Lookback, Resolution> = {
  "1m": "1s",
  "1H": "1m",
  "1D": "5m",
  "1W": "1H",
  "1M": "1H",
};
