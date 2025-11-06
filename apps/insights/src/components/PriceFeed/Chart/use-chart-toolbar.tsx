import {
  parseAsStringLiteral,
  useQueryState,
} from "@pythnetwork/react-hooks/nuqs";

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

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * ONE_SECOND_IN_MS;
const ONE_HOUR_IN_MS = 60 * ONE_MINUTE_IN_MS;
const ONE_DAY_IN_MS = 24 * ONE_HOUR_IN_MS;
const ONE_WEEK_IN_MS = 7 * ONE_DAY_IN_MS;
const ONE_MONTH_IN_MS = 30 * ONE_DAY_IN_MS;

const QUICK_SELECT_WINDOW_TO_MS: Record<QuickSelectWindow, number> = {
  "1m": ONE_MINUTE_IN_MS,
  "1H": ONE_HOUR_IN_MS,
  "1D": ONE_DAY_IN_MS,
  "1W": ONE_WEEK_IN_MS,
  "1M": ONE_MONTH_IN_MS,
};

/**
 * Converts a quick select window string (e.g., "1m", "1H", "1D") to its equivalent duration in milliseconds.
 * Used to determine the time range for chart data based on user selection.
 */
export function quickSelectWindowToMilliseconds(
  quickSelectWindow: QuickSelectWindow,
): number {
  return QUICK_SELECT_WINDOW_TO_MS[quickSelectWindow];
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
