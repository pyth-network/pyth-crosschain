"use client";

import {
  getLocalTimeZone,
  parseAbsoluteToLocal,
  toCalendarDateTime,
} from "@internationalized/date";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";
import type {
  TimeValue,
  DateRange as AriaDateRange
} from "react-aria-components";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Group,
  Label,
  Popover,
  Switch,
} from "react-aria-components";

import styles from "./index.module.scss";
import { Button } from "../Button/index.jsx";
import { DateRangeCalendar } from "../DateRangeCalendar/index.jsx";
import { TimeField } from "../TimeField/index.jsx";

export type DateRange = {
  start: Date;
  end: Date;
};

type Preset = {
  id: string;
  label: string;
  getValue: () => DateRange;
};

const DEFAULT_PRESETS: Preset[] = [
  {
    id: "live",
    label: "Live",
    getValue: () => {
      const end = new Date();
      return { start: end, end };
    },
  },
  {
    id: "last-hour",
    label: "Last hour",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 60 * 60 * 1000);
      return { start, end };
    },
  },
  {
    id: "last-24-hours",
    label: "Last 24 hours",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
  {
    id: "last-7-days",
    label: "Last 7 days",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
  {
    id: "last-month",
    label: "Last month",
    getValue: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start, end };
    },
  },
];

type Props = {
  label: string;
  hideLabel?: boolean | undefined;
  value?: DateRange | undefined;
  defaultValue?: DateRange | undefined;
  onChange?: ((value: DateRange) => void) | undefined;
  presets?: Preset[] | undefined;
  showPresets?: boolean | undefined;
  variant?: ComponentProps<typeof Button>["variant"];
  size?: ComponentProps<typeof Button>["size"];
  className?: string | undefined;
  buttonLabel?: ReactNode | undefined;
  isDisabled?: boolean | undefined;
};

