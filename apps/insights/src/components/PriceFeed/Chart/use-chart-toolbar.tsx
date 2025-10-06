import { parseAsStringLiteral, useQueryState } from "nuqs";

export const RESOLUTIONS = ["1s", "1m", "5m", "1H", "1D"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export const QUICK_SELECT_WINDOWS = ["1m", "1H", "1D", "1W", "1M"] as const;
export type QuickSelectWindow = (typeof QUICK_SELECT_WINDOWS)[number];

export function useChartQuickSelectWindow() {
  return useQueryState(
    "quickSelectWindow",
    parseAsStringLiteral(QUICK_SELECT_WINDOWS).withDefault("1m"),
  );
}

export function useChartResolution() {
  return useQueryState(
    "resolution",
    parseAsStringLiteral(RESOLUTIONS).withDefault("1s"),
  );
}

/**
 * Converts a quick select window string (e.g., "1m", "1H", "1D") to its equivalent duration in milliseconds.
 * Used to determine the time range for chart data based on user selection.
 */
export function quickSelectWindowToMilliseconds(
  quickSelectWindow: QuickSelectWindow,
): number {
  switch (quickSelectWindow) {
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

export const RESOLUTION_TO_QUICK_SELECT_WINDOW: Record<
  Resolution,
  QuickSelectWindow
> = {
  "1s": "1m",
  "1m": "1H",
  "5m": "1D",
  "1H": "1W",
  "1D": "1M",
};

export const QUICK_SELECT_WINDOW_TO_RESOLUTION: Record<
  QuickSelectWindow,
  Resolution
> = {
  "1m": "1s",
  "1H": "1m",
  "1D": "5m",
  "1W": "1H",
  "1M": "1H",
};
