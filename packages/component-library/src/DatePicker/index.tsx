/* eslint-disable unicorn/no-null */
"use client";

import {
  getLocalTimeZone,
  Time,
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
import { useLocale } from "react-aria";
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
} from "react-aria-components";

import { Button as DesignSystemButton } from "../Button";
import type { InputProps } from "../Input";
import { Select } from "../Select";
import styles from "./index.module.scss";

export type DatePickerProps = Pick<
  InputProps,
  "max" | "min" | "placeholder"
> & {
  className?: string;
  label?: ReactNode;
  onChange: (dateStr: string) => void;
  /**
   * fired whenever somebody closes the datepicker
   */
  onPickerClose?: () => void;
  /**
   * fired whenever somebody opens the datepicker
   */
  onPickerOpen?: () => void;
  value: string;
  type?: "date" | "datetime";
};

export function DatePicker({
  className,
  label,
  max,
  min,
  onChange,
  onPickerClose,
  onPickerOpen,
  placeholder = "Select a date",
  value,
  type = "date",
}: DatePickerProps) {
  const [internalVal, setInternalVal] = useState(value);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState<DateValue | null>(null);

  /** refs */
  const isClosingRef = useRef(false);
  const onPickerCloseRef = useRef(onPickerClose);
  const onPickerOpenRef = useRef(onPickerOpen);

  /** hooks */
  const prevVal = usePrevious(value);
  const datepickerPopoverId = useId();

  const handleShowPicker = useCallback(() => {
    if (isClosingRef.current) return;
    setPopoverOpen(true);
    onPickerOpenRef.current?.();
  }, []);

  const handleHidePicker = useCallback(() => {
    isClosingRef.current = true;
    setPopoverOpen(false);
    onPickerCloseRef.current?.();
    setTimeout(() => {
      isClosingRef.current = false;
    }, 200);
  }, []);

  const handleOnSubmit = useCallback(() => {
    onChange(internalVal);
    handleHidePicker();
  }, [handleHidePicker, internalVal, onChange]);

  /** memos */
  const minValue = useMemo(
    () => parseDateValue(String(min ?? ""), type),
    [type, min],
  );

  const maxValue = useMemo(
    () => parseDateValue(String(max ?? ""), type),
    [type, max],
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
    onPickerCloseRef.current = onPickerClose;
    onPickerOpenRef.current = onPickerOpen;
  });

  useEffect(() => {
    if (prevVal === value) return;
    setInternalVal(value);
  }, [prevVal, value]);

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

type DatePickerFooterProps = {
  onClear: () => void;
  onFocusDate: (date: DateValue) => void;
  onSubmit: () => void;
  type: "date" | "datetime";
};

function DatePickerFooter({
  onClear,
  onFocusDate,
  onSubmit,
  type,
}: DatePickerFooterProps) {
  /** context */
  const state = useContext(DatePickerStateContext);

  /** callbacks */
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
  /** context */
  const state = useContext(DatePickerStateContext);

  /** hooks */
  const { locale } = useLocale();

  const timeValue = state?.timeValue ?? new Time(0, 0);

  /** memos */
  const uses24Hour = useMemo(() => {
    const resolved = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
    }).resolvedOptions();
    return (
      resolved.hour12 === false ||
      resolved.hourCycle === "h23" ||
      resolved.hourCycle === "h24"
    );
  }, [locale]);
  const hourOptions = useMemo(
    () =>
      Array.from({ length: uses24Hour ? 24 : 12 }).map((_, index) => ({
        id: uses24Hour ? index : index + 1,
      })),
    [uses24Hour],
  );
  const minuteOptions = useMemo(
    () =>
      Array.from({ length: 60 }).map((_, index) => ({
        id: index,
      })),
    [],
  );
  const periodOptions = useMemo(
    () => [{ id: "AM" }, { id: "PM" }] as const,
    [],
  );

  /** local variables */
  const hour24 = timeValue.hour;
  const minute = timeValue.minute;
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;

  /** callbacks */
  const to24Hour = useCallback((hour: number, nextPeriod: "AM" | "PM") => {
    const normalizedHour = hour % 12;
    return nextPeriod === "PM" ? normalizedHour + 12 : normalizedHour;
  }, []);

  const updateTime = useCallback(
    (nextHour: number, nextMinute: number) => {
      state?.setTimeValue(new Time(nextHour, nextMinute));
    },
    [state],
  );

  if (!state?.hasTime) return null;

  return (
    <div className={cx(styles.timeField)} aria-label="Time">
      <Label className={cx(styles.timeLabel)}>Time</Label>
      <div className={cx(styles.timeSelects)} data-uses-ampm={!uses24Hour}>
        <Select
          className={cx(styles.timeSelect)}
          label="Hour"
          hideLabel
          options={hourOptions}
          selectedKey={uses24Hour ? hour24 : hour12}
          onSelectionChange={(newHour) => {
            const nextHour = Number(newHour);
            updateTime(
              uses24Hour ? nextHour : to24Hour(nextHour, period),
              minute,
            );
          }}
          show={(value) => value.id.toString().padStart(2, "0")}
          size="sm"
          variant="outline"
        />
        <Select
          label="Minute"
          hideLabel
          options={minuteOptions}
          selectedKey={minute}
          onSelectionChange={(newMinute) => {
            updateTime(hour24, Number(newMinute));
          }}
          show={(value) => value.id.toString().padStart(2, "0")}
          size="sm"
          variant="outline"
        />
        {!uses24Hour && (
          <Select
            label="AM/PM"
            hideLabel
            options={periodOptions}
            selectedKey={period}
            onSelectionChange={(newPeriod) => {
              updateTime(
                to24Hour(hour12, newPeriod === "PM" ? "PM" : "AM"),
                minute,
              );
            }}
            show={(value) => value.id}
            size="sm"
            variant="outline"
          />
        )}
      </div>
    </div>
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
