"use client";

import { ArrowCounterClockwise } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { DatePicker } from "@pythnetwork/component-library/DatePicker";
import { Select } from "@pythnetwork/component-library/Select";
import { Spinner } from "@pythnetwork/component-library/Spinner";
import { Tooltip } from "@pythnetwork/component-library/Tooltip";
import { Suspense, useCallback, useState } from "react";

import classes from "./index.module.scss";
import {
  PythProApiTokensProvider,
  PythProAppStateProvider,
  usePythProAppStateContext,
  WebSocketsProvider,
} from "../../context/pyth-pro-demo";
import { ALLOWED_PLAYBACK_SPEEDS } from "../../schemas/pyth/pyth-pro-demo-schema";
import { isReplaySymbol } from "../../util/pyth-pro-demo";
import { PythProApiTokensMenu } from "../PythProApiTokensMenu";
import { PythProDemoCards } from "../PythProDemoCards";
import { PythProDemoPriceChart } from "../PythProDemoPriceChart";
import { PythProDemoSourceSelector } from "../PythProDemoSourceSelector";

function PythFeedsDemoPageImpl() {
  /** context */
  const {
    chartRef,
    handleSelectPlaybackSpeed,
    handleSetSelectedReplayDate,
    playbackSpeed,
    selectedReplayDate,
    selectedSource,
  } = usePythProAppStateContext();

  /** state */
  const [datepickerOpen, setDatepickerOpen] = useState(false);

  /** callbacks */
  const selectPlaybackSpeed = useCallback(
    (speed: typeof playbackSpeed) => {
      if (speed === playbackSpeed) return;

      handleSelectPlaybackSpeed(speed);
    },
    [handleSelectPlaybackSpeed, playbackSpeed],
  );

  /** local variables */
  const datepickerPlaceholder = "Select a datetime to begin";

  return (
    <article className={classes.pythFeedsDemoPageRoot}>
      <section>
        <div className={classes.subheader}>
          <h3>Pyth Pro</h3>
          <h4>Real-time feed comparison tool</h4>
        </div>
        <div className={classes.body}>
          <div className={classes.tools}>
            <div>
              <PythProDemoSourceSelector />
            </div>
            <div>
              <Tooltip delay={0} label="Select a date and time to continue">
                {isReplaySymbol(selectedSource) && (
                  <Tooltip
                    delay={0}
                    isOpen={!selectedReplayDate && !datepickerOpen}
                    label={datepickerPlaceholder}
                    tooltipProps={{ placement: "bottom end" }}
                  >
                    <DatePicker
                      onChange={handleSetSelectedReplayDate}
                      onDatepickerOpenCloseChange={setDatepickerOpen}
                      placeholder={datepickerPlaceholder}
                      type="datetime"
                      value={selectedReplayDate}
                    />
                  </Tooltip>
                )}
              </Tooltip>
              <Select
                label={undefined}
                onSelectionChange={selectPlaybackSpeed}
                options={[...ALLOWED_PLAYBACK_SPEEDS].map((speed) => ({
                  id: speed,
                }))}
                placeholder="Choose a playback speed"
                selectedKey={playbackSpeed}
                show={({ id: speed }) => `${speed.toString()}x`}
                size="sm"
                textValue={({ id: speed }) => `Speed: ${speed.toString()}x`}
                variant="outline"
              />
              <Button
                aria-label="Reset chart position"
                onClick={() => {
                  chartRef?.timeScale().scrollToRealTime();
                }}
                size="sm"
                variant="outline"
              >
                <ArrowCounterClockwise />
              </Button>
              <PythProApiTokensMenu />
            </div>
          </div>
          <PythProDemoCards />
          <PythProDemoPriceChart />
        </div>
      </section>
    </article>
  );
}

export function PythFeedsDemoPage() {
  /** local variables */
  const suspenseLoaderLabel = "Initializing Pyth Pro demo...";

  return (
    <PythProApiTokensProvider>
      <Suspense
        fallback={
          <div className={classes.suspenseLoader}>
            <div>{suspenseLoaderLabel}</div>
            <Spinner isIndeterminate label={suspenseLoaderLabel} />
          </div>
        }
      >
        <PythProAppStateProvider>
          <WebSocketsProvider>
            <PythFeedsDemoPageImpl />
          </WebSocketsProvider>
        </PythProAppStateProvider>
      </Suspense>
    </PythProApiTokensProvider>
  );
}
