/* eslint-disable unicorn/no-null */
"use client";

import {
  getLocalTimeZone,
  parseDate,
  parseDateTime,
  today,
  now,
} from "@internationalized/date";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import type { Nullish } from "@pythnetwork/shared-lib/types";
import { isNullOrUndefined } from "@pythnetwork/shared-lib/util";
import { usePrevious } from "@react-hookz/web";
import cx from "clsx";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { DateValue } from "react-aria-components";
import {
  Button,
  Calendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  DateInput,
  DatePickerStateContext,
  DatePicker as BaseDatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
  TimeField,
} from "react-aria-components";

import { Button as DesignSystemButton } from "../Button";
import type { InputProps } from "../Input";
import styles from "./index.module.scss";

export type DatePickerProps = Pick<
  InputProps,
  "max" | "min" | "placeholder"
> & {
  className?: string;
  label?: ReactNode;
  onChange: (dateStr: string) => void;
  onDatepickerOpenCloseChange?: (isOpen: boolean) => void;
  value: string;
  type?: "date" | "datetime";
};

export function DatePicker({
  className,
  label,
  onChange,
  onDatepickerOpenCloseChange,
  placeholder = "Select a date",
  value,
  type = "date",
  ...rest
}: DatePickerProps) {
  const [internalVal, setInternalVal] = useState(value);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState<DateValue | null>(null);

  /** refs */
  const isClosingRef = useRef(false);
  const onDatepickerOpenCloseChangeRef = useRef(onDatepickerOpenCloseChange);

  /** hooks */
  const prevVal = usePrevious(value);
  const datepickerPopoverId = useId();

  const handleShowPicker = useCallback(() => {
    if (isClosingRef.current) return;
    setPopoverOpen(true);
  }, []);

  const handleHidePicker = useCallback(() => {
    isClosingRef.current = true;
    setPopoverOpen(false);
    setTimeout(() => {
      isClosingRef.current = false;
    }, 200);
  }, []);

  const handleOnSubmit = useCallback(() => {
    onChange(internalVal);
    handleHidePicker();
  }, [handleHidePicker, internalVal, onChange]);

  const minValue = useMemo(
    () => parseDateValue(String(rest.min ?? ""), type),
    [type, rest.min],
  );

  const maxValue = useMemo(
    () => parseDateValue(String(rest.max ?? ""), type),
    [type, rest.max],
  );

  const placeholderValue = useMemo(
    () => parseDateValue(placeholder, type),
    [placeholder, type],
  );

  const internalDateTimeVal = useMemo(
    () => parseDateValue(internalVal, type),
    [internalVal, type],
  );

  /** effects */
  useEffect(() => {
    onDatepickerOpenCloseChangeRef.current = onDatepickerOpenCloseChange;
  });

  useEffect(() => {
    if (prevVal === value) return;
    setInternalVal(value);
  }, [prevVal, value]);

  useEffect(() => {
    onDatepickerOpenCloseChangeRef.current?.(popoverOpen);
  }, [popoverOpen]);

  return (
    <BaseDatePicker
      aria-label={placeholder}
      className={cx(styles.datePicker, className)}
      granularity={type === "datetime" ? "minute" : "day"}
      maxValue={maxValue}
      minValue={minValue}
      onChange={(newValue) => {
        setInternalVal(newValue ? toIsoString(newValue, type) : "");
      }}
      placeholderValue={placeholderValue}
      value={internalDateTimeVal}
    >
      {label && <Label className={styles.label}>{label}</Label>}

      <Group
        className={cx(styles.group)}
        onFocus={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            handleShowPicker();
          }
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (popoverOpen) handleHidePicker();
          else handleShowPicker();
        }}
      >
        <DateInput className={cx(styles.input)}>
          {(segment) => (
            <DateSegment className={cx(styles.segment)} segment={segment} />
          )}
        </DateInput>
        <Button
          aria-label="Open calendar"
          className={cx(styles.trigger)}
          onPress={() => {
            if (popoverOpen) handleHidePicker();
            else handleShowPicker();
          }}
        >
          <CalendarBlank className={styles.triggerIcon} />
        </Button>
      </Group>

      <Popover
        className={cx(styles.popover)}
        data-datepickerpopover={datepickerPopoverId}
        isOpen={popoverOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleHidePicker();
        }}
      >
        <Dialog className={cx(styles.dialog)}>
          <Calendar
            className={cx(styles.calendar)}
            focusedValue={focusedDate}
            onFocusChange={setFocusedDate}
          >
            <div className={cx(styles.calendarHeader)}>
              <Button slot="previous" className={cx(styles.navButton)}>
                <CaretLeft className={styles.navIcon} />
              </Button>
              <Heading className={styles.heading} />
              <Button slot="next" className={cx(styles.navButton)}>
                <CaretRight className={styles.navIcon} />
              </Button>
            </div>
            <CalendarGrid className={cx(styles.calendarGrid)}>
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className={cx(styles.headerCell)}>
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => (
                  <CalendarCell className={cx(styles.cell)} date={date} />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </Calendar>

          {type === "datetime" && <DatePickerTimeField />}

          <DatePickerFooter
            onClear={() => {
              setInternalVal("");
            }}
            onFocusDate={setFocusedDate}
            onSubmit={handleOnSubmit}
            type={type}
          />
        </Dialog>
      </Popover>
    </BaseDatePicker>
  );
}

