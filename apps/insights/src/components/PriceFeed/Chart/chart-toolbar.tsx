"use client";
import { Select } from "@pythnetwork/component-library/Select";
import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useCallback } from "react";
import type { Key } from "react-aria";

import type { Lookback, Resolution } from "./use-chart-toolbar";
import {
  LOOKBACK_TO_RESOLUTION,
  LOOKBACKS,
  RESOLUTION_TO_LOOKBACK,
  RESOLUTIONS,
  useChartLookback,
  useChartResolution,
} from "./use-chart-toolbar";

export const ChartToolbar = () => {
  const logger = useLogger();
  const [lookback, setLookback] = useChartLookback();
  const [resolution, setResolution] = useChartResolution();

  const handleLookbackChange = useCallback(
    (newValue: Key) => {
      if (!isLookback(newValue)) {
        throw new TypeError("Invalid lookback");
      }
      const lookback: Lookback = newValue;
      setLookback(lookback).catch((error: unknown) => {
        logger.error("Failed to update lookback", error);
      });
      setResolution(LOOKBACK_TO_RESOLUTION[lookback]).catch(
        (error: unknown) => {
          logger.error("Failed to update resolution", error);
        },
      );
    },
    [logger, setLookback, setResolution],
  );

  const handleResolutionChanged = useCallback(
    (newValue: Key) => {
      if (!isResolution(newValue)) {
        throw new TypeError("Invalid resolution");
      }
      const resolution: Resolution = newValue;
      setResolution(resolution).catch((error: unknown) => {
        logger.error("Failed to update resolution", error);
      });
      setLookback(RESOLUTION_TO_LOOKBACK[resolution]).catch(
        (error: unknown) => {
          logger.error("Failed to update lookback", error);
        },
      );
    },
    [logger, setResolution, setLookback],
  );

  return (
    <>
      <Select
        label="Resolution"
        hideLabel={true}
        options={RESOLUTIONS.map((resolution) => ({
          id: resolution,
          label: resolution,
        }))}
        selectedKey={resolution}
        onSelectionChange={handleResolutionChanged}
        size="sm"
        variant="outline"
      />
      <SingleToggleGroup
        selectedKey={lookback}
        onSelectionChange={handleLookbackChange}
        rounded
        items={[
          { id: "1m", children: "1m" },
          { id: "1H", children: "1H" },
          { id: "1D", children: "1D" },
          { id: "1W", children: "1W" },
          { id: "1M", children: "1M" },
        ]}
      />
    </>
  );
};

function isLookback(value: Key): value is Lookback {
  return LOOKBACKS.includes(value as Lookback);
}

function isResolution(value: Key): value is Resolution {
  return RESOLUTIONS.includes(value as Resolution);
}
