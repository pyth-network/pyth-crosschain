/* eslint-disable unicorn/no-null */
"use client";

import {
  getLocalTimeZone,
  parseDate,
  parseDateTime,
} from "@internationalized/date";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRight } from "@phosphor-icons/react/dist/ssr/CaretRight";
import cx from "clsx";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useMemo } from "react";
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
  DatePicker as BaseDatePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Label,
  Popover,
} from "react-aria-components";

import type { InputProps } from "../Input";
import styles from "./index.module.scss";

type NativeDatePickerProps = Pick<InputProps, "max" | "min" | "placeholder"> & {
  /**
   * css class name overrides
   */
  className?: string;

  /**
   * optional label to display above the input
   */
  label?: ReactNode;

  /**
   * fired whenever a user changes the selected date value
   */
  onChange: (dateStr: string) => void;

  /**
   * the currently-selected value, as a valid ISO-8061 date string
   */
  value: string;

  /**
   * which type of datepicker to display to the user
   *
   * @defaultValue 'date'
   */
  type?: "date" | "datetime";
};

/**
 * A datepicker that mirrors the NativeDatePicker API, but uses
 * react-aria-components for keyboard support and theming.
 */
export function NativeDatePicker({
  className,
  label,
  onChange,
  value,
  type,
  ...rest
}: NativeDatePickerProps) {
  const pickerType = type ?? "date";

  const valueToUse = useMemo(
    () => parseDateValue(value, pickerType),
    [pickerType, value],
  );

  const minValue = useMemo(
    () => parseDateValue(String(rest.min ?? ""), pickerType),
    [pickerType, rest.min],
  );

  const maxValue = useMemo(
    () => parseDateValue(String(rest.max ?? ""), pickerType),
    [pickerType, rest.max],
  );

  const placeholderValue = useMemo(
    () => parseDateValue(rest.placeholder ?? "", pickerType),
    [pickerType, rest.placeholder],
  );

  return (
    <BaseDatePicker
      className={cx(styles.datePicker, className)}
      aria-label={rest.placeholder ?? "Select a date"}
      granularity={pickerType === "datetime" ? "minute" : "day"}
      minValue={minValue}
      maxValue={maxValue}
      placeholderValue={placeholderValue}
      value={valueToUse}
      onChange={(newValue) => {
        if (!newValue) {
          return;
        }

        onChange(toIsoString(newValue, pickerType));
      }}
    >
      {label && <Label className={styles.label}>{label}</Label>}
      <Group className={cx(styles.group)}>
        <DateInput className={cx(styles.input)}>
          {(segment) => (
            <DateSegment segment={segment} className={styles.segment ?? ""} />
          )}
        </DateInput>
        <Button className={cx(styles.trigger)} aria-label="Open calendar">
          <CalendarBlank className={styles.triggerIcon} />
        </Button>
      </Group>
      <Popover className={cx(styles.popover)}>
        <Dialog className={cx(styles.dialog)}>
          <Calendar className={cx(styles.calendar)}>
            <header className={cx(styles.calendarHeader)}>
              <Button slot="previous" className={cx(styles.navButton)}>
                <CaretLeft className={styles.navIcon} />
              </Button>
              <Heading className={styles.heading} />
              <Button slot="next" className={cx(styles.navButton)}>
                <CaretRight className={styles.navIcon} />
              </Button>
            </header>
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
        </Dialog>
      </Popover>
    </BaseDatePicker>
  );
}

const parseDateValue = (
  value: string,
  pickerType: "date" | "datetime",
): DateValue | null => {
  if (value === "") {
    return null;
  }

  const parsed = dayjs(value);
  if (!parsed.isValid()) {
    return null;
  }

  if (pickerType === "datetime") {
    return parseDateTime(parsed.format("YYYY-MM-DDTHH:mm"));
  }

  return parseDate(parsed.format("YYYY-MM-DD"));
};

const toIsoString = (
  value: DateValue,
  pickerType: "date" | "datetime",
): string => {
  if (pickerType === "date") {
    const { year, month, day } = value;
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }

  return value.toDate(getLocalTimeZone()).toISOString();
};