function DatePickerFooter({
  onClear,
  onFocusDate,
  onSubmit,
  type,
}: {
  onClear: () => void;
  onFocusDate: (date: DateValue) => void;
  onSubmit: () => void;
  type: "date" | "datetime";
}) {
  const state = useContext(DatePickerStateContext);

  const handleTodayOrNow = useCallback(() => {
    if (isNullOrUndefined(state)) return;

    const tz = getLocalTimeZone();
    const val = type === "datetime" ? now(tz) : today(tz);
    state.setValue(val);
    onFocusDate(val);
  }, [onFocusDate, state, type]);

  const handleClear = useCallback(() => {
    if (isNullOrUndefined(state)) return;
    state.setValue(null);
    onClear();
  }, [onClear, state]);

  if (!state) return null;

  return (
    <div className={cx(styles.footer)}>
      <DesignSystemButton
        size="sm"
        variant="outline"
        onClick={(e) => {
          e.stopPropagation();
          handleClear();
        }}
      >
        Clear
      </DesignSystemButton>
      <DesignSystemButton
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          handleTodayOrNow();
        }}
        variant="outline"
      >
        {type === "date" ? "Today" : "Now"}
      </DesignSystemButton>
      <DesignSystemButton
        onClick={(e) => {
          e.stopPropagation();
          onSubmit();
        }}
        size="sm"
        variant="primary"
      >
        Submit
      </DesignSystemButton>
    </div>
  );
}

function DatePickerTimeField() {
  const state = useContext(DatePickerStateContext);
  if (!state?.hasTime) return null;

  return (
    <TimeField
      aria-label="Time"
      className={cx(styles.timeField)}
      granularity="minute"
      value={state.timeValue}
      onChange={(newValue) => {
        if (!newValue) return;
        state.setTimeValue(newValue);
      }}
    >
      <Label className={cx(styles.timeLabel)}>Time</Label>
      <DateInput className={cx(styles.timeInput)}>
        {(segment) => (
          <DateSegment className={cx(styles.segment)} segment={segment} />
        )}
      </DateInput>
    </TimeField>
  );
}

function parseDateValue(
  value: string,
  type: "date" | "datetime",
): DateValue | null {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return null;
  return type === "datetime"
    ? parseDateTime(parsed.format("YYYY-MM-DDTHH:mm"))
    : parseDate(parsed.format("YYYY-MM-DD"));
}

function toIsoString(
  value: Nullish<DateValue>,
  type: "date" | "datetime",
): string {
  if (isNullOrUndefined(value)) return "";
  if (type === "date") {
    const { year, month, day } = value;
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }
  return value.toDate(getLocalTimeZone()).toISOString();
}
