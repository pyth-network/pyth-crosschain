"use client";
import { Select } from "@pythnetwork/component-library/Select";
import { SingleToggleGroup } from "@pythnetwork/component-library/SingleToggleGroup";
import { useLogger } from "@pythnetwork/component-library/useLogger";
import { useCallback } from "react";
import type { Key } from "react-aria";

import type { QuickSelectWindow, Resolution } from "./use-chart-toolbar";
import {
  QUICK_SELECT_WINDOW_TO_RESOLUTION,
  QUICK_SELECT_WINDOWS,
  RESOLUTION_TO_QUICK_SELECT_WINDOW,
  RESOLUTIONS,
  useChartQuickSelectWindow,
  useChartResolution,
} from "./use-chart-toolbar";

const ENABLE_RESOLUTION_SELECTOR = false;

export const ChartToolbar = () => {
  const logger = useLogger();
  const [quickSelectWindow, setQuickSelectWindow] = useChartQuickSelectWindow();
  const [resolution, setResolution] = useChartResolution();

  const handleResolutionChanged = useCallback(
    (resolution: Resolution) => {
      setResolution(resolution).catch((error: unknown) => {
        logger.error("Failed to update resolution", error);
      });
      setQuickSelectWindow(RESOLUTION_TO_QUICK_SELECT_WINDOW[resolution]).catch(
        (error: unknown) => {
          logger.error("Failed to update quick select window", error);
        },
      );
    },
    [logger, setResolution, setQuickSelectWindow],
  );

  const handleQuickSelectWindowChange = useCallback(
    (quickSelectWindow: Key) => {
      if (!isQuickSelectWindow(quickSelectWindow)) {
        throw new TypeError("Invalid quick select window");
      }
      setQuickSelectWindow(quickSelectWindow).catch((error: unknown) => {
        logger.error("Failed to update quick select window", error);
      });
      setResolution(QUICK_SELECT_WINDOW_TO_RESOLUTION[quickSelectWindow]).catch(
        (error: unknown) => {
          logger.error("Failed to update resolution", error);
        },
      );
    },
    [logger, setQuickSelectWindow, setResolution],
  );

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!ENABLE_RESOLUTION_SELECTOR) {
    return;
  }

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
        selectedKey={quickSelectWindow}
        onSelectionChange={handleQuickSelectWindowChange}
        rounded
        items={QUICK_SELECT_WINDOWS.map((quickSelectWindow) => ({
          id: quickSelectWindow,
          children: quickSelectWindow,
        }))}
      />
    </>
  );
};

function isQuickSelectWindow(value: Key): value is QuickSelectWindow {
  return QUICK_SELECT_WINDOWS.includes(value as QuickSelectWindow);
}
