import { ArrowCounterClockwise, List } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@pythnetwork/component-library/Button";
import { DatePicker } from "@pythnetwork/component-library/DatePicker";
import { Popover } from "@pythnetwork/component-library/Popover";
import { Select } from "@pythnetwork/component-library/Select";
import cx from "clsx";
import { useCallback, useState } from "react";

import { PythProDemoSourceSelector } from "../PythProDemoSourceSelector";
import classes from "./index.module.scss";
import { usePythProAppStateContext } from "../../context/pyth-pro-demo";
import { ALLOWED_PLAYBACK_SPEEDS } from "../../schemas/pyth/pyth-pro-demo-schema";
import { isReplaySymbol } from "../../util/pyth-pro-demo";
import { PythProApiTokensMenu } from "../PythProApiTokensMenu";

export function PythProDemoToolsMenu() {
  return (
    <div className={classes.toolsRoot}>
      <div>
        <PythProDemoSourceSelector />
      </div>
      <RightHandSideTools />
    </div>
  );
}

function RightHandSideTools() {
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  /** callbacks */
  const renderTools = useCallback(
    (target: "desktop" | "mobile") => {
      const variant = target === "desktop" ? "outline" : "primary";

      return (
        <>
          {isReplaySymbol(selectedSource) && (
            <div>
              <DatePicker
                onChange={(val) => {
                  void handleSetSelectedReplayDate(val);
                  // force close the mobile menu always, so it doesn't
                  // look like something is still hanging around
                  setMobileMenuOpen(false);
                }}
                onPickerClose={() => {
                  setMobileMenuOpen(false);
                }}
                placeholder={datepickerPlaceholder}
                type="datetime"
                value={selectedReplayDate}
              />
            </div>
          )}
          <div
            className={classes.flexInlineOnMobile}
            data-has-datepicker={isReplaySymbol(selectedSource)}
          >
            {isReplaySymbol(selectedSource) && (
              <Select
                label={undefined}
                onSelectionChange={(val) => {
                  void handleSelectPlaybackSpeed(val);
                }}
                options={[...ALLOWED_PLAYBACK_SPEEDS].map((speed) => ({
                  id: speed,
                }))}
                placeholder="Choose a playback speed"
                selectedKey={playbackSpeed}
                show={({ id: speed }) => `${speed.toString()}x`}
                size="sm"
                textValue={({ id: speed }) => `Speed: ${speed.toString()}x`}
                variant={variant}
              />
            )}
            <Button
              aria-label="Reset chart position"
              onClick={() => {
                chartRef?.timeScale().scrollToRealTime();
              }}
              size="sm"
              variant={variant}
            >
              <ArrowCounterClockwise />
            </Button>
            <PythProApiTokensMenu variant={variant} />
          </div>
        </>
      );
    },
    [
      chartRef,
      handleSelectPlaybackSpeed,
      handleSetSelectedReplayDate,
      playbackSpeed,
      selectedReplayDate,
      selectedSource,
    ],
  );

  /** local variables */
  const datepickerPlaceholder = "Select a datetime to begin";
  const mobileMenuButtonLabel = `${mobileMenuOpen ? "Close" : "Open"} tools menu`;

  return (
    <>
      <div className={classes.rightHandSideTools}>{renderTools("desktop")}</div>
      <Popover
        isOpen={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        popoverContents={
          <div className={cx(classes.mobileToolsMenu)}>
            {renderTools("mobile")}
          </div>
        }
        popoverProps={{ className: cx(classes.mobileMenuPopover) }}
      >
        <Button
          aria-label={mobileMenuButtonLabel}
          className={cx(classes.mobileMenuButton)}
          size="sm"
          variant="outline"
        >
          <List />
        </Button>
      </Popover>
    </>
  );
}