export const DateRangePicker = ({
  label,
  hideLabel,
  value: controlledValue,
  defaultValue,
  onChange,
  presets = DEFAULT_PRESETS,
  showPresets = true,
  variant = "outline",
  size = "md",
  className,
  buttonLabel,
  isDisabled,
}: Props) => {
  const [uncontrolledValue, setUncontrolledValue] = useState<
    DateRange | undefined
  >(defaultValue);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const [isOpen, setIsOpen] = useState(false);
  const [includeTime, setIncludeTime] = useState(true);

  const value = controlledValue ?? uncontrolledValue;

  const handleChange = useCallback(
    (newValue: DateRange) => {
      if (controlledValue === undefined) {
        setUncontrolledValue(newValue);
      }
      onChange?.(newValue);
      setSelectedPreset(undefined);
    },
    [controlledValue, onChange],
  );

  const handlePresetSelect = useCallback(
    (preset: Preset) => {
      const newValue = preset.getValue();
      handleChange(newValue);
      setSelectedPreset(preset.id);
      setIsOpen(false);
    },
    [handleChange],
  );

  const handleReset = useCallback(() => {
    const resetValue = defaultValue ?? {
      start: new Date(),
      end: new Date(),
    };
    handleChange(resetValue);
    setSelectedPreset(undefined);
  }, [defaultValue, handleChange]);

  const handleApply = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSetEndToNow = useCallback(() => {
    if (value) {
      handleChange({ ...value, end: new Date() });
    }
  }, [value, handleChange]);

  const ariaDateRange = useMemo(() => {
    if (!value) return null; // eslint-disable-line unicorn/no-null
    return {
      start: toCalendarDateTime(
        parseAbsoluteToLocal(value.start.toISOString()),
      ),
      end: toCalendarDateTime(parseAbsoluteToLocal(value.end.toISOString())),
    }
  }, [value]);

  const startTime = useMemo(() => {
    if (!value) return null; // eslint-disable-line unicorn/no-null
    const date = parseAbsoluteToLocal(value.start.toISOString());
    return toCalendarDateTime(date)
  }, [value]);

  const endTime = useMemo(() => {
    if (!value) return null; // eslint-disable-line unicorn/no-null
    const date = parseAbsoluteToLocal(value.end.toISOString());
    return toCalendarDateTime(date)
  }, [value]);

  const handleCalendarChange = useCallback(
    (newRange: AriaDateRange | null) => {
      if (!newRange || !value) return;

      const startDate = newRange.start.toDate(getLocalTimeZone());
      const endDate = newRange.end.toDate(getLocalTimeZone());

      // Preserve the time from the current value
      const start = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        value.start.getHours(),
        value.start.getMinutes(),
        value.start.getSeconds(),
      );

      const end = new Date(
        endDate.getFullYear(),
        endDate.getMonth(),
        endDate.getDate(),
        value.end.getHours(),
        value.end.getMinutes(),
        value.end.getSeconds(),
      );

      handleChange({ start, end });
    },
    [value, handleChange],
  );

  const handleStartTimeChange = useCallback(
    (newTime: TimeValue | null) => {
      if (!newTime || !value) return;

      const start = new Date(value.start);
      start.setHours(newTime.hour);
      start.setMinutes(newTime.minute);
      start.setSeconds(0);
      start.setMilliseconds(0);

      handleChange({ ...value, start });
    },
    [value, handleChange],
  );

  const handleEndTimeChange = useCallback(
    (newTime: TimeValue | null) => {
      if (!newTime || !value) return;

      const end = new Date(value.end);
      end.setHours(newTime.hour);
      end.setMinutes(newTime.minute);
      end.setSeconds(0);
      end.setMilliseconds(0);

      handleChange({ ...value, end });
    },
    [value, handleChange],
  );

  const displayValue = useMemo(() => {
    if (!value) return "Select date range";
    if (buttonLabel) return buttonLabel;

    const formatDate = (date: Date) => {
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    const formatTime = (date: Date) => {
      return date.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    };

    return `${formatDate(value.start)} ${formatTime(value.start)} - ${formatDate(value.end)} ${formatTime(value.end)}`;
  }, [value, buttonLabel]);

  return (
    <Group className={clsx(styles.dateRangePicker, className)}>
      <Label
        className={styles.labelText}
        data-hidden={hideLabel ? "" : undefined}
      >
        {label}
      </Label>
      <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
        <Button
          variant={variant}
          size={size}
          beforeIcon={<CalendarBlank />}
          {...(isDisabled !== undefined && { isDisabled })}
        >
          {displayValue}
        </Button>
        <Popover 
          {...(styles.popover && { className: styles.popover })} 
          placement="bottom start"
          style={{ maxHeight: 'none' }}
        >
          <Dialog {...(styles.dialog && { className: styles.dialog })} style={{ maxHeight: 'none' }}>
            {showPresets && (
              <div className={styles.presets}>
                <div className={styles.presetsLabel}>DATE TIME</div>
                {presets.map((preset) => (
                  <AriaButton
                    key={preset.id}
                    {...(styles.presetButton && { className: styles.presetButton })}
                    onPress={() => {
                      handlePresetSelect(preset);
                    }}
                    data-selected={
                      selectedPreset === preset.id ? "" : undefined
                    }
                  >
                    <span>{preset.label}</span>
                    {selectedPreset === preset.id && (
                      <Check weight="bold" className={styles.checkIcon} />
                    )}
                  </AriaButton>
                ))}
              </div>
            )}
            <div className={styles.content}>
              <DateRangeCalendar
                value={ariaDateRange}
                onChange={handleCalendarChange}
              />
              <div className={styles.footer}>
                <Switch
                  {...(styles.includeTimeSwitch && { className: styles.includeTimeSwitch })}
                  isSelected={includeTime}
                  onChange={setIncludeTime}
                >
                  <div className={styles.switchIndicator} />
                  <span className={styles.switchLabel}>Include time</span>
                </Switch>
                {includeTime && (
                  <div className={styles.timeFields}>
                    <TimeField
                      label="Start time"
                      value={startTime}
                      onChange={handleStartTimeChange}
                    />
                    <TimeField
                      label="End time"
                      value={endTime}
                      onChange={handleEndTimeChange}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      {...(styles.nowButton && { className: styles.nowButton })}
                      onPress={handleSetEndToNow}
                    >
                      Now
                    </Button>
                  </div>
                )}
              </div>
              <div className={styles.actions}>
                <Button variant="outline" size="md" onPress={handleReset}>
                  Reset
                </Button>
                <Button variant="primary" size="md" onPress={handleApply}>
                  Choose dates
                </Button>
              </div>
            </div>
          </Dialog>
        </Popover>
      </DialogTrigger>
    </Group>
  );
};

export { DEFAULT_PRESETS };
export type { Preset };

