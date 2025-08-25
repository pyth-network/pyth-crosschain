'use client'
import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { parseAsStringEnum, useQueryState } from 'nuqs';
import { useCallback } from 'react';

export enum Interval {
  Live,
  OneHour,
  OneDay,
  OneWeek,
  OneMonth,
}

export const INTERVAL_NAMES = {
  [Interval.Live]: "Live",
  [Interval.OneHour]: "1H",
  [Interval.OneDay]: "1D",
  [Interval.OneWeek]: "1W",
  [Interval.OneMonth]: "1M",
} as const;

export const toInterval = (name: (typeof INTERVAL_NAMES)[keyof typeof INTERVAL_NAMES]): Interval => {
  switch (name) {
    case "Live": {
      return Interval.Live;
    }
    case "1H": {
      return Interval.OneHour;
    }
    case "1D": {
      return Interval.OneDay;
    }
    case "1W": {
      return Interval.OneWeek;
    }
    case "1M": {
      return Interval.OneMonth;
    }
  }
};
export const ChartToolbar = () => {
  const logger = useLogger();
  const [interval, setInterval] = useQueryState(
    "interval",
    parseAsStringEnum(Object.values(INTERVAL_NAMES)).withDefault("Live"),
  );

  const handleSelectionChange = useCallback((newValue: Interval) => {
    setInterval(INTERVAL_NAMES[newValue]).catch((error: unknown) => {
      logger.error("Failed to update interval", error);
    });
  }, [logger, setInterval]);

  return (
    <SingleToggleGroup
      selectedKey={toInterval(interval)}
      // @ts-expect-error - wrong param type
      onSelectionChange={handleSelectionChange}
      rounded
      items={[
        { id: Interval.Live, children: INTERVAL_NAMES[Interval.Live] },
        { id: Interval.OneHour, children: INTERVAL_NAMES[Interval.OneHour] },
        { id: Interval.OneDay, children: INTERVAL_NAMES[Interval.OneDay] },
        { id: Interval.OneWeek, children: INTERVAL_NAMES[Interval.OneWeek] },
        { id: Interval.OneMonth, children: INTERVAL_NAMES[Interval.OneMonth] },
      ]}
    />
  );
};
